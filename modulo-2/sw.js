// =====================================================================
// sw.js - Service Worker de SIGEP UTP · Módulo 2 (Administración académica)
// Usa la API Cache con tres cachés y una estrategia distinta para cada una:
//   sigep-m2-shell     -> Cache First             (archivos base de la app)
//   sigep-m2-dinamica  -> Stale-While-Revalidate  (imágenes, video, fuentes)
//   sigep-m2-datos     -> Network First           (copia de los datos de Supabase;
//                                                  la guarda js/datos.js)
// Los datos vienen de Supabase (otro dominio): el SW no los intercepta.
// =====================================================================
const VERSION = 'v7';
const CACHE_SHELL = `sigep-m2-shell-${VERSION}`;
const CACHE_DINAMICA = 'sigep-m2-dinamica-v1';
const CACHE_DATOS = 'sigep-m2-datos-v1';
const CACHES_ACTUALES = [CACHE_SHELL, CACHE_DINAMICA, CACHE_DATOS];
const MAX_DINAMICA = 40;                 // máximo de archivos en la caché dinámica
const OFFLINE_URL = './offline.html';

// App Shell: lo mínimo para que el panel abra sin conexión
const ARCHIVOS_SHELL = [
  './',
  './index.html',
  './offline.html',
  './css/styles.css',
  './js/datos.js',
  './js/app.js',
  './js/radar.js',
  '../js/config.js',
  '../js/vendor/supabase.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];
const FUENTES = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// ---------- Utilidades ----------
// Copia la respuesta agregando la fecha en que se guardó (encabezado sw-fecha)
async function conFecha(respuesta) {
  const headers = new Headers(respuesta.headers);
  headers.set('sw-fecha', new Date().toISOString());
  const cuerpo = await respuesta.clone().blob();
  return new Response(cuerpo, { status: respuesta.status, statusText: respuesta.statusText, headers });
}

// Mantiene la caché dinámica por debajo de MAX_DINAMICA borrando los más antiguos
async function recortarCache(nombre, maximo) {
  const cache = await caches.open(nombre);
  const llaves = await cache.keys();                       // cache.keys()
  for (let i = 0; i < llaves.length - maximo; i++) {
    await cache.delete(llaves[i]);                         // cache.delete()
  }
}

// ---------- 1. INSTALL: precarga del App Shell ----------
self.addEventListener('install', (event) => {
  console.log('[SW SIGEP] Instalando', VERSION);
  event.waitUntil(
    caches.open(CACHE_SHELL)                               // caches.open()
      .then((cache) => cache.addAll(ARCHIVOS_SHELL))       // cache.addAll()
      .then(() => caches.open(CACHE_DINAMICA))
      .then((cache) => cache.add('./img/video-poster.jpg')) // cache.add()
      .then(() => self.skipWaiting())
  );
});

// ---------- 2. ACTIVATE: borra las cachés de versiones anteriores ----------
self.addEventListener('activate', (event) => {
  console.log('[SW SIGEP] Activado', VERSION);
  event.waitUntil(
    caches.keys()                                          // caches.keys()
      .then((nombres) => Promise.all(
        nombres
          // Solo las suyas: los otros módulos de SIGEP comparten el dominio
          .filter((n) => n.startsWith('sigep-m2-') && !CACHES_ACTUALES.includes(n))
          .map((n) => { console.log('[SW SIGEP] Borrando caché antigua', n); return caches.delete(n); }) // caches.delete()
      ))
      .then(() => self.clients.claim())
  );
});

// ---------- Estrategias ----------
// Cache First: responde desde la caché; si no está, va a la red
async function cacheFirst(request) {
  const guardada = await caches.match(request, { ignoreSearch: true }); // caches.match()
  if (guardada) return guardada;
  try {
    return await fetch(request);
  } catch (e) {
    if (request.mode === 'navigate') return caches.match(OFFLINE_URL);
    throw e;
  }
}

// Network First: intenta la red y guarda la copia; sin conexión usa la última guardada
async function networkFirst(request) {
  const cache = await caches.open(CACHE_DATOS);
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) await cache.put(request, await conFecha(respuesta)); // cache.put()
    return respuesta;
  } catch (e) {
    const guardada = await caches.match(request);          // caches.match(): esta caché o el App Shell
    if (guardada) return guardada;
    return new Response(JSON.stringify({ error: 'Sin conexión y sin datos guardados en este dispositivo.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

// Stale-While-Revalidate: responde al instante con la copia y la actualiza en segundo plano
async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE_DINAMICA);
  const guardada = await cache.match(event.request);
  const actualizar = fetch(event.request)
    .then(async (respuesta) => {
      if (respuesta.status === 200 || respuesta.type === 'opaque') {
        await cache.put(event.request, await conFecha(respuesta));
        await recortarCache(CACHE_DINAMICA, MAX_DINAMICA);
      }
      return respuesta;
    })
    .catch(() => guardada);
  event.waitUntil(actualizar.catch(() => {}));
  return guardada || actualizar;
}

// Video con peticiones parciales (Range): si está completo en caché, devuelve solo el fragmento pedido
async function videoDesdeCache(request) {
  const guardada = await caches.match(request.url);
  if (!guardada) return fetch(request);
  const blob = await guardada.blob();
  const [, ini, fin] = /bytes=(\d+)-(\d*)/.exec(request.headers.get('range')) || [];
  const inicio = Number(ini || 0), final = fin ? Number(fin) : blob.size - 1;
  return new Response(blob.slice(inicio, final + 1), {
    status: 206,
    headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes ${inicio}-${final}/${blob.size}`, 'Content-Length': String(final - inicio + 1), 'Accept-Ranges': 'bytes' }
  });
}

// ---------- 3. FETCH: elige la estrategia según la petición ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;                    // los cambios (POST, PUT, DELETE) siempre van a la red
  const url = new URL(request.url);
  const propio = url.origin === self.location.origin;
  if (!propio && !FUENTES.includes(url.hostname)) return;

  // La configuración compartida va por red primero (cambia al configurar Supabase)
  if (propio && url.pathname.endsWith('/js/config.js')) { event.respondWith(networkFirst(request)); return; }
  if (request.headers.has('range')) { event.respondWith(videoDesdeCache(request)); return; }
  const dinamico = !propio || /\/(img|media)\//.test(url.pathname);
  event.respondWith(dinamico ? staleWhileRevalidate(event) : cacheFirst(request));
});

// ---------- 4. MENSAJES desde la página ----------
self.addEventListener('message', (event) => {
  if (event.data?.tipo === 'version') event.ports[0]?.postMessage({ version: VERSION, caches: CACHES_ACTUALES });
  if (event.data?.tipo === 'saltarEspera') self.skipWaiting();
  if (event.data?.tipo === 'enviarCola') event.waitUntil(enviarCola());
});

/* =====================================================================
   PROPUESTA: Radar de Estadías
   5. PUSH: muestra la alerta aunque el panel esté cerrado y pone el
      número de alumnos en riesgo alto sobre el ícono (Badging API)
   6. NOTIFICATIONCLICK: abre el radar al tocar la notificación
   7. SYNC: envía las acciones guardadas sin conexión (Background Sync)
   ===================================================================== */
self.addEventListener('push', (event) => {
  let m = {};
  try { m = event.data ? event.data.json() : {}; } catch (e) { m = { cuerpo: event.data && event.data.text() }; }
  const titulo = m.titulo || 'SIGEP UTP · Radar de Estadías';
  event.waitUntil(Promise.all([
    self.registration.showNotification(titulo, {
      body: m.texto || m.cuerpo || 'Hay cambios en el Radar de Estadías.',
      icon: './icons/icon-192.png',
      badge: './icons/favicon-32.png',
      tag: m.etiqueta || m.tag || 'sigep-radar',
      renotify: true,
      data: { url: destino(m.url || 'index.html#/app/radar', m.modulo) },
      actions: [{ action: 'radar', title: 'Ver radar' }, { action: 'asignaciones', title: 'Asignar asesores' }]
    }),
    'setAppBadge' in self.navigator && typeof m.rojos === 'number'
      ? (m.rojos ? self.navigator.setAppBadge(m.rojos) : self.navigator.clearAppBadge()).catch(() => {})
      : Promise.resolve()
  ]));
});

// La url del aviso es relativa a la carpeta del módulo que lo generó
function destino(url, modulo) {
  const base = modulo && Number(modulo) !== 2 ? new URL(`../modulo-${Number(modulo)}/`, self.registration.scope) : self.registration.scope;
  return new URL(url, base).href;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ir = event.action === 'asignaciones' ? destino('index.html#/app/asignaciones') : (event.notification.data?.url || destino('index.html#/app/radar'));
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const abierta = ventanas.find((c) => c.url.startsWith(self.registration.scope));
    if (abierta) { await abierta.focus(); return abierta.navigate(ir).catch(() => abierta.postMessage({ tipo: 'ir', url: ir })); }
    return self.clients.openWindow(ir);
  })());
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sigep-cola') event.waitUntil(enviarCola());
});

// ---------- Cola de acciones sin conexión (IndexedDB) ----------
function abrirBD() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open('sigep-m2', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('cola', { keyPath: 'id', autoIncrement: true }); r.result.createObjectStore('sesion'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
  });
}
const pedir = (req) => new Promise((ok, mal) => { req.onsuccess = () => ok(req.result); req.onerror = () => mal(req.error); });

let enviando = null;
function enviarCola() {
  if (enviando) return enviando;            // evita enviar dos veces la misma acción
  enviando = (async () => {
    const bd = await abrirBD();
    // Credenciales que guardó la página: token de la sesión, URL y clave publicable de Supabase
    const cred = await pedir(bd.transaction('sesion').objectStore('sesion').get('credenciales'));
    const pendientes = await pedir(bd.transaction('cola').objectStore('cola').getAll());
    const resultado = { enviadas: 0, rechazadas: [] };
    for (const a of pendientes) {
      if (!cred || a.ruta !== '/asignaciones') break;          // la página la enviará al abrirse
      const ids = (a.cuerpo && a.cuerpo.alumno_ids) || [];
      let r;
      try {
        r = await fetch(`${cred.url}/rest/v1/rpc/m2_asignar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: cred.key, Authorization: 'Bearer ' + cred.token },
          body: JSON.stringify({ p_alumnos: ids, p_asesor: a.cuerpo.asesor_id, p_tipo: ids.length > 1 ? 'masiva' : 'individual' })
        });
      } catch (e) { throw e; }                  // sigue sin internet: el navegador reintentará después
      const d = await r.json().catch(() => ({}));
      if (r.status === 401) break;              // sesión vencida: se queda en la cola hasta volver a entrar
      if (r.ok) resultado.enviadas++; else resultado.rechazadas.push({ descripcion: a.descripcion, error: d.message || 'Error ' + r.status });
      await pedir(bd.transaction('cola', 'readwrite').objectStore('cola').delete(a.id));
    }
    const ventanas = await self.clients.matchAll({ type: 'window' });
    ventanas.forEach((c) => c.postMessage({ tipo: 'colaEnviada', ...resultado }));
    return resultado;
  })().finally(() => { enviando = null; });
  return enviando;
}
