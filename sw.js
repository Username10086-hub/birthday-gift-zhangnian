/* ==========================================================================
   sw.js —— Service Worker（PWA 离线支持）
   本地资源缓存优先；CDN 资源网络优先、失败回退缓存。
   只有通过 http/https 访问时才注册；直接双击打开本地 html 会自动跳过。
   ========================================================================== */
const CACHE = 'morandi-life-v18';

const CORE = [
  './', './index.html', './manifest.json',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './images/bday-music.mp3'
];

const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const cdn = CDN_HOSTS.includes(url.hostname);
  if (!same && !cdn) return;

  // 页面导航：网络优先，离线回退到缓存的首页
  if (same && req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const cp = res.clone();
        caches.open(CACHE).then((c) => c.put('./index.html', cp));
        return res;
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // 同源静态资源：缓存优先
  if (same) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const cp = res.clone();
          caches.open(CACHE).then((c) => c.put(req, cp));
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // CDN：网络优先，离线用缓存
  e.respondWith(
    fetch(req).then((res) => {
      if (res && (res.status === 200 || res.type === 'opaque')) {
        const cp = res.clone();
        caches.open(CACHE).then((c) => c.put(req, cp));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});
