/* =====================================================================
   SIGEP UTP · Motor de sincronización híbrido
   IndexedDB (offline)  ⇄  Supabase (nube)
   ===================================================================== */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://xztdkcfptdfhztlpxduq.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6dGRrY2ZwdGRmaHp0bHB4ZHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQxMTI4NjcsImV4cCI6MjEwOTY4ODg2N30.rNHptcDeWbKgF26hUXcz7KdjnigXmzHacMgWCZQ7QUM';
  const PLACEHOLDERS = /TU-PROYECTO|TU_ANON_KEY/;

  const DB_NAME = 'sigep-preauditoria';
  const DB_VERSION = 4;
  const STORE = 'sync_queue';
  const MAX_REINTENTOS = 5;
  const TABLAS_SYNC = ['dictamenes', 'evaluaciones_checklist', 'notificaciones', 'citas'];

  let cliente = null;
  let dbPromise = null;
  let sincronizando = false;
  let intervalo = null;

  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_KEY = SUPABASE_KEY;

  const configurado = () => Boolean(SUPABASE_URL && SUPABASE_KEY) && !PLACEHOLDERS.test(`${SUPABASE_URL}${SUPABASE_KEY}`);

  function toast(mensaje, tipo = '') {
    let cont = document.getElementById('pa-toast');
    if (!cont) {
      cont = document.createElement('div');
      cont.id = 'pa-toast';
      cont.className = 'pa-toast';
      cont.setAttribute('aria-live', 'polite');
      document.body.appendChild(cont);
    }
    const item = document.createElement('div');
    item.className = `pa-toast-item ${tipo}`.trim();
    item.textContent = mensaje;
    cont.appendChild(item);
    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(6px)';
      setTimeout(() => item.remove(), 220);
    }, 4200);
  }

  function abrirDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
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
        const cola = ensureStore(STORE, { keyPath: 'id', autoIncrement: true });
        ensureIndex(cola, 'status', 'status');
        ensureIndex(cola, 'tabla', 'tabla');
      };
      solicitud.onsuccess = () => {
        const db = solicitud.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      solicitud.onerror = () => {
        dbPromise = null;
        reject(solicitud.error);
      };
      solicitud.onblocked = () => {
        console.warn('[SIGEP Sync] IndexedDB bloqueada por otra pestaña.');
      };
    });
    return dbPromise;
  }

  async function listo() {
    try {
      await abrirDB();
      return true;
    } catch (error) {
      return false;
    }
  }

  function operarStore(nombre, modo, accion) {
    return abrirDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(nombre, modo);
      const solicitud = accion(tx.objectStore(nombre));
      let resultado;
      if (solicitud) {
        solicitud.onsuccess = () => { resultado = solicitud.result; };
        solicitud.onerror = () => reject(solicitud.error);
      }
      tx.oncomplete = () => resolve(resultado);
      tx.onerror = () => reject(tx.error);
    }));
  }

  const operar = (modo, accion) => operarStore(STORE, modo, accion);

  function notificacionLocal(fila) {
    const fecha = fila.fecha == null ? Date.now() : new Date(fila.fecha).getTime();
    return {
      id: Number(fila.id),
      alumnoId: fila.alumnoId || fila.alumno_id || '',
      versionId: fila.versionId || fila.version_id || null,
      titulo: fila.titulo || 'Aviso',
      cuerpo: fila.cuerpo || '',
      fecha: Number.isFinite(fecha) ? fecha : Date.now(),
      leida: Boolean(fila.leida)
    };
  }

  function aLocal(tabla, fila) {
    return tabla === 'notificaciones' ? notificacionLocal(fila) : fila;
  }

  function aRemoto(tabla, fila) {
    if (tabla !== 'notificaciones') return fila;
    return {
      id: Number(fila.id),
      alumno_id: fila.alumnoId || fila.alumno_id || '',
      version_id: fila.versionId || fila.version_id || null,
      titulo: fila.titulo || 'Aviso',
      cuerpo: fila.cuerpo || '',
      fecha: new Date(fila.fecha || Date.now()).toISOString(),
      leida: Boolean(fila.leida)
    };
  }

  async function guardarLocal(tabla, payload) {
    if (!TABLAS_SYNC.includes(tabla)) return false;
    try {
      const db = await abrirDB();
      if (!db.objectStoreNames.contains(tabla)) return false;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(tabla, 'readwrite');
        tx.objectStore(tabla).put(aLocal(tabla, payload));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch (error) {
      console.warn(`[SIGEP Sync] No se pudo guardar ${tabla} en IndexedDB:`, error);
      return false;
    }
  }

  async function leerLocal(tabla) {
    if (!TABLAS_SYNC.includes(tabla)) return [];
    try {
      const filas = await operarStore(tabla, 'readonly', (store) => store.getAll());
      return filas || [];
    } catch (error) {
      console.warn(`[SIGEP Sync] No se pudo leer ${tabla} de IndexedDB:`, error);
      return [];
    }
  }

  const leerTodos = () => operar('readonly', (store) => store.getAll()).then((r) => r || []);
  const encolar = (item) => operar('readwrite', (store) => store.add(item));
  const actualizar = (item) => operar('readwrite', (store) => store.put(item));
  const eliminar = (id) => operar('readwrite', (store) => store.delete(id));

  async function contarPendientes() {
    try {
      const items = await leerTodos();
      return items.length;
    } catch (error) {
      return 0;
    }
  }

  async function actualizarBanner(estadoForzado) {
    const banner = document.getElementById('sync-status');
    if (!banner) return 0;
    const pendientes = await contarPendientes();
    const texto = document.getElementById('sync-status-text');
    const contador = document.getElementById('sync-status-count');

    let estado, etiqueta;
    if (estadoForzado === 'syncing' || sincronizando) {
      estado = 'syncing';
      etiqueta = 'Sincronizando datos con Supabase…';
    } else if (!navigator.onLine) {
      estado = 'offline';
      etiqueta = pendientes ? `Sin conexión (${pendientes} cambios pendientes)` : 'Sin conexión';
    } else if (pendientes) {
      estado = 'offline';
      etiqueta = `${pendientes} cambio(s) pendiente(s) por sincronizar`;
    } else {
      estado = 'online';
      etiqueta = 'En línea (Sincronizado)';
    }

    banner.dataset.state = estado;
    if (texto) texto.textContent = etiqueta;
    if (contador) {
      contador.textContent = String(pendientes);
      contador.hidden = pendientes === 0;
    }
    return pendientes;
  }

  function cargarSDK() {
    if (window.supabase && typeof window.supabase.createClient === 'function') return Promise.resolve(true);
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async function crearCliente() {
    if (cliente) return cliente;
    if (!configurado()) return null;
    await cargarSDK();
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      window.supabaseClient = cliente; // EXPOSICIÓN GLOBAL CORREGIDA
      return cliente;
    }
    return null;
  }

  async function subirItem(item) {
    const api = await crearCliente();
    if (!api) throw new Error('Supabase no configurado');
    const { error } = await api
      .from(item.tabla)
      .upsert(aRemoto(item.tabla, item.payload), { onConflict: item.onConflict || 'id' });
    if (error) throw error;
  }

  async function traerTabla(tabla, apiExistente) {
    if (!TABLAS_SYNC.includes(tabla)) return [];
    const api = apiExistente || await crearCliente();
    if (!api) return [];
    const { data, error } = await api.from(tabla).select('*');
    if (error) throw error;
    const filas = Array.isArray(data) ? data : [];
    if (!filas.length) return filas;
    try {
      const db = await abrirDB();
      if (!db.objectStoreNames.contains(tabla)) return filas;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(tabla, 'readwrite');
        const store = tx.objectStore(tabla);
        filas.forEach((fila) => store.put(aLocal(tabla, fila)));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.warn(`[SIGEP Sync] No se pudo actualizar ${tabla} en IndexedDB:`, error);
    }
    return filas;
  }

  async function sincronizar() {
    if (!navigator.onLine) return {};
    const api = await crearCliente();
    if (!api) return {};
    await flush();
    const resultado = {};
    for (const tabla of TABLAS_SYNC) {
      try {
        resultado[tabla] = await traerTabla(tabla, api);
      } catch (error) {
        console.warn(`[SIGEP Sync] No se pudo leer ${tabla} desde Supabase:`, error.message || error);
        resultado[tabla] = [];
      }
    }
    return resultado;
  }

  async function guardar(tabla, payload, opciones = {}) {
    if (!tabla || !payload) return { sincronizado: false, encolado: false };
    if (opciones.local !== false) await guardarLocal(tabla, payload);
    const item = {
      tabla,
      payload,
      onConflict: opciones.onConflict || 'id',
      timestamp: Date.now(),
      status: 'pending',
      intentos: 0
    };
    if (navigator.onLine) {
      try {
        await subirItem(item);
        await actualizarBanner();
        return { sincronizado: true, encolado: false };
      } catch (error) {
        await encolar(item);
        await actualizarBanner();
        return { sincronizado: false, encolado: true };
      }
    }
    await encolar(item);
    await actualizarBanner();
    return { sincronizado: false, encolado: true };
  }

  async function flush() {
    if (sincronizando) return 0;
    const todos = await leerTodos();
    if (!todos.length) return 0;
    const pendientes = todos.filter((item) => (item.intentos || 0) < MAX_REINTENTOS);
    if (!pendientes.length || !navigator.onLine) return 0;

    const api = await crearCliente();
    if (!api) return 0;

    sincronizando = true;
    await actualizarBanner('syncing');

    let subidos = 0;
    for (const item of pendientes) {
      try {
        await subirItem(item);
        await eliminar(item.id);
        subidos += 1;
      } catch (error) {
        item.intentos = (item.intentos || 0) + 1;
        if (item.intentos < MAX_REINTENTOS) await actualizar(item);
      }
    }

    sincronizando = false;
    await actualizarBanner();
    return subidos;
  }

  function iniciar() {
    crearCliente().catch(() => {});
    actualizarBanner();
    window.addEventListener('online', () => flush());
    window.addEventListener('offline', () => actualizarBanner());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();

  window.SIGEPSync = { guardar, flush, actualizarBanner, contarPendientes, crearCliente, listo, sincronizar, leerLocal, traerTabla };
})();