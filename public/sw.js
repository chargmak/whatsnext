const CACHE_NAME = 'whatsnext-v7';
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
    self.skipWaiting();
    // Precache the app shell, but tolerate individual misses. A rejected
    // cache.addAll() would abort the whole install and leave visitors stuck on
    // the previous (possibly broken) worker — exactly what we're recovering from.
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) =>
            Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
        )
    );
});

self.addEventListener('activate', (event) => {
    const keep = [CACHE_NAME, IMAGE_CACHE, API_CACHE];
    event.waitUntil((async () => {
        const names = await caches.keys();
        // A leftover app cache from a previous version means this is an update,
        // not a first install. Earlier builds shipped a cache-first worker that
        // could pin a stale index.html referencing build assets that no longer
        // exist, leaving returning users on a black screen.
        const isUpdate = names.some((n) => n.startsWith('whatsnext-') && !keep.includes(n));
        await Promise.all(names.filter((n) => !keep.includes(n)).map((n) => caches.delete(n)));
        await self.clients.claim();

        // Self-heal: now that this fresh, network-first worker is in control,
        // reload any open windows so a stuck black screen picks up the current
        // shell without the user having to clear their cache. Skip on first
        // install so an ordinary first visit isn't reloaded.
        if (isUpdate) {
            const clients = await self.clients.matchAll({ type: 'window' });
            await Promise.all(clients.map(async (client) => {
                try { await client.navigate(client.url); } catch { /* client may not be navigable */ }
            }));
        }
    })());
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

// --- Web Push: release reminders ---

// Payload shape (sent by the send-release-reminders edge function):
// { title, body, url, tag, icon, image }
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data ? event.data.text() : '' };
    }

    const title = data.title || "What's Next?";
    const options = {
        body: data.body || 'A title on your list is coming out!',
        icon: data.icon || '/icon-192.png',
        badge: '/icon-192.png',
        image: data.image,
        tag: data.tag,
        renotify: Boolean(data.tag),
        data: { url: data.url || '/notifications' },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/notifications';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
        })
    );
});
