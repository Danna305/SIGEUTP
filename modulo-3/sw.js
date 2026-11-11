/* =====================================================================
   SIGEP UTP · Service Worker del Módulo 3 (Pre-auditoría PWA)
   - Cache offline del shell, PDFs y assets
   - Notificaciones push / locales desde el Service Worker
   - Background Sync para reflejar dictámenes en la vista del alumno
   ===================================================================== */
'use strict';

const CACHE = 'sigep-preauditoria-v10';
const DB_NAME = 'sigep-preauditoria';
const DB_VERSION = 4;
const SYNC_TAG = 'sigep-sync-dictamenes';
const ICONO = './img/icon-192.png';
const ALUMNO_URL = new URL('./Frontend/modulo-4.html', self.location.href).href;

const PRECACHE = [
  './',
  './index.html',
  './offline.html',
  './Frontend/login.html',
  './Frontend/modulo-3.html',
  './Frontend/modulo-4.html',
  './css/sigep.css',
  './css/preauditoria.css',
  './js/sigep.js',
  './js/sync.js',
  './js/preauditoria.js',
  './manifest.webmanifest',
  './img/icono-sigep.svg',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/icon-maskable-512.png',
  './img/apple-touch-icon.png',
  './docs/tesina-sigep-v1.pdf',
  './docs/tesina-sigep-v2.pdf',
  './docs/tesina-sigep-v3.pdf'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // La BD (Supabase) es cross-origin: se atiende directo con Network First
  // desde la app y su respaldo offline vive en IndexedDB, no en Cache Storage.
  if (url.origin !== self.location.origin) return;

  // Navegación / documentos: Network First con fallback a caché y offline.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copia = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copia)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cacheada = await caches.match(request);
          if (cacheada) return cacheada;
          const offline = await caches.match('./offline.html');
          if (offline) return offline;
          return new Response('Sin conexión. Vuelve a intentarlo cuando recuperes la red.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Recursos estáticos (CSS, JS, imágenes, PDF): Cache First.
  event.respondWith(
    caches.match(request).then((cacheada) => {
      if (cacheada) return cacheada;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copia = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copia)).catch(() => {});
        }
        return response;
      });
    })
  );
});

