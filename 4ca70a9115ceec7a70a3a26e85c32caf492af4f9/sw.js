const cachePrefix = 'bible-content-' + self.registration.scope;
const staticCacheName = cachePrefix + '-static-v7';
const dynamicCacheName = cachePrefix + '-dynamic-v7';
const assets = [
'./index.html',
'./b.htm',
'./reader.css',
'./library.js',
'./vsearch.htm',
'./search.css',
'./search.js',
'./search-range.js',
'./a.htm',
'./leftbar.htm',
'./rightbar.htm',
'./frames.htm',
'./icons/icon-128x128.png',
'./icons/icon-144x144.png',
'./icons/icon-152x152.png',
'./icons/icon-192x192.png',
'./icons/icon-384x384.png',
'./icons/icon-512x512.png',
'./icons/icon-72x72.png',
'./icons/icon-96x96.png',
'./b.css',
'./std.js',
'./xpmenu.js',
'./formretain.js',
'./vdata.js',
'./quicklinks.js',
'./idata.js',
'./isearch.js',
'./listv.js',
'./goverse.js',
'./blank4x4.png',
'./a.css',
'./main.js',
'./sw.js',
'./manifest.json'





];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(staticCacheName).then(cache => cache.addAll(assets)));
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
