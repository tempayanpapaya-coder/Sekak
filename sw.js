// ============================================================
// sw.js — Service Worker Sekak Jowo
// Strategi: Cache First untuk aset statis, Network First untuk Firebase
// ============================================================

const CACHE_NAME    = 'sekak-jowo-v1';
const CACHE_STATIS  = 'sekak-statis-v1';
const CACHE_DINAMIS = 'sekak-dinamis-v1';

// Aset yang langsung di-cache saat install (wajib ada offline)
const ASET_WAJIB = [
    '/',
    '/index.html',
    '/Sekak.html',
    '/CSS/Sekak.css',
    '/JS/config.js',
    '/JS/audio.js',
    '/JS/game-engine.js',
    '/JS/ui-control.js',
    '/JS/firebase-online.js',
    '/JS/stockfish.js',
    '/manifest.json',

    // Library eksternal (cache lokal agar offline tetap jalan)
    'https://cdn.jsdelivr.net/npm/jquery@3.6.4/dist/jquery.min.js',
    'https://cdn.jsdelivr.net/npm/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.js',
    'https://cdn.jsdelivr.net/npm/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js',
];

// ── INSTALL: cache semua aset wajib ──
self.addEventListener('install', event => {
    console.log('[SW] Install — caching aset wajib...');
    event.waitUntil(
        caches.open(CACHE_STATIS).then(cache => {
            return cache.addAll(ASET_WAJIB);
        }).then(() => {
            console.log('[SW] Semua aset wajib berhasil di-cache.');
            return self.skipWaiting(); // Langsung aktif tanpa tunggu tab lama tutup
        })
    );
});

// ── ACTIVATE: hapus cache lama ──
self.addEventListener('activate', event => {
    console.log('[SW] Activate — bersihkan cache lama...');
    event.waitUntil(
        caches.keys().then(kunci => {
            return Promise.all(
                kunci
                    .filter(k => k !== CACHE_STATIS && k !== CACHE_DINAMIS)
                    .map(k => {
                        console.log('[SW] Hapus cache lama:', k);
                        return caches.delete(k);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ── FETCH: strategi cache ──
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Firebase & API eksternal → Network First (butuh realtime)
    if (
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('googleapis.com')
    ) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // Aset audio dari GitHub → Cache First
    if (url.hostname.includes('github') || url.hostname.includes('githubusercontent')) {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    // Semua aset lain → Cache First
    event.respondWith(cacheFirst(event.request));
});

// ── Strategi: Cache First ──
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            const cache = await caches.open(CACHE_DINAMIS);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        // Offline & tidak ada cache → kembalikan halaman offline
        const offlineFallback = await caches.match('/index.html');
        return offlineFallback || new Response('Offline — tidak ada koneksi internet.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// ── Strategi: Network First ──
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            const cache = await caches.open(CACHE_DINAMIS);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        return cached || new Response('{}', {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// ── Pesan dari client (misal: force update) ──
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