/* ---------- Notificaciones ---------- */
self.addEventListener('push', (event) => {
  let payload = {
    titulo: 'SIGEP UTP · Pre-auditoría',
    cuerpo: 'Tienes una actualización en tu versión de tesina.',
    url: ALUMNO_URL,
    tag: 'sigep-dictamen'
  };

  if (event.data) {
    try {
      payload = Object.assign(payload, event.data.json());
    } catch (error) {
      payload.cuerpo = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.titulo, {
      body: payload.cuerpo,
      icon: payload.icono || ICONO,
      badge: ICONO,
      tag: payload.tag || 'sigep-dictamen',
      renotify: true,
      data: { url: payload.url || ALUMNO_URL }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || ALUMNO_URL;

  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const ventana of ventanas) {
      try {
        await ventana.focus();
        if ('navigate' in ventana) await ventana.navigate(destino);
        return;
      } catch (error) {
        /* continúa con la siguiente ventana */
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(destino);
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.tipo === 'mostrar-notificacion') {
    event.waitUntil(
      self.registration.showNotification(data.titulo || 'SIGEP UTP · Pre-auditoría', {
        body: data.cuerpo || 'Actualización disponible en tu pre-auditoría.',
        icon: data.icono || ICONO,
        badge: ICONO,
        tag: data.tag || 'sigep-dictamen',
        renotify: true,
        data: { url: data.url || ALUMNO_URL }
      })
    );
  }

  if (data.tipo === 'sincronizar' && 'sync' in self.registration) {
    event.waitUntil(self.registration.sync.register(SYNC_TAG).catch(() => {}));
  }

  if (data.tipo === 'skip-waiting') self.skipWaiting();
});

/* ---------- Background Sync ---------- */
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(procesarPendientes());
});

async function procesarPendientes() {
  let db;
  try {
    db = await abrirDB();
    const pendientes = await leerTodos(db, 'pendientes');
    const sincronizadas = [];
    const dictamenes = [];

    for (const pendiente of pendientes) {
      if (pendiente.tipo === 'observacion' && pendiente.estado === 'pendiente_envio' && pendiente.payload) {
        try {
          const payload = pendiente.payload;
          const version = await leer(db, 'versiones', payload.versionId);
          if (!version) {
            await eliminar(db, 'pendientes', pendiente.id);
            continue;
          }
          if (version.ultimaObservacion && version.ultimaObservacion.id === payload.id) {
            await eliminar(db, 'pendientes', pendiente.id);
            continue;
          }

          version.estado = payload.estado;
          version.observacionAsesor = payload.observacion;
          version.actualizado = payload.fecha || Date.now();
          version.estadoEnvio = 'sincronizado';
          version.ultimaObservacion = payload;
          await guardar(db, 'versiones', version);

          const alumno = await leer(db, 'alumnos', version.alumnoId);
          const texto = textoNotificacion(version, alumno);
          await agregar(db, 'notificaciones', {
            alumnoId: version.alumnoId,
            versionId: version.id,
            titulo: texto.titulo,
            cuerpo: texto.cuerpo,
            fecha: Date.now(),
            leida: false
          });
          await eliminar(db, 'pendientes', pendiente.id);
          sincronizadas.push({ version, titulo: texto.titulo, cuerpo: texto.cuerpo });
        } catch (error) {
          console.warn('[SIGEP SW] No se pudo sincronizar una observación:', error);
        }
      } else if (pendiente.tipo === 'dictamen') {
        dictamenes.push(pendiente);
        await eliminar(db, 'pendientes', pendiente.id);
      }
    }

    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    if (sincronizadas.length) {
      const ids = sincronizadas.map((item) => item.version.id);
      ventanas.forEach((ventana) => ventana.postMessage({ tipo: 'observacion-sincronizada', versionIds: ids }));

      const primera = sincronizadas[sincronizadas.length - 1];
      try {
        await self.registration.showNotification(primera.titulo, {
          body: primera.cuerpo,
          icon: ICONO,
          badge: ICONO,
          tag: `sigep-observacion-${primera.version.id}`,
          renotify: true,
          data: { url: `${ALUMNO_URL}?version=${encodeURIComponent(primera.version.id)}` }
        });
      } catch (error) {
        console.warn('[SIGEP SW] No se pudo mostrar la notificación de observaciones:', error);
      }
    }

    if (dictamenes.length) {
      ventanas.forEach((ventana) => {
        ventana.postMessage({ tipo: 'sincronizar-dictamenes', pendientes: dictamenes });
      });

      if (!ventanas.length) {
        try {
          await self.registration.showNotification('SIGEP UTP · Pre-auditoría', {
            body: 'Tu asesor actualizó el dictamen de una versión. Abre la app para revisarlo.',
            icon: ICONO,
            badge: ICONO,
            tag: 'sigep-sync',
            data: { url: ALUMNO_URL }
          });
        } catch (error) {
          console.warn('[SIGEP SW] No se pudo mostrar la notificación de sincronización:', error);
        }
      }
    }
  } catch (error) {
    console.warn('[SIGEP SW] No se pudo procesar el Background Sync:', error);
  } finally {
    if (db) db.close();
  }
}

function textoNotificacion(version, alumno) {
  const nombre = alumno && alumno.nombre ? alumno.nombre.split(' ')[0] : '';
  const saludo = nombre ? `Hola ${nombre}, ` : '';
  const numero = version.numero;
  const etiqueta = ['Primera Versión', 'Segunda Versión', 'Tercera Versión'][numero - 1] || `Versión ${numero}`;

  if (version.estado === 'Aprobada') {
    return {
      titulo: `Tu versión ${numero} ha sido aprobada`,
      cuerpo: `${saludo}tu asesor aprobó la ${etiqueta}.`
    };
  }
  if (version.estado === 'No pasa') {
    return {
      titulo: `Tu versión ${numero} no pasó la revisión`,
      cuerpo: `Revisa las observaciones de tu asesor en la ${etiqueta} antes de continuar.`
    };
  }
  if (version.estado === 'Requiere Correcciones') {
    return {
      titulo: `Nueva observación disponible en V${numero}`,
      cuerpo: `Revisa las observaciones de tu asesor en la ${etiqueta}.`
    };
  }
  return {
    titulo: `Tu versión ${numero} está pendiente de revisión`,
    cuerpo: `Tu asesor guardó cambios en la ${etiqueta}.`
  };
}

/* ---------- IndexedDB mínimo para el SW ---------- */
function abrirDB() {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(DB_NAME, DB_VERSION);

    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;
      const ensureStore = (nombre, opciones) => db.objectStoreNames.contains(nombre)
        ? solicitud.transaction.objectStore(nombre)
        : db.createObjectStore(nombre, opciones);
      const ensureIndex = (store, indice, ruta) => {
        if (!store.indexNames.contains(indice)) store.createIndex(indice, ruta, { unique: false });
      };

      ensureStore('alumnos', { keyPath: 'id' });
      const versiones = ensureStore('versiones', { keyPath: 'id' });
      ensureIndex(versiones, 'alumnoId', 'alumnoId');
      const mensajes = ensureStore('mensajes', { keyPath: 'id', autoIncrement: true });
      ensureIndex(mensajes, 'versionId', 'versionId');
      const borradores = ensureStore('borradores', { keyPath: 'id', autoIncrement: true });
      ensureIndex(borradores, 'versionId', 'versionId');
      const notificaciones = ensureStore('notificaciones', { keyPath: 'id', autoIncrement: true });
      ensureIndex(notificaciones, 'alumnoId', 'alumnoId');
      const dictamenes = ensureStore('dictamenes', { keyPath: 'id' });
      ensureIndex(dictamenes, 'alumno_id', 'alumno_id');
      ensureIndex(dictamenes, 'version_id', 'version_id');
      const evaluaciones = ensureStore('evaluaciones_checklist', { keyPath: 'id' });
      ensureIndex(evaluaciones, 'alumno_id', 'alumno_id');
      ensureIndex(evaluaciones, 'version_id', 'version_id');
      const citas = ensureStore('citas', { keyPath: 'id' });
      ensureIndex(citas, 'alumno_id', 'alumno_id');
      ensureIndex(citas, 'fecha', 'fecha');
      ensureStore('suscripciones', { keyPath: 'id' });
      ensureStore('pendientes', { keyPath: 'id', autoIncrement: true });
      ensureStore('archivos', { keyPath: 'id' });
      ensureStore('ajustes', { keyPath: 'clave' });
      const cola = ensureStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      ensureIndex(cola, 'status', 'status');
      ensureIndex(cola, 'tabla', 'tabla');
    };

    solicitud.onsuccess = () => {
      const db = solicitud.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    solicitud.onerror = () => reject(solicitud.error);
    solicitud.onblocked = () => console.warn('[SIGEP SW] IndexedDB bloqueada por otra pestaña.');
  });
}

function leerTodos(db, nombre) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nombre, 'readonly');
    const solicitud = tx.objectStore(nombre).getAll();
    solicitud.onsuccess = () => resolve(solicitud.result || []);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

function leer(db, nombre, clave) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nombre, 'readonly');
    const solicitud = tx.objectStore(nombre).get(clave);
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

function guardar(db, nombre, valor) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nombre, 'readwrite');
    tx.objectStore(nombre).put(valor);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function agregar(db, nombre, valor) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nombre, 'readwrite');
    tx.objectStore(nombre).add(valor);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function eliminar(db, nombre, clave) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nombre, 'readwrite');
    tx.objectStore(nombre).delete(clave);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function limpiar(db, nombre) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nombre, 'readwrite');
    const solicitud = tx.objectStore(nombre).clear();
    solicitud.onsuccess = () => resolve();
    solicitud.onerror = () => reject(solicitud.error);
  });
}
