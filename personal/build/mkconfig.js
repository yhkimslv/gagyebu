/* 배포하는 사람마다 다른 값(내 사이트 주소, 알림 공개키)을 renderer/config.js 로 만들어준다.
 *
 * 이 값들은 비밀이 아니지만 사람마다 다르다. 소스에 박아두면 남이 그대로 가져다 썼을 때
 * 남의 사이트를 바라보게 되므로, deploy.config.json 에서 읽어 만들어 쓴다.
 * (deploy.config.json 은 git 에 올리지 않는다)
 */
const fs = require('fs');
const path = require('path');

function load(projectDir) {
  const f = path.join(projectDir, 'deploy.config.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  return {};
}

/* renderer/config.js 를 만든다. 값이 없으면 빈 값으로 — 앱은 그래도 동작한다.
   (업데이트 확인과 알림 기능만 조용히 꺼진다) */
function write(projectDir) {
  const c = load(projectDir);
  const body = `/* 이 파일은 build 가 만들어냅니다. 직접 고치지 마세요.
   값은 deploy.config.json 에서 옵니다. */
window.APP_CONFIG = ${JSON.stringify({
    updateBase: c.updateBase || '',
    vapidPublic: c.vapidPublic || ''
  }, null, 2)};
`;
  fs.writeFileSync(path.join(projectDir, 'renderer', 'config.js'), body);
  return c;
}

module.exports = { load, write };
