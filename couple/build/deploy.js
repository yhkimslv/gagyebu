#!/usr/bin/env node
/* 웹앱을 올리면서, 설치 파일도 같이 올려 [업데이트] 버튼이 바로 받아지게 한다.
 *
 * 이렇게 하는 이유:
 *   맥·윈도우 앱은 코드 서명이 없어 스스로 설치할 수 없다. 대신 새 버전이 나오면
 *   앱이 알림을 띄우고 받는 곳을 열어주는데, 그 자리에 설치 파일이 없으면 소용이 없다.
 *   그래서 배포할 때 dist/ 의 설치 파일을 renderer/downloads/ 로 잠깐 옮겨 함께 올린다.
 *
 * 파일명을 영문으로 바꿔 올리는 이유: 한글 파일명은 주소에서 깨지는 경우가 있다.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectDir = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
/* 배포 대상은 deploy.config.json 에서 읽는다 (사람마다 다르므로 git 에 올리지 않는다).
   deploy.config.example.json 을 복사해 채워 쓰면 된다. */
const mkconfig = require('./mkconfig');
const conf = mkconfig.load(projectDir);
const site = conf.site;            // 주소에 쓰이는 이름 (예: my-gagyebu)
const siteId = conf.siteId;        // Netlify 사이트 ID — 이름만으로는 못 찾는 경우가 있다
if (!site || !siteId) {
  console.error('\n⚠ deploy.config.json 이 없거나 site/siteId 가 비어 있어요.');
  console.error('  deploy.config.example.json 을 복사해서 채워주세요.\n');
  process.exit(1);
}

/* 로그인이 안 돼 있으면 알 수 없는 오류가 잔뜩 나므로 먼저 확인해준다.
   status 는 폴더가 사이트에 연결돼 있지 않으면 0 이 아닌 코드로 끝나므로,
   종료 코드가 아니라 출력 내용으로 판단해야 한다. */
function netlifyStatus() {
  try {
    return execFileSync('npx', ['--yes', 'netlify-cli', 'status'], { stdio: 'pipe' }).toString();
  } catch (e) {
    return ((e.stdout || '') + (e.stderr || '')).toString();
  }
}
if (/Not logged in|You are not logged in/i.test(netlifyStatus())) {
  console.error('\n⚠ Netlify 로그인이 필요합니다. 아래를 한 번만 실행해주세요.\n');
  console.error('    npx netlify-cli login\n');
  console.error('  브라우저가 열리면 승인하시고, 다시 npm run deploy 하시면 됩니다.\n');
  process.exit(1);
}


/* Netlify 로그인 토큰을 CLI 설정에서 읽는다 (게시 API 를 직접 부르기 위해) */
function netlifyToken() {
  const p = path.join(os.homedir(), 'Library/Preferences/netlify/config.json');
  const alt = path.join(os.homedir(), '.config/netlify/config.json');
  for (const f of [p, alt]) {
    if (!fs.existsSync(f)) continue;
    const users = (JSON.parse(fs.readFileSync(f, 'utf8')).users) || {};
    for (const k of Object.keys(users)) {
      const t = ((users[k] || {}).auth || {}).token;
      if (t) return t;
    }
  }
  throw new Error('Netlify 토큰을 찾지 못했습니다. npx netlify-cli login 을 한 번 실행해주세요.');
}

main().catch((e) => { console.error('\n⚠ ' + e.message + '\n'); process.exit(1); });

async function main() {

const version = pkg.version;
const base = `https://${site}.netlify.app`;
const distDir = path.join(projectDir, 'dist');
const rendererDir = path.join(projectDir, 'renderer');
const repo = conf.releaseRepo || '';   // 설치 파일을 올려둘 GitHub 저장소 (예: 아이디/저장소)

/* 설치 파일은 GitHub Releases 에 둔다.
   예전엔 Netlify 에 같이 올렸는데, 한 번 배포할 때마다 280MB 가 올라가서
   무료 크레딧이 금방 바닥났다. 웹앱만 올리면 300KB 밖에 안 된다. */
const wanted = [
  { match: /windows-설치\.exe$/, key: 'win', as: `setup-${version}-win.exe` },
  { match: /mac-arm64\.dmg$/, key: 'mac-arm64', as: `setup-${version}-mac-arm64.dmg` },
  { match: /mac-x64\.dmg$/, key: 'mac-x64', as: `setup-${version}-mac-x64.dmg` }
];

const downloads = {};
if (repo) {
  const tag = `v${version}`;
  const files = fs.existsSync(distDir) ? fs.readdirSync(distDir) : [];
  const staged = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
  for (const w of wanted) {
    const hit = files.find((n) => w.match.test(n));
    if (!hit) { console.log(`  · ${w.key} 설치 파일이 없어 건너뜁니다`); continue; }
    const to = path.join(tmp, w.as);
    fs.copyFileSync(path.join(distDir, hit), to);
    staged.push(to);
    downloads[w.key] = `https://github.com/${repo}/releases/download/${tag}/${w.as}`;
    console.log(`  · ${w.key}  ${w.as}  (${(fs.statSync(to).size / 1048576).toFixed(0)} MB)`);
  }
  if (staged.length) {
    console.log(`\n▸ GitHub Releases ${tag} 에 올리는 중…`);
    try {
      execFileSync('gh', ['release', 'view', tag, '--repo', repo], { stdio: 'pipe' });
      execFileSync('gh', ['release', 'upload', tag, ...staged, '--repo', repo, '--clobber'],
        { stdio: 'inherit' });
    } catch (e) {
      execFileSync('gh', ['release', 'create', tag, ...staged, '--repo', repo,
        '--title', tag, '--notes', '설치 파일'], { stdio: 'inherit' });
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

/* 앱이 새 버전을 판단하는 기준 파일 */
const vpath = path.join(rendererDir, 'version.json');
const vjson = JSON.parse(fs.readFileSync(vpath, 'utf8'));
vjson.version = version;
vjson.downloadPage = repo ? `https://github.com/${repo}/releases/latest` : base + '/';
if (Object.keys(downloads).length) vjson.downloads = downloads;
fs.writeFileSync(vpath, JSON.stringify(vjson, null, 2) + '\n');

/* Netlify 에 웹앱만 올린다.
   무료 크레딧이 떨어지면 --prod 배포가 403 으로 막히는데,
   초안으로 올린 뒤 그 배포를 게시하는 길은 열려 있어서 그 방법을 쓴다. */
mkconfig.write(projectDir);   // 내 설정을 renderer/config.js 로 굽는다
console.log(`\n▸ ${site}.netlify.app 에 올리는 중 (버전 ${version})…\n`);
const out = execFileSync('npx',
  ['--yes', 'netlify-cli', 'deploy', '--dir=renderer', `--site=${siteId}`, '--json'],
  { cwd: projectDir, maxBuffer: 32 * 1024 * 1024 }).toString();
const deployId = JSON.parse(out.slice(out.indexOf('{'))).deploy_id;
if (!deployId) throw new Error('배포 번호를 받지 못했습니다');

const token = netlifyToken();
const res = await fetch(
  `https://api.netlify.com/api/v1/sites/${siteId}/deploys/${deployId}/restore`,
  { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
if (!res.ok) {
  throw new Error(`게시 실패 (HTTP ${res.status}) — ${(await res.text()).slice(0, 200)}`);
}
console.log(`\n✅ 완료 — ${base}`);
if (repo) console.log(`   설치 파일 — https://github.com/${repo}/releases/tag/v${version}`);

}
