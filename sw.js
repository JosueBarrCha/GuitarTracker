
const CACHE_NAME = 'guitar-tracker-v2';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Don't cache Firebase/Google API calls
    if (event.request.url.includes('googleapis.com') ||
        event.request.url.includes('firebasejs') ||
        event.request.url.includes('gstatic.com')) {
        return event.respondWith(fetch(event.request));
    }
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request).then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            });
        }).catch(() => caches.match('./index.html'))
    );
});

