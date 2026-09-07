// Service worker: приложение должно открываться без сети.
//
// Без него техник в подвале получает пустую страницу, и никакая очередь отметок
// уже не спасает. Стратегия простая и предсказуемая:
//   навигация  — сеть, при обрыве отдаём сохранённую страницу;
//   статика    — сначала кеш, потом фоновое обновление;
//   /api/      — только сеть, ответы не кешируем никогда.
//
// Данные API кешировать нельзя: их место в localStorage приложения, где ими
// управляет код, который знает про очередь неотправленных отметок.

const VERSION = 'v1';
const CACHE = `360profi-${VERSION}`;
const SCOPE = new URL(self.registration.scope);
const START_URL = new URL('index.html', SCOPE).toString();

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([START_URL]))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cacheable = (request) => {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin) return false;
  if (url.pathname.includes('/api/')) return false;
  return true;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Страница приложения: свежая, если есть сеть; сохранённая, если нет.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(START_URL, copy));
          return response;
        })
        .catch(() => caches.match(START_URL).then((cached) => cached ?? Response.error()))
    );
    return;
  }

  if (!cacheable(request)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached ?? Response.error());

      // Кеш отдаём сразу, сеть догоняет в фоне: на площадке важнее скорость,
      // а собранные ассеты неизменяемы — имя файла меняется вместе с версией.
      return cached ?? network;
    })
  );
});
