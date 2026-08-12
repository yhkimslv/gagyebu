#!/usr/bin/env node

/* 설치 파일 빌드 스크립트.
 *
 * 왜 electron-builder 를 직접 부르지 않고 이걸 거치는가:
 *   이 프로젝트는 데스크탑(=iCloud 동기화 폴더) 안에 있다. iCloud 는 파일마다 확장 속성을
 *   계속 다시 붙이는데, codesign 은 그런 속성이 붙은 앱에 서명하기를 거부한다
 *   ("resource fork, Finder information, or similar detritus not allowed").
 *   그래서 빌드 결과물만 동기화되지 않는 임시 폴더에 만들고, 다 되면 dist/ 로 옮겨온다.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mkconfig = require('./mkconfig');
const os = require('os');

const projectDir = path.resolve(__dirname, '..');
mkconfig.write(projectDir);   // 내 설정을 renderer/config.js 로 굽는다
const distDir = path.join(projectDir, 'dist');
const tmpOut = path.join(os.tmpdir(), 'mygagyebu-build');

const args = process.argv.slice(2);
if (!args.length) args.push('--mac', '--win');

fs.rmSync(tmpOut, { recursive: true, force: true });
fs.mkdirSync(tmpOut, { recursive: true });

console.log(`▸ 빌드 위치: ${tmpOut}  (iCloud 동기화 밖)`);

/* dmg 두 개를 동시에 만들면 hdiutil 이 서로 충돌해서
   "Resource temporarily unavailable (35)" 로 실패한다. 그래서 하나씩 순서대로 만든다. */
const jobs = [];
if (args.includes('--mac')) jobs.push(['--mac', 'dmg', '--arm64'], ['--mac', 'dmg', '--x64']);
if (args.includes('--win')) jobs.push(['--win']);

const builder = path.join(projectDir, 'node_modules', '.bin', 'electron-builder');
for (const job of jobs) {
  console.log(`\n▸ ${job.join(' ')}`);
  execFileSync(builder, [...job, `--config.directories.output=${tmpOut}`], {
    cwd: projectDir,
    stdio: 'inherit'
  });
}

// electron-builder 가 끝난 뒤에도 dmg 쓰기가 잠깐 더 이어질 수 있어,
// 결과 파일 목록과 크기가 더 안 변할 때까지 기다린다.
const wanted = /\.(dmg|exe|zip)$/i;
const snapshot = () =>
  fs.readdirSync(tmpOut)
    .filter((n) => wanted.test(n) && !n.startsWith('__uninstaller'))
    .sort()
    .map((n) => `${n}:${fs.statSync(path.join(tmpOut, n)).size}`)
    .join('|');

let prev = '';
for (let i = 0; i < 30; i++) {
  const now = snapshot();
  if (now && now === prev) break;
  prev = now;
  execFileSync('sleep', ['1']);
}

// 설치 파일만 dist/ 로 가져온다 (중간 산출물 폴더는 두고 온다)
fs.rmSync(distDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
fs.mkdirSync(distDir, { recursive: true });

const copied = [];
for (const name of fs.readdirSync(tmpOut)) {
  if (!wanted.test(name) || name.startsWith('__uninstaller')) continue;
  fs.copyFileSync(path.join(tmpOut, name), path.join(distDir, name));
  copied.push(name);
}

console.log('\n▸ 완성된 설치 파일 (dist/)');
for (const n of copied.sort()) {
  const mb = (fs.statSync(path.join(distDir, n)).size / 1048576).toFixed(0);
  console.log(`   ${n}  (${mb} MB)`);
}
if (!copied.length) {
  console.error('⚠ 설치 파일이 만들어지지 않았습니다.');
  process.exit(1);
}
