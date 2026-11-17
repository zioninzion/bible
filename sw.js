const cachePrefix = 'bible-login-' + self.registration.scope;
const staticCacheName = cachePrefix + '-static-v4';
const dynamicCacheName = cachePrefix + '-dynamic-v4';
const assets = ['./', './index.html', './login.js', './manifest.json', './grunge_patterns.jpg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(staticCacheName).then(cache => cache.addAll(assets)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(cachePrefix) &&
      key !== staticCacheName && key !== dynamicCacheName)
      .map(key => caches.delete(key))
  )));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' ||
      new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) {
      const copy = response.clone();
      const cache = await caches.open(dynamicCacheName);
      try {
        await cache.put(event.request, copy);
      } catch (error) {
        // Storage limits must not prevent an online page from loading.
      }
    }
    return response;
  })());
});
