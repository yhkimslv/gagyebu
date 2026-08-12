/* 빌드 직후 맥 앱에 임시(ad-hoc) 서명을 넣는다.
 *
 * 왜 필요한가:
 *   Apple Silicon(arm64) 맥은 실행 파일에 유효한 서명이 없으면 앱을 즉시 죽인다(SIGTRAP).
 *   애플 개발자 계정($99/년)이 없으면 정식 서명을 못 하지만, 임시 서명만 해도 실행은 된다.
 *   (다른 사람 맥에서는 "확인되지 않은 개발자" 경고를 한 번 넘겨야 하는 건 동일하다.)
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );
  if (!fs.existsSync(appPath)) return;

  const ent = path.join(__dirname, 'entitlements.mac.plist');
  const run = (args) => {
    try {
      execFileSync('codesign', args, { stdio: 'pipe' });
    } catch (err) {
      const msg = (err.stderr || err.stdout || Buffer.from('')).toString().trim();
      throw new Error(`codesign 실패: ${args[args.length - 1]}\n${msg}`);
    }
  };

  // iCloud 동기화 폴더(데스크탑 등)에서 빌드하면 확장 속성이 계속 다시 붙어
  // codesign 이 "resource fork ... not allowed" 로 거부한다. 서명 직전마다 지운다.
  const clean = (p) => {
    try { execFileSync('xattr', ['-cr', p], { stdio: 'pipe' }); } catch (e) { /* 없으면 그만 */ }
  };

  const frameworks = path.join(appPath, 'Contents', 'Frameworks');
  const listIf = (dir, filter) =>
    fs.existsSync(dir) ? fs.readdirSync(dir).filter(filter).map((n) => path.join(dir, n)) : [];

  // 프레임워크 안에 들어 있는 실행 파일들(chrome_crashpad_handler, ShipIt, *.dylib 등)을
  // 먼저 서명해야 그걸 감싸는 프레임워크 서명이 통과한다.
  const machoFiles = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      let st;
      try { st = fs.lstatSync(p); } catch (e) { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { walk(p); continue; }
      if (!(st.mode & 0o111) && !/\.(dylib|so|node)$/.test(name)) continue;
      try {
        if (execFileSync('file', ['-b', p]).toString().includes('Mach-O')) machoFiles.push(p);
      } catch (e) { /* 판별 실패는 건너뛴다 */ }
    }
  };
  if (fs.existsSync(frameworks)) walk(frameworks);
  // 경로가 깊은 것부터 (= 안쪽부터) 서명
  machoFiles.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);
  for (const f of machoFiles) {
    clean(f);
    run(['--force', '--sign', '-', f]);
  }

  // 안쪽부터 바깥쪽 순서로 서명해야 한다 (--deep 은 헬퍼 권한을 망가뜨리므로 쓰지 않는다)
  for (const helper of listIf(frameworks, (n) => n.endsWith('.app'))) {
    clean(helper);
    run(['--force', '--entitlements', ent, '--sign', '-', helper]);
  }
  for (const fw of listIf(frameworks, (n) => n.endsWith('.framework'))) {
    clean(fw);
    run(['--force', '--sign', '-', fw]);
  }
  clean(appPath);
  run(['--force', '--entitlements', ent, '--sign', '-', appPath]);
  run(['--verify', '--strict', appPath]);

  console.log(`  • ad-hoc 서명 완료  ${path.basename(appPath)}`);
};
