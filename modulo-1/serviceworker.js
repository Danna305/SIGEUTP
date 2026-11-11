// Service worker del Módulo 1 (Expediente digital) — alcance: /modulo-1/
// Páginas y recursos: primero la red y, sin conexión, la copia guardada.
// Las llamadas a Supabase no se guardan aquí (la app guarda su propia copia
// del expediente en localStorage para consultarla sin conexión).
const VERSION = 'm1-v4';
const CACHE = `sigep-modulo-1-${VERSION}`;
const PRECACHE = [
  './',
  './index.html',
  './login.html',
  './modulo-1.html',
  './styles.css',
  './app.js',
  './js/expediente.js',
  './js/instalar.js',
  './manifest.json',
  './img/icon-192.png',
  './img/icon-512x512.png',
  './img/icon-maskable-512.png',
  './img/modulo-1.jpg',
  '../css/sigep.css',
  '../js/sigep.js',
  '../js/config.js',
  '../js/vendor/supabase.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres
        .filter((n) => n.startsWith('sigep-modulo-1-') && n !== CACHE || n === 'app-estadias-v1')
        .map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, fuentes, etc.

  event.respondWith(
    fetch(request)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copia));
        }
        return respuesta;
      })
      .catch(async () => {
        const guardada = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
        if (guardada) return guardada;
        if (request.mode === 'navigate') return caches.match('./modulo-1.html');
        return Response.error();
      })
  );
});

// Notificaciones push enviadas por la Edge Function «enviar-push».
// Formato: { titulo, texto, url, modulo, etiqueta }
self.addEventListener('push', (event) => {
  let datos = {};
  try { datos = event.data ? event.data.json() : {}; } catch { datos = { texto: event.data && event.data.text() }; }
  const titulo = datos.titulo || datos.title || 'SIGEP UTP';
  event.waitUntil(self.registration.showNotification(titulo, {
    body: datos.texto || datos.body || 'Tienes una novedad en tu expediente.',
    icon: './img/icon-192.png',
    badge: './img/icon-192.png',
    tag: datos.etiqueta || 'sigep-modulo-1',
    data: { url: datos.url || './modulo-1.html', modulo: datos.modulo || 1 },
  }));
});

// Resuelve la dirección de la notificación según el módulo que la envió
function destino(datos) {
  const url = datos && datos.url ? datos.url : './modulo-1.html';
  if (/^https?:/.test(url) || url.startsWith('/')) return new URL(url, self.location.origin).href;
  const modulo = Number(datos && datos.modulo) || 1;
  const base = new URL(`../modulo-${modulo}/`, self.registration.scope);
  return new URL(url.replace(/^\.\//, ''), base).href;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = destino(event.notification.data);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      const abierta = ventanas.find((v) => v.url.split('#')[0] === url.split('#')[0]);
      if (abierta && 'focus' in abierta) return abierta.focus();
      return self.clients.openWindow(url);
    })
  );
});
