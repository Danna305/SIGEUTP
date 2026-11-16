/* =====================================================================
   SIGEP · Service worker de la raíz (página principal y acceso único)
   ---------------------------------------------------------------------
   · Guarda la página principal y el inicio de sesión para abrirlos sin
     conexión. Las pantallas de cada área (expediente, tesina, coordinación,
     pre-auditoría) tienen su propio service worker con alcance en su carpeta.
   · Red primero (siempre la versión más reciente) y, sin conexión, la copia.
   · Solo borra sus propias cachés (sigep-inicio-…).
   ===================================================================== */
const VERSION = 'v1';
const CACHE = `sigep-inicio-${VERSION}`;
const PRECACHE = [
  './',
  'index.html',
  'login.html',
  'manifest.webmanifest',
  'css/sigep.css',
  'css/inicio.css',
  'js/inicio.js',
  'js/sigep.js',
  'js/rutas.js',
  'js/config.js',
  'js/vendor/supabase.js',
  'modulo-4/css/portal.css',
  'modulo-4/js/toast.js',
  'modulo-4/js/cache-api.js',
  'modulo-4/js/auth.js',
  'modulo-4/js/portal.js',
  'icons/icon.svg',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

// GitHub Pages deja cada archivo 10 minutos en la caché HTTP del navegador:
// se pide siempre la versión más reciente al servidor
const fresca = (url) => new Request(url, { cache: 'reload' });
function red(request) {
  return request.mode === 'navigate'
    ? fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : fetch(request, { cache: 'no-cache' });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(fresca(url)).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres
        .filter((n) => n.startsWith('sigep-inicio-') && n !== CACHE)
        .map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, tipografías, etc.

  event.respondWith(
    red(request)
      .then((respuesta) => {
        // Solo guarda lo de la raíz: cada área tiene su propio service worker y su caché
        if (respuesta.ok && !url.search && !url.pathname.includes('/modulo-')) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copia)).catch(() => {});
        }
        return respuesta;
      })
      .catch(async () => {
        const guardada = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
        if (guardada) return guardada;
        if (request.mode === 'navigate') return (await caches.match('login.html')) || Response.error();
        return Response.error();
      })
  );
});
