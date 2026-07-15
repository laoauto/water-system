// sw.js — Service Worker ພື້ນຖານ ສຳລັບ Cache ໜ້າ Shell ໃຫ້ເປີດໄວຂຶ້ນ ແລະ ໃຊ້ Offline ໄດ້ບາງສ່ວນ
// ໝາຍເຫດ: ຂໍ້ມູນຈິງ (ສະຕັອກ, ຍອດຂາຍ) ຍັງຕ້ອງການອິນເຕີເນັດສະເໝີ ເພາະດຶງຈາກ Google Apps Script

const CACHE_NAME = 'watersale-cache-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './api.js',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ບໍ່ Cache ຄຳຮ້ອງໄປຫາ Google Apps Script — ຕ້ອງເອີ້ນສົດສະເໝີ
  if (url.hostname.indexOf('script.google.com') !== -1) {
    return; // ປ່ອຍໃຫ້ browser ຈັດການປົກກະຕິ
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (event.request.method === 'GET' && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
