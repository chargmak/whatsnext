const CACHE_NAME = 'whatsnext-v2';
const IMAGE_CACHE = 'whatsnext-images-v1';
const API_CACHE = 'whatsnext-tmdb-v1';

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    const keep = [CACHE_NAME, IMAGE_CACHE, API_CACHE];
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n)))
        ).then(() => self.clients.claim())
    );
});

const putInCache = async (cacheName, request, response) => {
    if (response && (response.status === 200 || response.type === 'opaque')) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
    }
    return response;
};

// Hashed immutable bundles: cache-first
const cacheFirst = async (request, cacheName) => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    return putInCache(cacheName, request, response);
};

// TMDB images: serve from cache, refresh in the background
const staleWhileRevalidate = async (request, cacheName) => {
    const cached = await caches.match(request);
    const network = fetch(request)
        .then((response) => putInCache(cacheName, request, response))
        .catch(() => cached);
    return cached || network;
};

// TMDB API: prefer fresh data, fall back to cache offline
const networkFirst = async (request, cacheName) => {
    try {
        const response = await fetch(request);
        return await putInCache(cacheName, request, response);
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error('offline and not cached');
    }
};

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Auth and user data must never be served stale — let the network handle it.
    if (url.hostname.endsWith('.supabase.co')) return;

    if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
        event.respondWith(cacheFirst(request, CACHE_NAME));
        return;
    }

    if (url.hostname === 'image.tmdb.org' || url.hostname === 'api.dicebear.com') {
        event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
        return;
    }

    if (url.hostname === 'api.themoviedb.org') {
        event.respondWith(networkFirst(request, API_CACHE));
        return;
    }

    // SPA navigations: network first, offline shell fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Everything else same-origin: cache falling back to network
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(request).then((cached) => cached || fetch(request))
        );
    }
});
