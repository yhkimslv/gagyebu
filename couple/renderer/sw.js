/* 오프라인 지원용 서비스 워커.
 * 앱 화면 파일만 캐시하고, Supabase 통신은 절대 건드리지 않는다.
 * 앱 파일을 고쳤으면 아래 CACHE 버전을 올려야 새 파일이 반영된다. */
const CACHE = 'gagyebu-v22';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'config.js',
  'i18n.js',
  'storage.js',
  'sync.js',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];
// version.json 은 항상 최신을 받아야 하므로 캐시하지 않는다

/* 새 버전을 받아두기만 하고, 언제 갈아탈지는 앱이 [업데이트] 버튼으로 결정한다.
   (여기서 바로 skipWaiting 하면 쓰던 화면이 예고 없이 바뀐다) */
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // 다른 도메인(=Supabase)이나 GET 이 아닌 요청은 그대로 통과시킨다
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // 앱 파일은 캐시를 먼저 주고, 뒤에서 조용히 최신본을 받아 둔다
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const live = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || live;
    })
  );
});

/* ===== 알림 =====
   보내는 쪽(GitHub Actions)이 쏜 알림을 받아 폰에 띄운다.
   iOS 는 홈 화면에 추가한 웹앱에서만 알림이 온다. */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  const title = d.title || '우리 가계부';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: d.tag || 'gagyebu',        // 같은 tag 는 덮어써서 알림이 쌓이지 않게
    renotify: true,
    data: { url: d.url || './' }
  }));
});

/* 알림을 누르면 이미 열린 앱으로 가고, 없으면 새로 연다 */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate && c.navigate(target); return c.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});
