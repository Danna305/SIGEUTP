/* =====================================================================
   SIGEP UTP · Módulo 3 · Pre-auditoría PWA
   - IndexedDB compartida entre la vista del Asesor y la del Alumno
   - Visor PDF offline, checklist de criterios y chatbot local
   - Notificaciones push/locales y Background Sync
   - Datos reales del Supabase de SIGEP: alumnos asignados y versiones de
     la tesina que el alumno sube en el Módulo 4 (tabla tesina_versiones)
   ===================================================================== */
(() => {
  'use strict';

  const DB_NAME = 'sigep-preauditoria';
  const DB_VERSION = 4;
  const SYNC_TAG = 'sigep-sync-dictamenes';
  const ICONO = '../img/icono-sigep.svg';
  const API_OBSERVACIONES = '';
  // Estados de tesina_versiones (Módulo 4) ⇄ estados de la pre-auditoría
  const ESTADO_LOCAL = { 'En revisión': 'Pendiente', 'Aprobada': 'Aprobada', 'Requiere corrección': 'Requiere Correcciones' };
  const ESTADO_TESINA = { 'Aprobada': 'Aprobada', 'Requiere Correcciones': 'Requiere corrección', 'No pasa': 'Requiere corrección' };
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SOPORTA_GRABACION = 'MediaRecorder' in window && !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia;
  const CANAL = 'BroadcastChannel' in window ? new BroadcastChannel('sigep-preauditoria') : null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const normalizar = (texto) => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const escapar = (texto) => String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fecha = (valor) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(valor || Date.now()));
  const fechaCita = (valor) => {
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return 'Fecha por confirmar';
    return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(fecha);
  };
  const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function sesionActual() {
    try {
      return window.SIGEPAuth && typeof window.SIGEPAuth.sesionActual === 'function' ? window.SIGEPAuth.sesionActual() : null;
    } catch (error) {
      return null;
    }
  }

  const api = () => (window.SIGEPAuth && window.SIGEPAuth.cliente) || null;

  const estado = { rol: '', alumno: null, alumnos: [], versiones: [], version: null, nombreSesion: '' };
  const dictado = {
    grabando: false,
    deteniendo: false,
    enviando: false,
    reconocimiento: null,
    grabadora: null,
    stream: null,
    chunks: [],
    final: '',
    interim: '',
    inicio: 0,
    temporizador: null,
    audioId: null,
    audioListo: null,
    resolverAudio: null,
    versionId: null,
    transcripcion: ''
  };
  let urlPdfActual = null;
  let dbPromise = null;

  /* ---------- Catálogo de criterios ---------- */
  const CRITERIOS = [
    { id: 'portada', criterio: 'Título y datos generales', pagina: 1, keywords: ['titulo', 'portada', 'datos generales', 'alumna', 'autor', 'tesina'], sugerencia: 'Incluye título, nombre de la alumna, carrera, periodo y nombre del asesor.' },
    { id: 'planteamiento', criterio: 'Planteamiento del problema', pagina: 1, keywords: ['planteamiento', 'problema', 'pregunta de investigacion', 'contexto'], sugerencia: 'Describe el problema, su contexto y la pregunta de investigación con datos verificables.' },
    { id: 'objetivos', criterio: 'Objetivos general y específicos', pagina: 2, keywords: ['objetivo', 'objetivos', 'general', 'especificos', 'meta'], sugerencia: 'Redacta un objetivo general y objetivos específicos medibles.' },
    { id: 'justificacion', criterio: 'Justificación', pagina: 2, keywords: ['justificacion', 'beneficio', 'importancia', 'por que'], sugerencia: 'Explica la relevancia académica, social y práctica del proyecto.' },
    { id: 'marco', criterio: 'Marco teórico y antecedentes', pagina: 2, keywords: ['marco teorico', 'antecedentes', 'teoria', 'estado del arte', 'bibliografia'], sugerencia: 'Agrega antecedentes y conceptos que sustenten la propuesta.' },
    { id: 'metodologia', criterio: 'Metodología', pagina: 3, keywords: ['metodologia', 'metodo', 'enfoque', 'desarrollo', 'incremental', 'fases'], sugerencia: 'Define el enfoque, las fases y las técnicas de recolección de datos.' },
    { id: 'cronograma', criterio: 'Cronograma de actividades', pagina: 3, keywords: ['cronograma', 'actividades', 'semanas', 'tiempo', 'calendario'], sugerencia: 'Incluye un cronograma con actividades, responsables y fechas.' },
    { id: 'referencias', criterio: 'Referencias en formato APA', pagina: 3, keywords: ['referencias', 'apa', 'citas', 'fuentes', 'bibliografia'], sugerencia: 'Completa las referencias con el formato APA 7 y cita las fuentes en el texto.' },
    { id: 'conclusiones', criterio: 'Conclusiones', pagina: 3, keywords: ['conclusiones', 'conclusion', 'resultados', 'cierre'], sugerencia: 'Cierra con conclusiones vinculadas a los objetivos y resultados esperados.' },
    { id: 'formato', criterio: 'Formato, ortografía y citas', pagina: 1, keywords: ['formato', 'ortografia', 'redaccion', 'citas', 'estilo', 'presentacion'], sugerencia: 'Revisa ortografía, formato institucional y citas en el cuerpo del documento.' }
  ];

  const NOTAS = {
    portada: { si: 'Incluye título, alumna y datos de la tesina.', no: 'Falta completar los datos generales de la portada.' },
    planteamiento: { si: 'El problema y la pregunta de investigación están delimitados.', no: 'El problema no está delimitado con suficiente claridad.' },
    objetivos: { si: 'Los objetivos son claros y medibles.', no: 'Faltan objetivos específicos medibles.' },
    justificacion: { si: 'La relevancia del proyecto está argumentada.', no: 'La justificación es breve y no argumenta la relevancia.' },
    marco: { si: 'Los antecedentes sustentan la propuesta.', no: 'No se localizó un marco teórico con antecedentes.' },
    metodologia: { si: 'La metodología describe enfoque y fases.', no: 'La metodología requiere más detalle sobre fases y técnicas.' },
    cronograma: { si: 'El cronograma presenta actividades y tiempos.', no: 'No se localizó un cronograma de actividades.' },
    referencias: { si: 'Las referencias están completas en formato APA.', no: 'Las referencias están incompletas o no siguen APA.' },
    conclusiones: { si: 'Las conclusiones se vinculan con los objetivos.', no: 'No se localizaron conclusiones.' },
    formato: { si: 'El formato y la redacción son consistentes.', no: 'Se detectaron detalles de formato, ortografía o citas.' }
  };

  function crearChecklist(cumple) {
    return CRITERIOS.map((criterio) => ({
      id: criterio.id,
      criterio: criterio.criterio,
      pagina: criterio.pagina,
      cumple: Boolean(cumple[criterio.id]),
      nota: cumple[criterio.id] ? (NOTAS[criterio.id] && NOTAS[criterio.id].si) : (NOTAS[criterio.id] && NOTAS[criterio.id].no) || criterio.sugerencia
    }));
  }

  // Checklist de una versión recién llegada: todo pendiente de revisar
  function checklistInicial() {
    return CRITERIOS.map((criterio) => ({ id: criterio.id, criterio: criterio.criterio, pagina: criterio.pagina, cumple: false, nota: criterio.sugerencia }));
  }

  // Datos de ejemplo de la versión anterior del módulo (se borran del dispositivo)
  const DEMO_ANTERIOR = {
    alumnos: ['mj', 'al', 'cm', 'js'],
    versiones: ['mj-v1', 'mj-v2', 'mj-v3'],
    notificaciones: [1, 2],
    citas: ['cita-al-1', 'cita-mj-1', 'cita-cm-1']
  };

  /* ---------- IndexedDB ---------- */
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
        const cola = ensureStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        ensureIndex(cola, 'status', 'status');
        ensureIndex(cola, 'tabla', 'tabla');
      };

      solicitud.onsuccess = () => {
        const db = solicitud.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        asegurarDatos(db)
          .catch((error) => console.warn('[SIGEP] No se pudieron sembrar los datos locales:', error))
          .then(() => resolve(db));
      };
      solicitud.onerror = () => {
        dbPromise = null;
        reject(solicitud.error);
      };
      solicitud.onblocked = () => {
        console.warn('[SIGEP] IndexedDB bloqueada por otra pestaña.');
      };
    });
    return dbPromise;
  }

  function operar(store, modo, accion) {
    return abrirDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(store, modo);
      const solicitud = accion(tx.objectStore(store));
      let resultado;
      if (solicitud) {
        solicitud.onsuccess = () => { resultado = solicitud.result; };
        solicitud.onerror = () => reject(solicitud.error);
      }
      tx.oncomplete = () => resolve(resultado);
      tx.onerror = () => reject(tx.error);
    }));
  }

  const obtenerTodos = (store) => operar(store, 'readonly', (s) => s.getAll()).then((r) => r || []);
  const obtener = (store, key) => operar(store, 'readonly', (s) => s.get(key));
  const guardar = (store, objeto) => operar(store, 'readwrite', (s) => s.put(objeto));
  const agregar = (store, objeto) => operar(store, 'readwrite', (s) => s.add(objeto));
  const eliminar = (store, key) => operar(store, 'readwrite', (s) => s.delete(key));
  const porIndice = (store, indice, valor) => abrirDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const objectStore = tx.objectStore(store);
    if (!objectStore.indexNames.contains(indice)) {
      const solicitudTodos = objectStore.getAll();
      solicitudTodos.onsuccess = () => resolve((solicitudTodos.result || []).filter((item) => item[indice] === valor));
      solicitudTodos.onerror = () => reject(solicitudTodos.error);
      return;
    }
    const solicitud = objectStore.index(indice).getAll(valor);
    solicitud.onsuccess = () => resolve(solicitud.result || []);
    solicitud.onerror = () => reject(solicitud.error);
  }));

  function contarStore(db, store) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const solicitud = tx.objectStore(store).count();
      solicitud.onsuccess = () => resolve(solicitud.result || 0);
      solicitud.onerror = () => reject(solicitud.error);
    });
  }

  async function asegurarDatos(db) {
    const hecho = await new Promise((resolve) => {
      const solicitud = db.transaction('ajustes', 'readonly').objectStore('ajustes').get('demo-borrada');
      solicitud.onsuccess = () => resolve(Boolean(solicitud.result));
      solicitud.onerror = () => resolve(false);
    });
    if (hecho) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction([...Object.keys(DEMO_ANTERIOR), 'archivos', 'ajustes'], 'readwrite');
      Object.entries(DEMO_ANTERIOR).forEach(([store, ids]) => ids.forEach((id) => tx.objectStore(store).delete(id)));
      DEMO_ANTERIOR.versiones.forEach((id) => tx.objectStore('archivos').delete(id));
      tx.objectStore('ajustes').put({ clave: 'demo-borrada', valor: true });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  // Si en este dispositivo entra otra cuenta, se borra lo que guardó la anterior
  const STORES_USUARIO = ['alumnos', 'versiones', 'mensajes', 'borradores', 'notificaciones', 'dictamenes', 'evaluaciones_checklist', 'citas', 'pendientes', 'archivos', 'sync_queue', 'suscripciones'];
  async function prepararUsuario(userId) {
    const db = await abrirDB();
    const previo = await obtener('ajustes', 'usuario').catch(() => null);
    if (previo && previo.valor === userId) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction([...STORES_USUARIO, 'ajustes'], 'readwrite');
      STORES_USUARIO.forEach((store) => tx.objectStore(store).clear());
      tx.objectStore('ajustes').put({ clave: 'usuario', valor: userId });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  // Cuatrimestre actual de la UTP: enero–abril, mayo–agosto, septiembre–diciembre
  function periodoActual() {
    const hoy = new Date();
    const periodos = ['Enero – Abril', 'Mayo – Agosto', 'Septiembre – Diciembre'];
    return `${periodos[Math.floor(hoy.getMonth() / 4)]} ${hoy.getFullYear()}`;
  }

  function alumnoDesdeFila(fila, asesor) {
    const nombre = fila.nombre || fila.correo || 'Alumno sin nombre';
    return {
      id: String(fila.id),
      nombre,
      iniciales: iniciales(nombre),
      matricula: fila.matricula || '',
      carrera: fila.nivel === 'TSU' ? 'Técnico Superior Universitario' : 'Ingeniería',
      empresa: 'Estadía profesional',
      proyecto: 'Tesina de estadía',
      asesor: asesor || 'Asesor asignado',
      periodo: periodoActual(),
      correo: fila.correo || ''
    };
  }

  // Une la versión de la tesina (servidor) con lo que la pre-auditoría guardó
  // en el dispositivo: checklist, observaciones y texto extraído del PDF.
  function versionDesdeFila(fila, previa) {
    const estadoServidor = ESTADO_LOCAL[fila.estado] || 'Pendiente';
    const cambioEnServidor = !previa || previa.estadoServidor !== fila.estado;
    const pendienteLocal = Boolean(previa && previa.estadoEnvio === 'pendiente_envio');
    return {
      ...(previa || {}),
      id: fila.id,
      alumnoId: fila.alumno_id,
      numero: fila.numero,
      titulo: etiquetaVersion(fila.numero),
      archivo: fila.nombre_archivo,
      archivo_path: fila.archivo_path,
      tipo: fila.tipo,
      tamano: fila.tamano_bytes,
      comentarioAlumno: fila.comentario || '',
      estadoServidor: fila.estado,
      estado: pendienteLocal || !cambioEnServidor ? previa.estado : estadoServidor,
      actualizado: previa ? (cambioEnServidor && !pendienteLocal ? Date.now() : previa.actualizado) : new Date(fila.subida_en).getTime(),
      observacionAsesor: previa ? previa.observacionAsesor || '' : '',
      checklist: previa && Array.isArray(previa.checklist) && previa.checklist.length ? previa.checklist : checklistInicial(),
      contenido: previa && Array.isArray(previa.contenido) ? previa.contenido : []
    };
  }

  // Trae de Supabase los alumnos que el usuario puede ver (RLS: el asesor, sus
  // asignados; el alumno, solo a sí mismo) y sus versiones de la tesina.
  async function sincronizarCatalogo() {
    const cliente = api();
    if (!navigator.onLine || !cliente) return false;
    const [alumnosR, versionesR, asignacionesR] = await Promise.all([
      cliente.from('alumnos').select('id, matricula, nombre, correo, nivel'),
      cliente.from('tesina_versiones').select('id, alumno_id, numero, archivo_path, nombre_archivo, tipo, tamano_bytes, comentario, estado, subida_en').order('numero'),
      cliente.from('asignaciones_asesor').select('alumno_id, asesores (nombre)')
    ]);
    if (alumnosR.error || versionesR.error) throw alumnosR.error || versionesR.error;

    const asesorDe = new Map((asignacionesR.data || []).map((a) => [a.alumno_id, a.asesores && a.asesores.nombre]));
    const sesion = sesionActual();
    const alumnos = (alumnosR.data || []).map((fila) => alumnoDesdeFila(fila, asesorDe.get(fila.id) || (sesion && sesion.rol === 'asesor' ? sesion.nombre : '')));
    const ids = new Set(alumnos.map((a) => a.id));
    const filasVersion = (versionesR.data || []).filter((v) => ids.has(v.alumno_id));
    const previas = new Map((await obtenerTodos('versiones')).map((v) => [v.id, v]));
    const versiones = filasVersion.map((fila) => versionDesdeFila(fila, previas.get(fila.id)));
    const vigentes = new Set(versiones.map((v) => v.id));
    const alumnosPrevios = await obtenerTodos('alumnos');

    const db = await abrirDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['alumnos', 'versiones'], 'readwrite');
      const storeAlumnos = tx.objectStore('alumnos');
      const storeVersiones = tx.objectStore('versiones');
      alumnosPrevios.forEach((alumno) => { if (!ids.has(alumno.id)) storeAlumnos.delete(alumno.id); });
      previas.forEach((_, id) => { if (!vigentes.has(id)) storeVersiones.delete(id); });
      alumnos.forEach((alumno) => storeAlumnos.put(alumno));
      versiones.forEach((version) => storeVersiones.put(version));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return true;
  }

  async function esperarAlumnos() {
    try {
      await sincronizarCatalogo();
    } catch (error) {
      console.warn('[SIGEP] No se pudo actualizar la lista desde Supabase; se usa la copia del dispositivo:', error.message || error);
    }
    try {
      return await obtenerTodos('alumnos');
    } catch (error) {
      console.warn('[SIGEP] IndexedDB no disponible para leer alumnos:', error);
      return [];
    }
  }

  /* ---------- Utilidades de interfaz ---------- */
  function prepararToast() {
    if ($('#pa-toast')) return;
    const cont = document.createElement('div');
    cont.id = 'pa-toast';
    cont.className = 'pa-toast';
    cont.setAttribute('aria-live', 'polite');
    document.body.appendChild(cont);
  }

  function toast(mensaje, tipo = '') {
    prepararToast();
    const item = document.createElement('div');
    item.className = `pa-toast-item ${tipo}`.trim();
    item.textContent = mensaje;
    $('#pa-toast').appendChild(item);
    setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(6px)';
      setTimeout(() => item.remove(), 220);
    }, 4200);
  }

  const claseEstado = (valor) => valor === 'Aprobada' ? 'ok' : (valor === 'Requiere Correcciones' || valor === 'No pasa' ? 'bad' : 'warn');
  const etiquetaVersion = (numero) => ['Primera Versión', 'Segunda Versión', 'Tercera Versión'][numero - 1] || `Versión ${numero}`;
  const iniciales = (nombre) => String(nombre || '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  function aplicarChip(elemento, valor) {
    if (!elemento) return;
    elemento.textContent = valor;
    elemento.className = `chip ${claseEstado(valor)}`;
  }

  function actualizarConexion() {
    const offline = !navigator.onLine;
    const banner = $('#pa-offline');
    if (banner) {
      banner.hidden = !offline;
      banner.classList.toggle('d-none', !offline);
    }

    const chatEstado = $('#pa-chat-estado');
    if (chatEstado) {
      chatEstado.textContent = offline ? 'Sin conexión' : 'En línea';
      chatEstado.className = `chip ${offline ? 'warn' : 'mod'}`;
    }

    const chatPie = $('#pa-chat-pie');
    if (chatPie) chatPie.textContent = offline ? 'Sin conexión: las consultas se guardan como borrador local.' : 'Análisis local con el corpus guardado en IndexedDB.';

    const conexionAlumno = $('#pa-alumno-conexion');
    if (conexionAlumno) {
      conexionAlumno.textContent = offline ? 'Sin conexión' : 'Sincronizado';
      conexionAlumno.className = `chip ${offline ? 'warn' : 'ok'}`;
    }
  }

  async function sincronizarCambio(tabla, payload) {
    if (!window.SIGEPSync || typeof window.SIGEPSync.guardar !== 'function') return;
    try {
      if (typeof window.SIGEPSync.listo === 'function') await window.SIGEPSync.listo();
      await window.SIGEPSync.guardar(tabla, payload);
    } catch (error) {
      console.warn(`[SIGEP] No se pudo encolar el cambio en ${tabla}:`, error);
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  }

  async function activarPush() {
    if (!('Notification' in window)) {
      toast('Este navegador no soporta notificaciones.', 'warn');
      return;
    }

    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      toast('Permiso de notificaciones denegado. Puedes activarlo desde la configuración del navegador.', 'warn');
      await actualizarBotonPush();
      return;
    }

    // Suscripción push real: la clave pública la da la función enviar-push y la
    // suscripción se guarda en Supabase (registrar_push), igual que en el Módulo 4
    let suscripcion = null;
    const cliente = api();
    if ('serviceWorker' in navigator && 'PushManager' in window && cliente && navigator.onLine) {
      try {
        const { data, error } = await cliente.functions.invoke('enviar-push', { body: { accion: 'clave' } });
        if (error || !data || !data.clave) throw new Error('El servidor de notificaciones no está configurado.');
        const registro = await navigator.serviceWorker.ready;
        suscripcion = await registro.pushManager.getSubscription()
          || await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(data.clave) });
        const { endpoint, keys } = suscripcion.toJSON();
        const r = await cliente.rpc('registrar_push', { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
        if (r.error) throw r.error;
      } catch (error) {
        suscripcion = null;
        console.warn('[SIGEP] No se pudo crear la suscripción push:', error);
      }
    }

    await guardar('suscripciones', {
      id: 'actual',
      permiso,
      suscripcion: suscripcion ? suscripcion.toJSON() : null,
      fecha: Date.now()
    });

    await actualizarBotonPush();
    toast(suscripcion
      ? 'Notificaciones activadas. Te avisaremos aunque la app esté cerrada.'
      : 'Notificaciones locales activadas. Las push se activan con conexión y el servidor configurado.', 'ok');
  }

  async function actualizarBotonPush() {
    const boton = $('#pa-activar-push');
    if (!boton) return;
    if (!('Notification' in window)) {
      boton.disabled = true;
      boton.textContent = 'Sin soporte de notificaciones';
      return;
    }
    if (Notification.permission === 'granted') {
      boton.innerHTML = '<i data-ic="checkCircle"></i>Notificaciones activas';
      boton.disabled = true;
    } else {
      boton.innerHTML = '<i data-ic="bell"></i>Activar notificaciones';
      boton.disabled = false;
    }
    if (window.pintarIconos) window.pintarIconos(boton);
  }

  async function mostrarNotificacionSW(titulo, cuerpo, url) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
      if ('serviceWorker' in navigator) {
        const registro = await navigator.serviceWorker.ready;
        if (registro.active) {
          registro.active.postMessage({ tipo: 'mostrar-notificacion', titulo, cuerpo, url, tag: `sigep-${uid()}` });
          return true;
        }
      }
      new Notification(titulo, { body: cuerpo, icon: ICONO });
      return true;
    } catch (error) {
      console.warn('[SIGEP] No se pudo mostrar la notificación:', error);
      return false;
    }
  }

  async function registrarBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registro = await navigator.serviceWorker.ready;
        await registro.sync.register(SYNC_TAG);
        return true;
      } catch (error) {
        console.warn('[SIGEP] Background Sync no disponible:', error);
      }
    }
    return false;
  }

  async function programarSync(version) {
    await agregar('pendientes', { tipo: 'dictamen', versionId: version.id, estado: version.estado, fecha: Date.now() });
    await registrarBackgroundSync();
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ tipo: 'sincronizar' });
    }
  }

  const esPdf = (version) => (version.tipo || 'application/pdf') === 'application/pdf' || /\.pdf$/i.test(version.archivo || '');

  // Archivo de la versión: copia del dispositivo o bucket privado «tesinas»
  async function obtenerArchivo(version) {
    let registro = await obtener('archivos', version.id).catch(() => null);
    if (registro && registro.blob) return registro;
    const cliente = api();
    if (!navigator.onLine || !cliente || !version.archivo_path) throw new Error('Archivo no guardado en el dispositivo.');
    const { data, error } = await cliente.storage.from('tesinas').download(version.archivo_path);
    if (error) throw error;
    const blob = new Blob([data], { type: version.tipo || data.type || 'application/pdf' });
    registro = { id: version.id, nombre: version.archivo, tipo: blob.type, blob };
    await guardar('archivos', registro).catch(() => {});
    return registro;
  }

  // Texto del PDF (para el chatbot): PDF.js compartido en js/vendor/pdfjs
  let pdfjs = null;
  async function extraerTexto(version, blob) {
    if (Array.isArray(version.contenido) && version.contenido.length) return;
    try {
      if (!pdfjs) {
        pdfjs = await import(new URL('../../js/vendor/pdfjs/pdf.min.mjs', document.baseURI).href);
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../js/vendor/pdfjs/pdf.worker.min.mjs', document.baseURI).href;
      }
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
      const contenido = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const pagina = await pdf.getPage(n);
        const { items } = await pagina.getTextContent();
        // Texto de la página en oraciones, agrupadas en fragmentos cortos para citarlas
        const texto = items.map((item) => item.str + (item.hasEOL ? ' ' : '')).join('').replace(/\s+/g, ' ').trim();
        const oraciones = texto.split(/(?<=[.?!])\s+(?=[A-ZÁÉÍÓÚÑ¿¡0-9])/u);
        let parrafo = 0;
        let actual = '';
        oraciones.forEach((oracion) => {
          if (actual && (actual.length + oracion.length) > 280) {
            contenido.push({ pagina: n, parrafo: ++parrafo, texto: actual });
            actual = '';
          }
          actual = actual ? `${actual} ${oracion}` : oracion;
        });
        if (actual) contenido.push({ pagina: n, parrafo: ++parrafo, texto: actual });
        pagina.cleanup();
      }
      await pdf.destroy();
      version.contenido = contenido;
      const guardada = await obtener('versiones', version.id).catch(() => null);
      if (guardada) await guardar('versiones', { ...guardada, contenido }).catch(() => {});
    } catch (error) {
      console.warn('[SIGEP] No se pudo leer el texto del PDF:', error);
    }
  }

  function mensajeEnVisor(iframe, texto) {
    iframe.removeAttribute('src');
    iframe.srcdoc = `<p style="font-family:Inter,system-ui,sans-serif;padding:24px;color:#5B6782">${escapar(texto)}</p>`;
  }

  async function cargarPdfEn(iframe, version, enlace) {
    if (!iframe) return;
    try {
      const registro = await obtenerArchivo(version);
      const anterior = urlPdfActual;
      urlPdfActual = URL.createObjectURL(registro.blob);
      if (enlace) {
        enlace.href = urlPdfActual;
        if (esPdf(version)) enlace.removeAttribute('download');
        else enlace.setAttribute('download', version.archivo || 'tesina');
      }
      if (esPdf(version)) {
        iframe.removeAttribute('srcdoc');
        iframe.src = urlPdfActual;
        iframe.title = `${version.titulo} · ${version.archivo}`;
        extraerTexto(version, registro.blob);
      } else {
        mensajeEnVisor(iframe, `Esta versión es un documento de Word (${version.archivo}). Usa «Abrir» para descargarlo; el visor solo muestra PDF.`);
      }
      if (anterior) setTimeout(() => URL.revokeObjectURL(anterior), 1000);
    } catch (error) {
      mensajeEnVisor(iframe, 'No se pudo cargar el documento sin conexión. Ábrelo cuando tengas red para guardarlo en el dispositivo.');
      if (enlace) enlace.removeAttribute('href');
      console.warn('[SIGEP] Documento no disponible:', error);
    }
  }

  /* ---------- Chatbot local ---------- */
  function analizarConsulta(texto, version) {
    const consulta = normalizar(texto);
    const temas = CRITERIOS.filter((criterio) => criterio.keywords.some((palabra) => consulta.includes(normalizar(palabra))));
    const pendientes = version.checklist.filter((item) => !item.cumple).map((item) => item.id);
    const relevantes = temas.length ? temas : CRITERIOS.filter((criterio) => pendientes.includes(criterio.id));

    const citas = [];
    const lineas = [];
    const usados = new Set();

    relevantes.forEach((criterio) => {
      const item = version.checklist.find((registro) => registro.id === criterio.id);
      if (!item) return;

      // Se busca primero la palabra principal del criterio y se omite el índice
      // (en una tesina real, «desarrollo» también aparece en el nombre de la carrera)
      const contenido = (Array.isArray(version.contenido) ? version.contenido : [])
        .filter((fragmento) => !/^(indice|contenido)\b/.test(normalizar(fragmento.texto)));
      const cita = criterio.keywords.reduce((hallada, palabra) => hallada
          || contenido.find((fragmento) => normalizar(fragmento.texto).includes(normalizar(palabra))), null)
        || contenido.find((fragmento) => fragmento.pagina === criterio.pagina)
        || contenido[0];

      if (cita && !usados.has(`${cita.pagina}-${cita.parrafo}`)) {
        usados.add(`${cita.pagina}-${cita.parrafo}`);
        citas.push({ pagina: cita.pagina, parrafo: cita.parrafo, texto: cita.texto });
      }

      if (item.cumple) {
        lineas.push(`Cumple: ${criterio.criterio}. ${item.nota || ''}`);
      } else {
        lineas.push(`No cumple: ${criterio.criterio}. ${item.nota || criterio.sugerencia}`);
        lineas.push(`Sugerencia: ${criterio.sugerencia}`);
      }
    });

    if (!lineas.length) {
      lineas.push('No encontré criterios pendientes para esa consulta. Revisa el checklist o pregunta por un apartado específico.');
    }

    const totalPendientes = version.checklist.filter((item) => !item.cumple).length;
    const cierre = totalPendientes
      ? `Quedan ${totalPendientes} criterio(s) por atender en esta versión.`
      : 'Todos los criterios revisados están completos.';

    return {
      texto: [`Revisé ${relevantes.length || 1} criterio(s) de ${version.titulo}.`, ...lineas, cierre].join('\n'),
      citas: citas.slice(0, 4)
    };
  }

  /* ---------- Dictado por voz en vista expandida ---------- */
  function formatearTiempo(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutos = String(Math.floor(total / 60)).padStart(2, '0');
    const segundos = String(total % 60).padStart(2, '0');
    return `${minutos}:${segundos}`;
  }

  function actualizarTiempoDictado(ms) {
    const tiempo = $('#pa-dictado-tiempo');
    if (tiempo) tiempo.textContent = formatearTiempo(ms);
  }

  function actualizarEstadoDictado(texto) {
    const estadoTexto = $('#pa-dictado-estado-texto');
    if (estadoTexto) estadoTexto.textContent = texto;
  }

  function actualizarBotonDictado(grabando) {
    const boton = $('#pa-dictado-toggle');
    if (!boton) return;
    boton.setAttribute('aria-pressed', String(grabando));
    boton.setAttribute('aria-label', grabando ? 'Detener dictado' : 'Iniciar dictado');
    boton.innerHTML = `<i data-ic="${grabando ? 'stop' : 'mic'}"></i><span id="pa-dictado-toggle-texto">${grabando ? 'Detener' : 'Dictar'}</span>`;
    if (window.pintarIconos) window.pintarIconos(boton);
  }

  function actualizarDictadoLive() {
    const live = $('#pa-dictado-live');
    if (!live) return;
    const texto = `${dictado.final} ${dictado.interim}`.replace(/\s+/g, ' ').trim();
    live.textContent = texto || 'Pulsa el micrófono flotante para comenzar.';
  }

  function poblarVersionesDictado(seleccionada) {
    const select = $('#pa-dictado-version');
    if (!select) return;
    select.innerHTML = estado.versiones.map((version) => `<option value="${escapar(version.id)}">V${version.numero} · ${escapar(etiquetaVersion(version.numero))}</option>`).join('');
    if (seleccionada) select.value = seleccionada;
  }

  function actualizarChipVersionDictado() {
    const select = $('#pa-dictado-version');
    const chip = $('#pa-dictado-version-chip');
    if (!select || !chip) return;
    const version = estado.versiones.find((registro) => registro.id === select.value);
    if (!version) return;
    chip.textContent = `V${version.numero}`;
    chip.className = `chip ${claseEstado(version.estado)}`;
  }

  function iniciarDictadoUI() {
    actualizarBotonDictado(false);
    actualizarTiempoDictado(0);
    if (!SpeechRecognitionCtor) {
      const ayuda = $('#pa-dictado-ayuda');
      if (ayuda) ayuda.textContent = 'Este navegador no soporta reconocimiento de voz continuo. Puedes grabar audio y escribir la transcripción manualmente.';
    }
  }

  function abrirPdfExpandido() {
    if (!estado.version) {
      toast('Selecciona una versión antes de abrir el visor expandido.', 'warn');
      return;
    }
    const origen = $('#pa-pdf');
    const iframe = $('#pa-pdf-expanded');
    const modal = $('#pa-pdf-modal');
    if (!origen || !iframe || !modal || !origen.src) {
      toast('El PDF aún se está cargando. Inténtalo de nuevo.', 'warn');
      return;
    }

    iframe.src = origen.src;
    modal.hidden = false;
    document.body.classList.add('pa-modal-abierto');
    const titulo = $('#pa-modal-titulo');
    if (titulo) titulo.textContent = `Visor PDF · ${etiquetaVersion(estado.version.numero)}`;
    const meta = $('#pa-modal-meta');
    if (meta) meta.textContent = `${estado.version.archivo.split('/').pop()} · ${estado.version.titulo}`;
    aplicarChip($('#pa-modal-estado'), estado.version.estado);
    poblarVersionesDictado(estado.version.id);
    actualizarChipVersionDictado();
    actualizarBotonDictado(dictado.grabando);
    actualizarTiempoDictado(dictado.inicio ? Date.now() - dictado.inicio : 0);
    if (dictado.transcripcion) {
      const revision = $('#pa-dictado-review');
      const texto = $('#pa-dictado-texto');
      if (revision) revision.hidden = false;
      if (texto) texto.value = dictado.transcripcion;
    }
    const cerrar = $('#pa-modal-close');
    if (cerrar) setTimeout(() => cerrar.focus(), 0);
  }

  async function cerrarPdfExpandido() {
    const modal = $('#pa-pdf-modal');
    if (!modal || modal.hidden) return;
    if (dictado.grabando) await detenerDictado(false);
    modal.hidden = true;
    document.body.classList.remove('pa-modal-abierto');
    const expandir = $('#pa-pdf-expand');
    if (expandir) expandir.focus();
  }

  async function cambiarVersionDictado() {
    const select = $('#pa-dictado-version');
    if (!select || !select.value) return;
    if (dictado.grabando) {
      select.value = dictado.versionId || (estado.version && estado.version.id) || select.value;
      toast('Detén el dictado antes de cambiar de versión.', 'warn');
      return;
    }
    actualizarChipVersionDictado();
    await cargarVersion(select.value);
    const origen = $('#pa-pdf');
    const iframe = $('#pa-pdf-expanded');
    if (origen && iframe && origen.src) iframe.src = origen.src;
    const titulo = $('#pa-modal-titulo');
    if (titulo && estado.version) titulo.textContent = `Visor PDF · ${etiquetaVersion(estado.version.numero)}`;
    const meta = $('#pa-modal-meta');
    if (meta && estado.version) meta.textContent = `${estado.version.archivo.split('/').pop()} · ${estado.version.titulo}`;
    if (estado.version) aplicarChip($('#pa-modal-estado'), estado.version.estado);
  }

  function iniciarTemporizadorDictado() {
    clearInterval(dictado.temporizador);
    actualizarTiempoDictado(0);
    dictado.temporizador = setInterval(() => actualizarTiempoDictado(Date.now() - dictado.inicio), 500);
  }

  function iniciarReconocimientoVoz() {
    if (!SpeechRecognitionCtor) {
      actualizarEstadoDictado('Grabando audio sin transcripción automática');
      return;
    }
    try {
      const reconocimiento = new SpeechRecognitionCtor();
      reconocimiento.lang = 'es-MX';
      reconocimiento.continuous = true;
      reconocimiento.interimResults = true;
      reconocimiento.maxAlternatives = 1;

      reconocimiento.onresult = (event) => {
        let interino = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const resultado = event.results[i];
          const texto = resultado[0] ? resultado[0].transcript : '';
          if (resultado.isFinal) dictado.final += `${texto.trim()} `;
          else interino += texto;
        }
        dictado.interim = interino;
        actualizarDictadoLive();
      };

      reconocimiento.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast('Permiso de micrófono denegado. Habilítalo para dictar.', 'bad');
          detenerDictado(false);
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          console.warn('[SIGEP] Error de reconocimiento de voz:', event.error);
        }
      };

      reconocimiento.onend = () => {
        if (dictado.grabando && !dictado.deteniendo) {
          try {
            reconocimiento.start();
          } catch (error) {
            console.warn('[SIGEP] No se pudo reiniciar el reconocimiento:', error);
          }
        }
      };

      reconocimiento.start();
      dictado.reconocimiento = reconocimiento;
    } catch (error) {
      console.warn('[SIGEP] No se pudo iniciar el reconocimiento de voz:', error);
      actualizarEstadoDictado('Grabando audio sin transcripción automática');
    }
  }

  async function guardarAudioRespaldo(blob) {
    const versionId = dictado.versionId || (estado.version && estado.version.id) || 'sin-version';
    const id = `audio-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      await guardar('archivos', {
        id,
        nombre: `dictado-${versionId}.webm`,
        tipo: blob.type || 'audio/webm',
        blob,
        versionId,
        fecha: Date.now()
      });
      return id;
    } catch (error) {
      console.warn('[SIGEP] No se pudo guardar el audio de respaldo:', error);
      return null;
    }
  }

  async function iniciarGrabadoraAudio() {
    if (!SOPORTA_GRABACION) {
      dictado.audioListo = Promise.resolve(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!dictado.grabando) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      dictado.stream = stream;
      dictado.chunks = [];
      const grabadora = new MediaRecorder(stream);
      dictado.grabadora = grabadora;
      dictado.audioListo = new Promise((resolve) => { dictado.resolverAudio = resolve; });

      grabadora.ondataavailable = (event) => {
        if (event.data && event.data.size) dictado.chunks.push(event.data);
      };

      grabadora.onstop = async () => {
        const blob = new Blob(dictado.chunks, { type: grabadora.mimeType || 'audio/webm' });
        dictado.chunks = [];
        const id = blob.size ? await guardarAudioRespaldo(blob) : null;
        dictado.audioId = id;
        if (dictado.stream) {
          dictado.stream.getTracks().forEach((track) => track.stop());
          dictado.stream = null;
        }
        dictado.grabadora = null;
        if (dictado.resolverAudio) {
          dictado.resolverAudio(id);
          dictado.resolverAudio = null;
        }
      };

      grabadora.start();
    } catch (error) {
      console.warn('[SIGEP] No se pudo iniciar el audio de respaldo:', error);
      dictado.audioListo = Promise.resolve(null);
      actualizarEstadoDictado('Grabando solo transcripción');
    }
  }

  function iniciarDictado() {
    if (!estado.version) {
      toast('Selecciona una versión antes de dictar.', 'warn');
      return;
    }
    if (dictado.grabando) return;

    dictado.final = '';
    dictado.interim = '';
    dictado.transcripcion = '';
    dictado.audioId = null;
    dictado.chunks = [];
    dictado.deteniendo = false;
    dictado.versionId = ($('#pa-dictado-version') && $('#pa-dictado-version').value) || estado.version.id;
    dictado.grabando = true;
    dictado.inicio = Date.now();

    const revision = $('#pa-dictado-review');
    if (revision) revision.hidden = true;
    const texto = $('#pa-dictado-texto');
    if (texto) texto.value = '';
    const status = $('#pa-dictado-send-status');
    if (status) {
      status.textContent = '';
      status.className = 'pa-dictado-send-status';
    }
    const enviar = $('#pa-dictado-enviar');
    if (enviar) {
      enviar.disabled = false;
      enviar.innerHTML = '<i data-ic="send"></i>Enviar Observaciones';
      if (window.pintarIconos) window.pintarIconos(enviar);
    }

    actualizarBotonDictado(true);
    actualizarEstadoDictado('Grabando observaciones...');
    actualizarDictadoLive();
    iniciarTemporizadorDictado();
    iniciarReconocimientoVoz();
    iniciarGrabadoraAudio();
  }

  async function detenerDictado(mostrarRevision = true) {
    if (!dictado.grabando && !dictado.reconocimiento && !dictado.grabadora) return;

    dictado.deteniendo = true;
    dictado.grabando = false;
    clearInterval(dictado.temporizador);
    dictado.temporizador = null;

    if (dictado.reconocimiento) {
      try {
        dictado.reconocimiento.onend = null;
        dictado.reconocimiento.stop();
      } catch (error) {
        console.warn('[SIGEP] No se pudo detener el reconocimiento:', error);
      }
      dictado.reconocimiento = null;
    }

    const grabadora = dictado.grabadora;
    if (grabadora && grabadora.state !== 'inactive') {
      try {
        grabadora.stop();
      } catch (error) {
        console.warn('[SIGEP] No se pudo detener la grabadora:', error);
      }
    }
    if (dictado.audioListo) {
      try {
        await dictado.audioListo;
      } catch (error) {
        console.warn('[SIGEP] No se pudo guardar el audio de respaldo:', error);
      }
    }
    if (dictado.stream) {
      dictado.stream.getTracks().forEach((track) => track.stop());
      dictado.stream = null;
    }

    dictado.transcripcion = `${dictado.final} ${dictado.interim}`.replace(/\s+/g, ' ').trim();
    actualizarBotonDictado(false);
    actualizarEstadoDictado(dictado.transcripcion ? 'Dictado detenido' : 'No se captó texto');
    actualizarTiempoDictado(dictado.inicio ? Date.now() - dictado.inicio : 0);
    actualizarDictadoLive();

    if (mostrarRevision) {
      const revision = $('#pa-dictado-review');
      if (revision) revision.hidden = false;
      const texto = $('#pa-dictado-texto');
      if (texto) texto.value = dictado.transcripcion;
      poblarVersionesDictado(dictado.versionId || estado.version.id);
      actualizarChipVersionDictado();
      const status = $('#pa-dictado-send-status');
      if (status) {
        status.textContent = dictado.transcripcion
          ? 'Revisa y edita la transcripción antes de enviar.'
          : 'No se captó voz. Puedes escribir la observación manualmente.';
        status.className = 'pa-dictado-send-status';
      }
    }

    dictado.deteniendo = false;
  }

  async function alternarDictado() {
    if (dictado.grabando) await detenerDictado(true);
    else iniciarDictado();
  }

  async function enviarObservacionAlServidor(payload) {
    if (!API_OBSERVACIONES) return { local: true };
    const respuesta = await fetch(API_OBSERVACIONES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return { local: false };
  }

  async function encolarObservacion(payload) {
    await agregar('pendientes', {
      tipo: 'observacion',
      estado: 'pendiente_envio',
      payload,
      fecha: Date.now()
    });
    await registrarBackgroundSync();
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ tipo: 'sincronizar' });
    }
  }

  async function aplicarObservacionLocal(payload) {
    const version = await obtener('versiones', payload.versionId);
    if (!version) return;
    if (version.ultimaObservacion && version.ultimaObservacion.id === payload.id) return;

    version.estado = payload.estado;
    version.observacionAsesor = payload.observacion;
    version.actualizado = payload.fecha || Date.now();
    version.estadoEnvio = 'sincronizado';
    version.ultimaObservacion = payload;
    await guardar('versiones', version);
    const indice = estado.versiones.findIndex((registro) => registro.id === version.id);
    if (indice >= 0) estado.versiones[indice] = version;

    if (estado.rol === 'asesor') {
      renderVersionTabs();
      if (estado.version && estado.version.id === version.id) {
        estado.version = version;
        aplicarChip($('#pa-pdf-estado'), version.estado);
        aplicarChip($('#pa-dictamen-chip'), version.estado);
        aplicarChip($('#pa-modal-estado'), version.estado);
        const observaciones = $('#pa-observaciones');
        if (observaciones) observaciones.value = version.observacionAsesor || '';
        const actualizado = $('#pa-ultima-actualizacion');
        if (actualizado) actualizado.textContent = `Última actualización: ${fecha(version.actualizado)}`;
      }
    }

    await notificarAlumno(version);
    if (CANAL) CANAL.postMessage({ tipo: 'version-actualizada', versionId: version.id, estado: version.estado });
  }

  async function procesarPendientesLocales() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) return;
    const pendientes = await obtenerTodos('pendientes');
    const observaciones = pendientes.filter((pendiente) => pendiente.tipo === 'observacion' && pendiente.estado === 'pendiente_envio');
    for (const pendiente of observaciones) {
      try {
        await aplicarObservacionLocal(pendiente.payload);
        await eliminar('pendientes', pendiente.id);
      } catch (error) {
        console.warn('[SIGEP] No se pudo sincronizar una observación pendiente:', error);
      }
    }
    if (observaciones.length) toast(`${observaciones.length} observación(es) sincronizada(s).`, 'ok');
  }

  async function enviarObservacionesDictado() {
    if (dictado.enviando) return;
    const selectVersion = $('#pa-dictado-version');
    const selectEstado = $('#pa-dictado-dictamen');
    const textarea = $('#pa-dictado-texto');
    const status = $('#pa-dictado-send-status');
    const boton = $('#pa-dictado-enviar');
    if (!selectVersion || !selectEstado || !textarea) return;

    const version = await obtener('versiones', selectVersion.value) || estado.versiones.find((registro) => registro.id === selectVersion.value);
    if (!version) {
      toast('No se encontró la versión seleccionada.', 'bad');
      return;
    }
    const observacion = textarea.value.trim();
    if (!observacion) {
      textarea.focus();
      if (status) {
        status.textContent = 'Escribe o dicta una observación antes de enviar.';
        status.className = 'pa-dictado-send-status warn';
      }
      return;
    }

    const payload = {
      id: `obs-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      alumnoId: version.alumnoId,
      versionId: version.id,
      versionNumero: version.numero,
      estado: selectEstado.value,
      observacion,
      transcripcion: observacion,
      audioId: dictado.audioId,
      origen: 'dictado',
      fecha: Date.now(),
      estadoEnvio: navigator.onLine ? 'enviado' : 'pendiente_envio'
    };

    await sincronizarCambio('dictamenes', {
      id: version.id,
      alumno_id: payload.alumnoId,
      version_id: payload.versionId,
      version_numero: payload.versionNumero,
      estado: payload.estado,
      observacion: payload.observacion,
      actualizado: new Date(payload.fecha).toISOString()
    });

    dictado.enviando = true;
    if (boton) {
      boton.disabled = true;
      boton.innerHTML = '<i data-ic="clock"></i>Procesando...';
      if (window.pintarIconos) window.pintarIconos(boton);
    }
    if (status) {
      status.textContent = navigator.onLine ? 'Enviando observaciones...' : 'Guardando en la cola local...';
      status.className = 'pa-dictado-send-status';
    }

    try {
      if (!navigator.onLine) {
        await encolarObservacion(payload);
        if (status) {
          status.textContent = 'Pendiente de envío: se sincronizará al recuperar la conexión.';
          status.className = 'pa-dictado-send-status warn';
        }
        toast('Observación guardada como pendiente de envío.', 'warn');
        return;
      }

      try {
        await enviarObservacionAlServidor(payload);
        await aplicarObservacionLocal(payload);
        if (status) {
          status.textContent = 'Observaciones enviadas y notificación generada para el alumno.';
          status.className = 'pa-dictado-send-status ok';
        }
        toast('Observaciones enviadas al alumno.', 'ok');
      } catch (error) {
        console.warn('[SIGEP] No se pudo enviar la observación:', error);
        await encolarObservacion(payload);
        if (status) {
          status.textContent = 'No se pudo enviar. Quedó en la cola local para reintentar.';
          status.className = 'pa-dictado-send-status warn';
        }
        toast('Sin conexión con el servidor. Observación en cola local.', 'warn');
      }
    } finally {
      dictado.enviando = false;
      if (boton) {
        boton.disabled = false;
        boton.innerHTML = '<i data-ic="send"></i>Enviar Observaciones';
        if (window.pintarIconos) window.pintarIconos(boton);
      }
    }
  }

  /* ---------- Vista del Asesor ---------- */
  function initAsesor() {
    iniciarNavegacionSecciones();
    enlazarAsesor();
    iniciarDictadoUI();
    cargarAlumnos()
      .then(async () => {
        await renderCitasAsesor();
        await sincronizarDesdeNube();
        await actualizarPanelNotificaciones();
      })
      .catch((error) => console.warn('[SIGEP] No se pudo preparar la lista de alumnos:', error));
    if (navigator.onLine) {
      procesarPendientesLocales().catch((error) => console.warn('[SIGEP] No se pudieron procesar los pendientes locales:', error));
    }
    actualizarBotonPush();
  }

  function iniciarNavegacionSecciones() {
    const enlaces = $$('[data-seccion]');
    const secciones = $$('.mod-seccion');
    if (!enlaces.length || !secciones.length) return;
    const etiquetas = { alumnos: 'Alumnos asignados', preauditoria: 'Revisión de documentos', citas: 'Citas de asesorías' };

    const activar = (id, actualizarHash) => {
      const destino = secciones.find((seccion) => seccion.id === id);
      if (!destino) return;
      secciones.forEach((seccion) => seccion.classList.toggle('d-none', seccion !== destino));
      enlaces.forEach((enlace) => {
        if (enlace.closest('.side-nav')) enlace.setAttribute('aria-current', String(enlace.dataset.seccion === id));
      });
      const crumb = $('#crumb-seccion');
      if (crumb) crumb.textContent = etiquetas[id] || 'Alumnos asignados';
      if (actualizarHash && location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    enlaces.forEach((enlace) => {
      if (enlace.target === '_blank') return;
      enlace.addEventListener('click', (event) => {
        event.preventDefault();
        activar(enlace.dataset.seccion, true);
      });
    });

    const inicial = (location.hash || '#alumnos').slice(1);
    activar(enlaces.some((enlace) => enlace.dataset.seccion === inicial) ? inicial : 'alumnos', false);
  }

  function enlazarAsesor() {
    enlazarCitas();
    document.addEventListener('click', (event) => {
      const boton = event.target.closest('[data-ir-alumno]');
      if (boton) irAPreauditoria(boton.dataset.irAlumno, boton.dataset.irVersion);
    });
    const select = $('#pa-alumno');
    if (select) select.addEventListener('change', () => cargarAlumno(select.value));

    const tabs = $('#pa-versiones');
    if (tabs) tabs.addEventListener('click', (event) => {
      const boton = event.target.closest('.pa-version-btn');
      if (boton) cargarVersion(boton.dataset.id);
    });

    const form = $('#pa-chat-form');
    if (form) form.addEventListener('submit', enviarConsulta);

    const aprobar = $('#pa-aprobar');
    if (aprobar) aprobar.addEventListener('click', () => dictaminar('Aprobada'));

    const corregir = $('#pa-corregir');
    if (corregir) corregir.addEventListener('click', () => dictaminar('Requiere Correcciones'));

    const guardarBtn = $('#pa-guardar');
    if (guardarBtn) guardarBtn.addEventListener('click', guardarObservaciones);

    const pushBtn = $('#pa-activar-push');
    if (pushBtn) pushBtn.addEventListener('click', activarPush);

    const borradores = $('#pa-chat-draft');
    if (borradores) borradores.addEventListener('click', (event) => {
      if (event.target.closest('#pa-enviar-borradores') && estado.version) enviarBorradores(estado.version.id);
    });

    const observaciones = $('#pa-observaciones');
    if (observaciones) {
      let temporizador = null;
      observaciones.addEventListener('input', () => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => guardarObservaciones(true), 700);
      });
    }

    const expandir = $('#pa-pdf-expand');
    if (expandir) expandir.addEventListener('click', abrirPdfExpandido);

    const cerrar = $('#pa-modal-close');
    if (cerrar) cerrar.addEventListener('click', cerrarPdfExpandido);

    const mic = $('#pa-dictado-toggle');
    if (mic) mic.addEventListener('click', alternarDictado);

    const versionDictado = $('#pa-dictado-version');
    if (versionDictado) versionDictado.addEventListener('change', cambiarVersionDictado);

    const enviarDictado = $('#pa-dictado-enviar');
    if (enviarDictado) enviarDictado.addEventListener('click', enviarObservacionesDictado);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('#pa-pdf-modal').hidden) cerrarPdfExpandido();
    });
  }

  async function cargarAlumnos() {
    let alumnos = [];
    try {
      alumnos = await esperarAlumnos();
    } catch (error) {
      console.warn('[SIGEP] No se pudo obtener la lista de alumnos:', error);
    }
    alumnos.sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
    estado.alumnos = alumnos;

    const select = $('#pa-alumno');
    if (!select) return;
    select.innerHTML = '';
    if (!alumnos.length) {
      select.innerHTML = '<option value="">Sin alumnos disponibles</option>';
      estado.alumno = null;
      estado.versiones = [];
      limpiarWorkspace();
      renderResumenAsesor().catch(() => {});
      const info = $('#pa-alumno-info');
      if (info) info.innerHTML = '<span class="avatar">--</span><div class="grow"><b>Sin alumnos</b><small>Aún no tienes alumnos asignados (o no hay conexión para consultarlos).</small></div>';
      return;
    }

    alumnos.forEach((alumno) => {
      const opcion = document.createElement('option');
      opcion.value = alumno.id;
      opcion.textContent = `${alumno.nombre} · ${alumno.proyecto}`;
      select.appendChild(opcion);
    });

    const parametro = new URLSearchParams(location.search).get('alumno');
    const preferido = alumnos.some((alumno) => alumno.id === parametro) ? parametro : alumnos[0] && alumnos[0].id;
    if (preferido) {
      select.value = preferido;
      await cargarAlumno(preferido);
    }
  }

  // Tarjetas y listas de «Alumnos asignados» con los datos reales
  async function renderResumenAsesor() {
    const listaAlumnos = $('#pa-lista-alumnos');
    if (!listaAlumnos) return;
    const versiones = await obtenerTodos('versiones').catch(() => []);
    const citas = await obtenerTodos('citas').catch(() => []);
    const porAlumno = new Map();
    versiones.forEach((version) => {
      if (!porAlumno.has(version.alumnoId)) porAlumno.set(version.alumnoId, []);
      porAlumno.get(version.alumnoId).push(version);
    });
    const porRevisar = versiones.filter((version) => version.estado === 'Pendiente').sort((a, b) => (b.actualizado || 0) - (a.actualizado || 0));
    const semana = Date.now() + 7 * 86400000;
    const citasSemana = citas.filter((cita) => cita.estado === 'Programada' && new Date(cita.fecha).getTime() >= Date.now() - 3600000 && new Date(cita.fecha).getTime() <= semana);
    const sinEntrega = estado.alumnos.filter((alumno) => !porAlumno.has(alumno.id));
    const poner = (selector, valor) => { const el = $(selector); if (el) el.textContent = String(valor); };
    poner('#pa-stat-alumnos', estado.alumnos.length);
    poner('#pa-stat-revisar', porRevisar.length);
    poner('#pa-stat-citas', citasSemana.length);
    poner('#pa-stat-sin-entrega', sinEntrega.length);
    poner('#pa-cuenta-entregas', porRevisar.length);
    [['#pa-nav-alumnos', estado.alumnos.length], ['#pa-nav-revisar', porRevisar.length]].forEach(([selector, valor]) => {
      const el = $(selector);
      if (!el) return;
      el.textContent = String(valor);
      el.hidden = valor === 0;
    });

    if (!estado.alumnos.length) {
      listaAlumnos.innerHTML = '<div class="pa-empty">Aún no tienes alumnos asignados.</div>';
    } else {
      listaAlumnos.innerHTML = estado.alumnos.map((alumno) => {
        const suyas = (porAlumno.get(alumno.id) || []).sort((a, b) => b.numero - a.numero);
        const ultima = suyas[0];
        const avance = ultima && Array.isArray(ultima.checklist) && ultima.checklist.length
          ? Math.round(ultima.checklist.filter((item) => item.cumple).length * 100 / ultima.checklist.length) : 0;
        const chip = !ultima ? ['', 'Sin entregas']
          : ultima.estado === 'Aprobada' ? ['ok', 'Aprobada']
          : ultima.estado === 'Pendiente' ? ['warn', 'Por revisar'] : ['bad', 'En corrección'];
        return `<div class="r"><span class="avatar">${escapar(alumno.iniciales || iniciales(alumno.nombre))}</span>
          <div class="grow" style="min-width:0"><b>${escapar(alumno.nombre)}</b><small>${escapar(alumno.matricula)} · ${suyas.length} ${suyas.length === 1 ? 'versión' : 'versiones'}</small></div>
          <div style="width:min(150px,34%);flex-shrink:0"><div style="display:flex;justify-content:space-between;gap:6px;font-size:.78rem" class="num"><span><span class="chip ${chip[0]}">${chip[1]}</span></span><b>${avance}%</b></div><div class="bar ${avance === 100 ? 'ok' : ''}" style="margin-top:6px"><i style="width:${avance}%"></i></div></div>
          <button class="btn soft sm" type="button" data-ir-alumno="${escapar(alumno.id)}"${ultima ? ` data-ir-version="${escapar(ultima.id)}"` : ''}>Ver</button></div>`;
      }).join('');
    }

    const listaEntregas = $('#pa-lista-entregas');
    if (listaEntregas) {
      const nombreDe = (id) => (estado.alumnos.find((alumno) => alumno.id === id) || {}).nombre || 'Alumno';
      listaEntregas.innerHTML = porRevisar.length ? porRevisar.slice(0, 6).map((version) => `
        <div class="r"><span class="ic-box" style="margin:0"><i data-ic="file"></i></span>
          <div class="grow"><b>${escapar(version.titulo)} · V${version.numero}</b><small>${escapar(nombreDe(version.alumnoId))} · ${escapar(fecha(version.actualizado))}</small></div>
          <button class="btn sm" type="button" data-ir-alumno="${escapar(version.alumnoId)}" data-ir-version="${escapar(version.id)}">Revisar</button></div>`).join('')
        : '<div class="pa-empty">No hay entregas pendientes de revisión.</div>';
    }
    if (window.pintarIconos) window.pintarIconos(listaAlumnos.closest('section') || document);
  }

  // «Ver» / «Revisar» del resumen: abre la pre-auditoría de esa versión
  async function irAPreauditoria(alumnoId, versionId) {
    const enlace = $('.side-nav [data-seccion="preauditoria"]');
    if (enlace) enlace.click();
    const select = $('#pa-alumno');
    if (select) select.value = alumnoId;
    await cargarAlumno(alumnoId);
    if (versionId) await cargarVersion(versionId);
  }

  async function cargarAlumno(alumnoId) {
    estado.alumno = await obtener('alumnos', alumnoId).catch(() => null) || estado.alumnos.find((alumno) => alumno.id === alumnoId) || null;
    estado.versiones = await porIndice('versiones', 'alumnoId', alumnoId).catch(() => []);
    estado.versiones.sort((a, b) => a.numero - b.numero);
    renderAlumnoInfo();
    renderVersionTabs();

    const parametro = new URLSearchParams(location.search).get('version');
    const elegida = estado.versiones.find((version) => version.id === parametro) || estado.versiones[0];
    if (elegida) {
      await cargarVersion(elegida.id);
    } else {
      limpiarWorkspace();
    }
    renderResumenAsesor().catch(() => {});
  }

  function renderAlumnoInfo() {
    const cont = $('#pa-alumno-info');
    if (!cont || !estado.alumno) return;
    const alumno = estado.alumno;
    cont.innerHTML = `<span class="avatar">${escapar(alumno.iniciales || iniciales(alumno.nombre))}</span><div class="grow"><b>${escapar(alumno.nombre)}</b><small>${escapar(alumno.matricula)} · ${escapar(alumno.carrera)} · ${escapar(alumno.asesor)}</small></div><span class="chip mod">${estado.versiones.length} versiones</span>`;
  }

  function renderVersionTabs() {
    const cont = $('#pa-versiones');
    if (!cont) return;
    if (!estado.versiones.length) {
      cont.innerHTML = '<div class="pa-empty">Este alumno aún no tiene versiones de tesina registradas.</div>';
      return;
    }
    cont.innerHTML = estado.versiones.map((version) => `
      <button class="pa-version-btn" type="button" role="tab" data-id="${escapar(version.id)}" aria-selected="${estado.version && estado.version.id === version.id ? 'true' : 'false'}">
        <span>${escapar(etiquetaVersion(version.numero))}</span>
        <span class="chip ${claseEstado(version.estado)}">${escapar(version.estado)}</span>
      </button>
    `).join('');
  }

  async function cargarVersion(versionId) {
    const version = await obtener('versiones', versionId) || estado.versiones.find((registro) => registro.id === versionId);
    if (!version) return;
    actualizarVersionEnLista(version);
    renderVersionTabs();

    $$('.pa-version-btn', $('#pa-versiones')).forEach((boton) => boton.setAttribute('aria-selected', String(boton.dataset.id === versionId)));

    const titulo = $('#pa-pdf-titulo');
    if (titulo) titulo.textContent = `Visor PDF · ${etiquetaVersion(version.numero)}`;
    aplicarChip($('#pa-pdf-estado'), version.estado);
    aplicarChip($('#pa-dictamen-chip'), version.estado);

    const meta = $('#pa-pdf-meta');
    if (meta) meta.textContent = `PDF · ${version.archivo.split('/').pop()} · Actualizado ${fecha(version.actualizado)}`;

    const observaciones = $('#pa-observaciones');
    if (observaciones) observaciones.value = version.observacionAsesor || '';

    const actualizado = $('#pa-ultima-actualizacion');
    if (actualizado) actualizado.textContent = `Última actualización: ${fecha(version.actualizado)}`;

    renderChecklist(version);
    await renderChat(version);
    await cargarPdfEn($('#pa-pdf'), version, $('#pa-pdf-abrir'));
    await actualizarBorradores(version.id);
  }

  function renderChecklist(version) {
    const cont = $('#pa-checklist');
    if (!cont) return;
    cont.innerHTML = '';
    version.checklist.forEach((item, indice) => {
      const etiqueta = document.createElement('label');
      etiqueta.className = `pa-check-item ${item.cumple ? 'si' : 'no'}`;
      etiqueta.innerHTML = `<input type="checkbox" ${item.cumple ? 'checked' : ''} data-indice="${indice}" aria-label="${escapar(item.criterio)}"><span class="pa-check-icon">${item.cumple ? '✓' : '!'}</span><span class="grow"><b>${escapar(item.criterio)}</b><small>${escapar(item.nota || '')}</small></span><span class="mono">p. ${escapar(item.pagina)}</span>`;
      const checkbox = etiqueta.querySelector('input');
      checkbox.addEventListener('change', () => cambiarChecklist(indice, checkbox.checked));
      cont.appendChild(etiqueta);
    });
    actualizarProgreso(version);
  }

  async function cambiarChecklist(indice, cumple) {
    if (!estado.version) return;
    const version = estado.version;
    const item = version.checklist[indice];
    if (!item) return;
    const criterio = CRITERIOS.find((registro) => registro.id === item.id);
    item.cumple = cumple;
    item.nota = cumple ? ((NOTAS[item.id] && NOTAS[item.id].si) || 'Cumple con el criterio.') : ((NOTAS[item.id] && NOTAS[item.id].no) || (criterio && criterio.sugerencia) || 'Requiere corrección.');
    version.actualizado = Date.now();
    estado.version = version;
    actualizarVersionEnLista(version);
    await guardar('versiones', version);
    await sincronizarCambio('evaluaciones_checklist', {
      id: `${version.id}__${item.id}`,
      alumno_id: version.alumnoId,
      version_id: version.id,
      version_numero: version.numero,
      criterio_id: item.id,
      criterio: item.criterio,
      cumple: item.cumple,
      nota: item.nota,
      pagina: item.pagina,
      actualizado: new Date(version.actualizado).toISOString()
    });
    await registrarNotificacionChecklist(version, item);
    await actualizarPanelNotificaciones();
    renderChecklist(version);
    renderVersionTabs();
    if (CANAL) CANAL.postMessage({ tipo: 'version-actualizada', versionId: version.id, estado: version.estado });
    toast('Checklist guardado y sincronizado.', 'ok');
  }

  function actualizarProgreso(version) {
    const cont = $('#pa-check-progreso');
    if (!cont) return;
    const total = version.checklist.length;
    const cumplidos = version.checklist.filter((item) => item.cumple).length;
    cont.textContent = `${cumplidos} de ${total}`;
    cont.className = `chip ${cumplidos === total ? 'ok' : 'mod'}`;
  }

  async function renderChat(version) {
    const log = $('#pa-chat-log');
    if (!log) return;
    log.innerHTML = '';

    const bienvenida = document.createElement('div');
    bienvenida.className = 'pa-msg pa-msg-bot';
    bienvenida.innerHTML = `<div class="pa-bubble">Hola, soy el asistente de pre-auditoría. Pregúntame por el planteamiento, los objetivos, la metodología o las referencias de esta versión.</div><small>${fecha(Date.now())}</small>`;
    log.appendChild(bienvenida);

    const mensajes = (await porIndice('mensajes', 'versionId', version.id)).sort((a, b) => a.fecha - b.fecha);
    mensajes.forEach((mensaje) => log.appendChild(crearMensaje(mensaje)));
    log.scrollTop = log.scrollHeight;
  }

  function crearMensaje(mensaje) {
    const cont = document.createElement('div');
    cont.className = `pa-msg ${mensaje.rol === 'asesor' ? 'pa-msg-asesor' : 'pa-msg-bot'}${mensaje.rol === 'aviso' ? ' pa-msg-aviso' : ''}`;

    const burbuja = document.createElement('div');
    burbuja.className = 'pa-bubble';
    const texto = document.createElement('div');
    texto.textContent = mensaje.texto || '';
    burbuja.appendChild(texto);

    (mensaje.citas || []).forEach((cita) => {
      const bloque = document.createElement('blockquote');
      const referencia = document.createElement('b');
      referencia.textContent = `p. ${cita.pagina}, párr. ${cita.parrafo}`;
      const extracto = document.createElement('span');
      extracto.textContent = cita.texto;
      bloque.append(referencia, extracto);
      burbuja.appendChild(bloque);
    });

    const hora = document.createElement('small');
    hora.textContent = fecha(mensaje.fecha);
    cont.append(burbuja, hora);
    return cont;
  }

  async function enviarConsulta(event) {
    event.preventDefault();
    const input = $('#pa-chat-input');
    if (!input || !estado.version) return;
    const texto = input.value.trim();
    if (!texto) return;
    const version = estado.version;
    input.value = '';

    await agregar('mensajes', { versionId: version.id, rol: 'asesor', texto, citas: [], fecha: Date.now() });
    await renderChat(version);

    if (!navigator.onLine) {
      await agregar('borradores', { versionId: version.id, texto, fecha: Date.now() });
      await agregar('mensajes', { versionId: version.id, rol: 'aviso', texto: 'Sin conexión: guardé tu consulta como borrador local. Cuando recuperes la conexión podrás enviarla.', citas: [], fecha: Date.now() });
      await renderChat(version);
      await actualizarBorradores(version.id);
      toast('Consulta guardada como borrador local.', 'warn');
      return;
    }

    mostrarEscribiendo();
    setTimeout(async () => {
      const respuesta = analizarConsulta(texto, version);
      await agregar('mensajes', { versionId: version.id, rol: 'bot', texto: respuesta.texto, citas: respuesta.citas, fecha: Date.now() });
      quitarEscribiendo();
      if (estado.version && estado.version.id === version.id) await renderChat(version);
    }, 700);
  }

  function mostrarEscribiendo() {
    const log = $('#pa-chat-log');
    if (!log || $('#pa-typing')) return;
    const cont = document.createElement('div');
    cont.id = 'pa-typing';
    cont.className = 'pa-msg pa-msg-bot';
    cont.innerHTML = '<div class="pa-bubble"><span class="pa-typing"><i></i><i></i><i></i></span></div>';
    log.appendChild(cont);
    log.scrollTop = log.scrollHeight;
  }

  function quitarEscribiendo() {
    const typing = $('#pa-typing');
    if (typing) typing.remove();
  }

  async function actualizarBorradores(versionId) {
    const cont = $('#pa-chat-draft');
    if (!cont) return;
    const borradores = await porIndice('borradores', 'versionId', versionId);
    if (!borradores.length) {
      cont.hidden = true;
      cont.innerHTML = '';
      return;
    }
    cont.hidden = false;
    cont.innerHTML = `<span>${borradores.length} consulta(s) guardada(s) sin conexión.</span><button class="btn out sm" type="button" id="pa-enviar-borradores">Reintentar</button>`;
  }

  async function enviarBorradores(versionId) {
    if (!navigator.onLine) {
      toast('Aún no hay conexión. El borrador sigue guardado.', 'warn');
      return;
    }
    const borradores = await porIndice('borradores', 'versionId', versionId);
    const version = estado.version && estado.version.id === versionId ? estado.version : await obtener('versiones', versionId);
    if (!version) return;

    for (const borrador of borradores) {
      await agregar('mensajes', { versionId, rol: 'asesor', texto: borrador.texto, citas: [], fecha: borrador.fecha });
      const respuesta = analizarConsulta(borrador.texto, version);
      await agregar('mensajes', { versionId, rol: 'bot', texto: respuesta.texto, citas: respuesta.citas, fecha: Date.now() });
      await eliminar('borradores', borrador.id);
    }

    await renderChat(version);
    await actualizarBorradores(versionId);
    toast('Borradores enviados y analizados.', 'ok');
  }

  function actualizarVersionEnLista(version) {
    const indice = estado.versiones.findIndex((registro) => registro.id === version.id);
    if (indice >= 0) estado.versiones[indice] = version;
    estado.version = version;
  }

  async function guardarObservaciones(silencioso = false) {
    if (!estado.version) return;
    const textarea = $('#pa-observaciones');
    if (!textarea) return;
    const version = estado.version;
    version.observacionAsesor = textarea.value.trim();
    version.actualizado = Date.now();
    actualizarVersionEnLista(version);
    await guardar('versiones', version);
    await sincronizarCambio('dictamenes', {
      id: version.id,
      alumno_id: version.alumnoId,
      version_id: version.id,
      version_numero: version.numero,
      estado: version.estado,
      observacion: version.observacionAsesor,
      actualizado: new Date(version.actualizado).toISOString()
    });
    await registrarNotificacionObservacion(version);
    if (!silencioso) await actualizarPanelNotificaciones();
    if (CANAL) CANAL.postMessage({ tipo: 'version-actualizada', versionId: version.id, estado: version.estado });
    const actualizado = $('#pa-ultima-actualizacion');
    if (actualizado) actualizado.textContent = `Última actualización: ${fecha(version.actualizado)}`;
    if (!silencioso) toast('Observaciones guardadas. El alumno las verá al sincronizar.', 'ok');
  }

  async function dictaminar(nuevoEstado) {
    if (!estado.version) return;
    const textarea = $('#pa-observaciones');
    const observacion = textarea ? textarea.value.trim() : '';
    if (nuevoEstado === 'Requiere Correcciones' && !observacion) {
      toast('Escribe una observación antes de solicitar correcciones.', 'warn');
      if (textarea) textarea.focus();
      return;
    }

    const version = estado.version;
    version.estado = nuevoEstado;
    version.observacionAsesor = observacion || version.observacionAsesor || '';
    version.actualizado = Date.now();
    actualizarVersionEnLista(version);
    await guardar('versiones', version);
    await sincronizarCambio('dictamenes', {
      id: version.id,
      alumno_id: version.alumnoId,
      version_id: version.id,
      version_numero: version.numero,
      estado: version.estado,
      observacion: version.observacionAsesor,
      actualizado: new Date(version.actualizado).toISOString()
    });
    aplicarChip($('#pa-pdf-estado'), version.estado);
    aplicarChip($('#pa-dictamen-chip'), version.estado);
    renderVersionTabs();
    renderResumenAsesor().catch(() => {});
    const actualizado = $('#pa-ultima-actualizacion');
    if (actualizado) actualizado.textContent = `Última actualización: ${fecha(version.actualizado)}`;

    await registrarEnTesina(version, nuevoEstado, observacion);
    await notificarAlumno(version);
    await actualizarPanelNotificaciones();
    await programarSync(version);
    if (CANAL) CANAL.postMessage({ tipo: 'version-actualizada', versionId: version.id, estado: version.estado });

    const aviso = ('Notification' in window && Notification.permission === 'granted')
      ? `Dictamen "${nuevoEstado}" guardado y notificado al alumno.`
      : `Dictamen "${nuevoEstado}" guardado. Activa notificaciones para avisar al alumno.`;
    toast(aviso, nuevoEstado === 'Aprobada' ? 'ok' : 'warn');
  }

  // El dictamen también queda en la tesina del Módulo 4 (estado y observación)
  // y se avisa al alumno por push. Sin conexión se queda en la cola.
  async function registrarEnTesina(version, nuevoEstado, observacion) {
    if (!window.SIGEPSync || typeof window.SIGEPSync.llamar !== 'function') return;
    const estadoTesina = ESTADO_TESINA[nuevoEstado];
    if (!estadoTesina) return;
    const texto = observacion || (nuevoEstado === 'Aprobada' ? 'Pre-auditoría aprobada: la versión cumple con los criterios revisados.' : `Dictamen de pre-auditoría: ${nuevoEstado}.`);
    const resultado = await window.SIGEPSync.llamar('observar_version',
      { p_version: version.id, p_texto: `[Pre-auditoría] ${texto}`, p_estado: estadoTesina },
      { accion: 'avisar', version: version.id });
    if (resultado && resultado.error) toast(`La tesina no se actualizó: ${resultado.error.message || 'sin permiso'}.`, 'bad');
    version.estadoServidor = estadoTesina;
    version.estadoEnvio = resultado && resultado.encolado ? 'pendiente_envio' : 'sincronizado';
    await guardar('versiones', version).catch(() => {});
  }

  function idNotificacion() {
    return Number(`${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`);
  }

  function notificacionRemota(notificacion, leida = Boolean(notificacion.leida)) {
    return {
      id: notificacion.id,
      alumno_id: notificacion.alumnoId || notificacion.alumno_id || '',
      version_id: notificacion.versionId || notificacion.version_id || null,
      titulo: notificacion.titulo || 'Aviso',
      cuerpo: notificacion.cuerpo || '',
      fecha: new Date(notificacion.fecha || Date.now()).toISOString(),
      leida: Boolean(leida)
    };
  }

  async function registrarNotificacion({ alumnoId, versionId = null, titulo, cuerpo, fecha = Date.now() }) {
    if (!alumnoId || !titulo) return null;
    try {
      const notificacion = {
        id: idNotificacion(),
        alumnoId,
        versionId,
        titulo,
        cuerpo: cuerpo || '',
        fecha,
        leida: false
      };
      await agregar('notificaciones', notificacion);
      await sincronizarCambio('notificaciones', notificacionRemota(notificacion, false));
      return notificacion;
    } catch (error) {
      console.warn('[SIGEP] No se pudo registrar la notificación:', error);
      return null;
    }
  }

  async function registrarNotificacionObservacion(version) {
    const titulo = `Observaciones actualizadas · V${version.numero}`;
    const cuerpo = version.observacionAsesor
      ? String(version.observacionAsesor).slice(0, 120)
      : 'Tu asesor actualizó las observaciones.';
    const existentes = await porIndice('notificaciones', 'alumnoId', version.alumnoId).catch(() => []);
    const previa = existentes.find((notificacion) => notificacion.versionId === version.id && notificacion.titulo === titulo);
    if (previa) {
      previa.cuerpo = cuerpo;
      previa.fecha = Date.now();
      previa.leida = false;
      await guardar('notificaciones', previa).catch(() => {});
      await sincronizarCambio('notificaciones', notificacionRemota(previa, false));
      return previa;
    }
    return registrarNotificacion({
      alumnoId: version.alumnoId,
      versionId: version.id,
      titulo,
      cuerpo
    });
  }

  async function registrarNotificacionChecklist(version, item) {
    const titulo = `Checklist actualizado · V${version.numero}`;
    const cuerpo = `${item.criterio}: ${item.cumple ? 'Cumple' : 'Requiere corrección'}.`;
    const existentes = await porIndice('notificaciones', 'alumnoId', version.alumnoId).catch(() => []);
    const previa = existentes.find((notificacion) => notificacion.versionId === version.id && notificacion.titulo === titulo);
    if (previa) {
      previa.cuerpo = cuerpo;
      previa.fecha = Date.now();
      previa.leida = false;
      await guardar('notificaciones', previa).catch(() => {});
      await sincronizarCambio('notificaciones', notificacionRemota(previa, false));
      return previa;
    }
    return registrarNotificacion({
      alumnoId: version.alumnoId,
      versionId: version.id,
      titulo,
      cuerpo
    });
  }

  async function notificarAlumno(version) {
    if (!estado.alumno) return;
    const numero = version.numero;
    let titulo;
    let cuerpo;

    if (version.estado === 'Aprobada') {
      titulo = `Tu versión ${numero} ha sido aprobada`;
      cuerpo = `Hola ${estado.alumno.nombre.split(' ')[0]}, tu asesor aprobó la ${etiquetaVersion(numero)}.`;
    } else if (version.estado === 'Requiere Correcciones') {
      titulo = `Nueva observación disponible en V${numero}`;
      cuerpo = `Revisa las observaciones de tu asesor en la ${etiquetaVersion(numero)}.`;
    } else if (version.estado === 'No pasa') {
      titulo = `Tu versión ${numero} no pasó la revisión`;
      cuerpo = `Revisa las observaciones de tu asesor en la ${etiquetaVersion(numero)} antes de continuar.`;
    } else {
      titulo = `Tu versión ${numero} está pendiente de revisión`;
      cuerpo = `Tu asesor guardó cambios en la ${etiquetaVersion(numero)}.`;
    }

    await registrarNotificacion({
      alumnoId: estado.alumno.id,
      versionId: version.id,
      titulo,
      cuerpo
    });

    const destino = new URL('./alumno.html', location.href);
    destino.searchParams.set('alumno', estado.alumno.id);
    destino.searchParams.set('version', version.id);
    await mostrarNotificacionSW(titulo, cuerpo, destino.href);
  }

  function limpiarWorkspace() {
    estado.version = null;
    const checklist = $('#pa-checklist');
    if (checklist) checklist.innerHTML = '<div class="pa-empty">Selecciona un alumno con versiones registradas.</div>';
    const log = $('#pa-chat-log');
    if (log) log.innerHTML = '<div class="pa-empty">El chatbot estará disponible cuando exista una versión.</div>';
    const iframe = $('#pa-pdf');
    if (iframe) {
      iframe.removeAttribute('src');
      iframe.removeAttribute('srcdoc');
    }
    const observaciones = $('#pa-observaciones');
    if (observaciones) observaciones.value = '';
    const borradores = $('#pa-chat-draft');
    if (borradores) {
      borradores.hidden = true;
      borradores.innerHTML = '';
    }
    aplicarChip($('#pa-pdf-estado'), 'Pendiente');
    aplicarChip($('#pa-dictamen-chip'), 'Pendiente');
  }

  /* ---------- Vista del Alumno ---------- */
  function initAlumno() {
    enlazarAlumno();
    cargarAlumnoVista()
      .then(async () => {
        await sincronizarDesdeNube();
        await actualizarPanelNotificaciones();
      })
      .catch((error) => {
        console.error('[SIGEP] Error al cargar la vista del alumno:', error);
        toast('No se pudo cargar la pre-auditoría desde IndexedDB.', 'bad');
      });
    actualizarBotonPush();
    registrarSyncAlumno();
  }

  function enlazarAlumno() {
    const tabs = $('#pa-alumno-versiones');
    if (tabs) tabs.addEventListener('click', (event) => {
      const boton = event.target.closest('.pa-version-btn');
      if (boton) seleccionarVersionAlumno(boton.dataset.id);
    });

    const pushBtn = $('#pa-activar-push');
    if (pushBtn) pushBtn.addEventListener('click', activarPush);

    const syncBtn = $('#pa-alumno-sync');
    if (syncBtn) syncBtn.addEventListener('click', async () => {
      registrarSyncAlumno();
      await sincronizarDesdeNube();
      await recargarAlumno('Sincronización solicitada.');
    });

    const listaObservaciones = $('#pa-alumno-observaciones-lista');
    if (listaObservaciones) listaObservaciones.addEventListener('click', (event) => {
      const boton = event.target.closest('[data-version]');
      if (boton) seleccionarVersionAlumno(boton.dataset.version);
    });
  }

  async function cargarAlumnoVista() {
    const sesion = sesionActual();
    const alumnos = await esperarAlumnos();
    estado.nombreSesion = (sesion && sesion.nombre) || '';
    estado.alumno = alumnos.find((alumno) => sesion && alumno.id === sesion.userId) || null;
    if (!estado.alumno) {
      const cont = $('#pa-alumno-versiones');
      if (cont) cont.innerHTML = '<div class="pa-empty">No encontramos tu expediente. Conéctate a internet para cargarlo.</div>';
      return;
    }

    estado.versiones = (await porIndice('versiones', 'alumnoId', estado.alumno.id)).sort((a, b) => a.numero - b.numero);
    renderAlumnoCabecera();
    renderAlumnoStats();
    renderAlumnoVersionTabs();
    renderObservacionesAlumno();
    await renderNotificaciones();
    await renderCitasAlumno();

    const parametroVersion = new URLSearchParams(location.search).get('version');
    const elegida = estado.versiones.find((version) => version.id === parametroVersion) || estado.versiones[0];
    if (elegida) await seleccionarVersionAlumno(elegida.id);
    actualizarNavObservaciones();
  }

  function renderAlumnoCabecera() {
    if (!estado.alumno) return;
    const nombreMostrar = estado.nombreSesion || estado.alumno.nombre;
    const nombre = $('#pa-alumno-nombre');
    if (nombre) nombre.textContent = nombreMostrar;
    const sub = $('#pa-alumno-sub');
    if (sub) sub.textContent = `${estado.alumno.proyecto} · ${estado.alumno.periodo} · Asesor: ${estado.alumno.asesor}`;
    const avatar = $('#pa-alumno-avatar');
    if (avatar) avatar.textContent = iniciales(nombreMostrar) || estado.alumno.iniciales || 'AL';
  }

  function renderAlumnoStats() {
    const total = estado.versiones.length;
    const aprobadas = estado.versiones.filter((version) => version.estado === 'Aprobada').length;
    const correcciones = estado.versiones.filter((version) => version.estado === 'Requiere Correcciones' || version.estado === 'No pasa').length;
    const pendientes = estado.versiones.filter((version) => version.estado === 'Pendiente').length;
    const mapa = { '#pa-stat-total': total, '#pa-stat-aprobadas': aprobadas, '#pa-stat-correcciones': correcciones, '#pa-stat-pendientes': pendientes };
    Object.entries(mapa).forEach(([selector, valor]) => {
      const elemento = $(selector);
      if (elemento) elemento.textContent = String(valor);
    });
  }

  function renderAlumnoVersionTabs() {
    const cont = $('#pa-alumno-versiones');
    if (!cont) return;
    if (!estado.versiones.length) {
      cont.innerHTML = '<div class="pa-empty">Aún no tienes versiones registradas.</div>';
      return;
    }
    cont.innerHTML = estado.versiones.map((version) => `
      <button class="pa-version-btn" type="button" role="tab" data-id="${escapar(version.id)}" aria-selected="${estado.version && estado.version.id === version.id ? 'true' : 'false'}">
        <span>${escapar(etiquetaVersion(version.numero))}</span>
        <span class="chip ${claseEstado(version.estado)}">${escapar(version.estado)}</span>
      </button>
    `).join('');
  }

  async function seleccionarVersionAlumno(versionId) {
    const version = await obtener('versiones', versionId) || estado.versiones.find((registro) => registro.id === versionId);
    if (!version) return;
    const indice = estado.versiones.findIndex((registro) => registro.id === version.id);
    if (indice >= 0) estado.versiones[indice] = version;
    estado.version = version;

    $$('.pa-version-btn', $('#pa-alumno-versiones')).forEach((boton) => boton.setAttribute('aria-selected', String(boton.dataset.id === versionId)));
    renderEstadoAlumno(version);
    renderChecklistAlumno(version);
    const meta = $('#pa-alumno-pdf-meta');
    if (meta) meta.textContent = `PDF · ${version.archivo.split('/').pop()} · ${version.titulo}`;
    await cargarPdfEn($('#pa-alumno-pdf'), version, $('#pa-alumno-pdf-abrir'));
  }

  function renderEstadoAlumno(version) {
    aplicarChip($('#pa-alumno-estado'), version.estado);
    aplicarChip($('#pa-alumno-dictamen-chip'), version.estado);
    const banner = $('#pa-alumno-banner');
    if (banner) {
      banner.className = `pa-status-banner ${claseEstado(version.estado)}`;
      if (version.estado === 'Aprobada') {
        banner.innerHTML = `<i data-ic="checkCircle"></i><div><b>Versión aprobada</b><span>Tu asesor aprobó la ${escapar(etiquetaVersion(version.numero))}. No necesitas cambios adicionales.</span></div>`;
      } else if (version.estado === 'Requiere Correcciones') {
        banner.innerHTML = `<i data-ic="alert"></i><div><b>Requiere correcciones</b><span>Revisa las observaciones de tu asesor y sube una nueva versión cuando esté lista.</span></div>`;
      } else if (version.estado === 'No pasa') {
        banner.innerHTML = `<i data-ic="alert"></i><div><b>No pasa la versión</b><span>Revisa las observaciones del asesor y prepara una nueva versión antes de continuar.</span></div>`;
      } else {
        banner.innerHTML = `<i data-ic="clock"></i><div><b>Pendiente de revisión</b><span>Tu asesor aún no emite el dictamen final de esta versión.</span></div>`;
      }
      if (window.pintarIconos) window.pintarIconos(banner);
    }

    const observaciones = $('#pa-alumno-observaciones');
    if (observaciones) {
      const texto = version.observacionAsesor || '';
      observaciones.textContent = texto || 'Sin observaciones por ahora.';
      observaciones.className = `pa-observaciones-box${texto ? '' : ' vacia'}`;
    }

    const actualizado = $('#pa-alumno-actualizado');
    if (actualizado) actualizado.textContent = `Última actualización: ${fecha(version.actualizado)}`;
  }

  function renderChecklistAlumno(version) {
    const cont = $('#pa-alumno-checklist');
    if (!cont) return;
    cont.innerHTML = '';
    version.checklist.forEach((item) => {
      const fila = document.createElement('div');
      fila.className = `pa-check-item ${item.cumple ? 'si' : 'no'}`;
      fila.innerHTML = `<span class="pa-check-icon">${item.cumple ? '✓' : '!'}</span><span class="grow"><b>${escapar(item.criterio)}</b><small>${escapar(item.nota || '')}</small></span><span class="mono">p. ${escapar(item.pagina)}</span>`;
      cont.appendChild(fila);
    });
    const progreso = $('#pa-alumno-progreso');
    if (progreso) {
      const cumplidos = version.checklist.filter((item) => item.cumple).length;
      progreso.textContent = `${cumplidos} de ${version.checklist.length}`;
      progreso.className = `chip ${cumplidos === version.checklist.length ? 'ok' : 'mod'}`;
    }
  }

  async function renderNotificaciones() {
    const cont = $('#pa-alumno-notificaciones');
    if (!cont || !estado.alumno) return;
    const notificaciones = (await porIndice('notificaciones', 'alumnoId', estado.alumno.id)).sort((a, b) => b.fecha - a.fecha);
    if (!notificaciones.length) {
      cont.innerHTML = '<div class="pa-empty">Sin notificaciones por ahora.</div>';
      return;
    }
    cont.innerHTML = '';
    notificaciones.slice(0, 8).forEach((notificacion) => {
      const fila = document.createElement('div');
      fila.className = 'pa-notif';
      fila.innerHTML = `<span class="ic-box"><i data-ic="${notificacion.versionId ? 'message' : 'bell'}"></i></span><div class="grow"><b>${escapar(notificacion.titulo)}</b><small>${escapar(notificacion.cuerpo)} · ${fecha(notificacion.fecha)}</small></div>`;
      cont.appendChild(fila);
    });
    if (window.pintarIconos) window.pintarIconos(cont);
  }

  function claveNotificacionesLeidas() {
    const sesion = sesionActual();
    const identidad = sesion ? (sesion.userId || sesion.correo || sesion.nombre) : 'local';
    return `notif-leidas:${estado.rol || 'anon'}:${identidad}`;
  }

  async function leerNotificacionesLeidas() {
    try {
      const registro = await obtener('ajustes', claveNotificacionesLeidas());
      return new Set(registro && Array.isArray(registro.valor) ? registro.valor : []);
    } catch (error) {
      return new Set();
    }
  }

  async function guardarNotificacionesLeidas(ids) {
    try {
      await guardar('ajustes', { clave: claveNotificacionesLeidas(), valor: Array.from(ids) });
    } catch (error) {
      console.warn('[SIGEP] No se pudo guardar el estado de las notificaciones:', error);
    }
  }

  async function construirNotificacionesPanel() {
    const leidas = await leerNotificacionesLeidas();
    const items = [];

    if (estado.rol === 'asesor') {
      const alumnosPorId = new Map((estado.alumnos || []).map((alumno) => [alumno.id, alumno]));
      const versiones = await obtenerTodos('versiones').catch(() => []);
      versiones.forEach((version) => {
        const alumno = alumnosPorId.get(version.alumnoId);
        const nombreAlumno = alumno ? alumno.nombre : 'Alumno';
        if (version.estado === 'Pendiente') {
          items.push({ id: `entrega:${version.id}`, icono: 'file', titulo: `Entrega por revisar · V${version.numero}`, cuerpo: `${nombreAlumno} · ${version.titulo}`, fecha: version.actualizado, destino: 'preauditoria' });
        } else if (version.estado === 'Requiere Correcciones' || version.estado === 'No pasa') {
          items.push({ id: `correccion:${version.id}`, icono: 'alert', titulo: `Correcciones recibidas · V${version.numero}`, cuerpo: `${nombreAlumno} · ${version.estado}`, fecha: version.actualizado, destino: 'preauditoria' });
        }
      });
    }

    if (estado.rol === 'alumno' && estado.alumno) {
      const notificaciones = await porIndice('notificaciones', 'alumnoId', estado.alumno.id).catch(() => []);
      notificaciones.forEach((notificacion) => {
        items.push({ id: `notif:${notificacion.id}`, icono: notificacion.versionId ? 'message' : 'bell', titulo: notificacion.titulo, cuerpo: notificacion.cuerpo, fecha: notificacion.fecha, destino: 'observaciones', leida: Boolean(notificacion.leida) });
      });
      estado.versiones.forEach((version) => {
        if (version.estado === 'Requiere Correcciones' || version.estado === 'No pasa') {
          items.push({ id: `correccion:${version.id}`, icono: 'alert', titulo: `Correcciones recibidas · V${version.numero}`, cuerpo: version.observacionAsesor ? String(version.observacionAsesor).slice(0, 90) : version.estado, fecha: version.actualizado, destino: 'observaciones' });
        }
      });
    }

    const alumnosPorId = new Map((estado.alumnos || []).map((alumno) => [alumno.id, alumno]));
    const ahora = Date.now();
    const citas = await obtenerTodos('citas').catch(() => []);
    citas
      .filter((cita) => cita.estado === 'Programada' && new Date(cita.fecha).getTime() >= ahora)
      .filter((cita) => estado.rol !== 'alumno' || (estado.alumno && cita.alumno_id === estado.alumno.id))
      .forEach((cita) => {
        const alumno = alumnosPorId.get(cita.alumno_id);
        const nombre = estado.rol === 'alumno' && estado.alumno
          ? estado.alumno.nombre
          : (alumno ? alumno.nombre : 'Alumno');
        items.push({
          id: `cita:${cita.id}`,
          icono: 'calendar',
          titulo: `Cita programada · ${nombre}`,
          cuerpo: `${fechaCita(cita.fecha)} · ${cita.motivo}`,
          fecha: new Date(cita.fecha).getTime(),
          destino: 'citas'
        });
      });

    return items
      .map((item) => ({ ...item, leida: Boolean(item.leida) || leidas.has(item.id) }))
      .sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
  }

  async function actualizarPanelNotificaciones() {
    const lista = $('#notif-lista');
    const badge = $('#notif-badge');
    if (!lista && !badge) return;
    const items = await construirNotificacionesPanel();
    const pendientes = items.filter((item) => !item.leida).length;
    if (badge) {
      badge.textContent = String(pendientes);
      badge.hidden = pendientes === 0;
    }
    if (!lista) return;
    if (!items.length) {
      lista.innerHTML = '<div class="notif-empty">Sin notificaciones por ahora.</div>';
      return;
    }
    lista.innerHTML = items.slice(0, 12).map((item) => `
      <button class="notif-item${item.leida ? ' leida' : ''}" type="button" data-notif-id="${escapar(item.id)}" data-notif-destino="${escapar(item.destino || '')}">
        <span class="notif-ico"><i data-ic="${escapar(item.icono || 'bell')}"></i></span>
        <span class="grow"><b>${escapar(item.titulo)}</b><small>${escapar(item.cuerpo)} · ${escapar(fecha(item.fecha))}</small></span>
        ${item.leida ? '' : '<span class="notif-dot" aria-hidden="true"></span>'}
      </button>
    `).join('');
    if (window.pintarIconos) window.pintarIconos(lista);
  }

  function cerrarPanelNotificaciones() {
    const panel = $('#panel-notificaciones');
    const boton = $('#btn-notificaciones');
    if (panel) panel.classList.add('d-none');
    if (boton) boton.setAttribute('aria-expanded', 'false');
  }

  async function marcarNotificacionLeida(id) {
    const leidas = await leerNotificacionesLeidas();
    leidas.add(id);
    await guardarNotificacionesLeidas(leidas);
    if (id.startsWith('notif:')) {
      const registro = await obtener('notificaciones', Number(id.slice(6))).catch(() => null);
      if (registro && !registro.leida) {
        registro.leida = true;
        await guardar('notificaciones', registro).catch(() => {});
        await sincronizarCambio('notificaciones', notificacionRemota(registro));
      }
    }
    await actualizarPanelNotificaciones();
  }

  async function marcarTodasNotificacionesLeidas() {
    const items = await construirNotificacionesPanel();
    const leidas = await leerNotificacionesLeidas();
    items.forEach((item) => leidas.add(item.id));
    await guardarNotificacionesLeidas(leidas);

    if (estado.rol === 'alumno' && estado.alumno) {
      const notificaciones = await porIndice('notificaciones', 'alumnoId', estado.alumno.id).catch(() => []);
      for (const notificacion of notificaciones) {
        if (!notificacion.leida) {
          notificacion.leida = true;
          await guardar('notificaciones', notificacion).catch(() => {});
          await sincronizarCambio('notificaciones', notificacionRemota(notificacion));
        }
      }
    }
    await actualizarPanelNotificaciones();
  }

  function enlazarPanelNotificaciones() {
    const lista = $('#notif-lista');
    if (lista) {
      lista.addEventListener('click', async (event) => {
        const boton = event.target.closest('[data-notif-id]');
        if (!boton) return;
        await marcarNotificacionLeida(boton.dataset.notifId);
        const destino = boton.dataset.notifDestino;
        if (destino) {
          const enlace = document.querySelector(`.side-nav [data-seccion="${destino}"]`);
          if (enlace) enlace.click();
          else if (location.hash !== `#${destino}`) location.hash = destino;
        }
        cerrarPanelNotificaciones();
      });
    }

    const botonTodas = document.querySelector('[data-notif-leer-todas]');
    if (botonTodas) botonTodas.addEventListener('click', () => marcarTodasNotificacionesLeidas().catch(() => {}));

    document.addEventListener('sigep:notificaciones-abrir', () => {
      actualizarPanelNotificaciones().catch((error) => console.warn('[SIGEP] No se pudo actualizar el panel de notificaciones:', error));
    });
  }

  function valorDatetimeLocal(valor) {
    const d = new Date(valor);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function filaCitaAsesor(cita) {
    const alumno = (estado.alumnos || []).find((registro) => registro.id === cita.alumno_id);
    const nombre = alumno ? alumno.nombre : 'Alumno';
    const chip = cita.estado === 'Programada' ? 'warn' : 'ok';
    const accion = cita.estado === 'Programada'
      ? `<button class="btn out sm" type="button" data-cita-completar="${escapar(cita.id)}">Completar</button>`
      : '';
    return `
      <div class="r">
        <span class="avatar">${escapar(alumno ? alumno.iniciales || iniciales(nombre) : iniciales(nombre))}</span>
        <div class="grow"><b>${escapar(nombre)}</b><small>${escapar(fechaCita(cita.fecha))} · ${escapar(cita.motivo)}</small></div>
        <span class="chip ${chip}">${escapar(cita.estado)}</span>
        ${accion}
      </div>`;
  }

  function filaCitaAlumno(cita) {
    return `
      <div class="r">
        <span class="ic-box" style="margin:0"><i data-ic="calendar"></i></span>
        <div class="grow"><b>${escapar(cita.motivo)}</b><small>${escapar(fechaCita(cita.fecha))}</small></div>
        <span class="chip ${cita.estado === 'Programada' ? 'warn' : 'ok'}">${escapar(cita.estado)}</span>
      </div>`;
  }

  async function renderCitasAsesor() {
    const proximas = $('#pa-citas-proximas');
    const historial = $('#pa-citas-historial');
    if (!proximas && !historial) return;
    const select = $('#pa-cita-alumno');
    if (select) {
      const actual = select.value;
      const alumnos = estado.alumnos.length ? estado.alumnos : await obtenerTodos('alumnos').catch(() => []);
      select.innerHTML = alumnos.map((alumno) => `<option value="${escapar(alumno.id)}">${escapar(alumno.nombre)}</option>`).join('');
      if (actual && alumnos.some((alumno) => alumno.id === actual)) select.value = actual;
    }

    const ahora = Date.now();
    const esFutura = (cita) => new Date(cita.fecha).getTime() >= ahora;
    const citas = (await obtenerTodos('citas').catch(() => []))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    const programadas = citas.filter((cita) => cita.estado === 'Programada' && esFutura(cita));
    const completadas = citas.filter((cita) => cita.estado !== 'Programada' || !esFutura(cita));
    const contador = $('#pa-citas-proximas-count');
    if (contador) contador.textContent = String(programadas.length);
    const navContador = $('#pa-nav-citas');
    if (navContador) {
      navContador.textContent = String(programadas.length);
      navContador.hidden = programadas.length === 0;
    }
    if (proximas) {
      proximas.innerHTML = programadas.length
        ? programadas.map(filaCitaAsesor).join('')
        : '<div class="pa-empty">Sin citas programadas.</div>';
    }
    if (historial) {
      historial.innerHTML = completadas.length
        ? completadas.map(filaCitaAsesor).join('')
        : '<div class="pa-empty">Sin citas en el historial.</div>';
    }
    if (window.pintarIconos) window.pintarIconos($('#citas'));
  }

  async function renderCitasAlumno() {
    const cont = $('#pa-alumno-citas');
    if (!cont) return;
    if (!estado.alumno) {
      cont.innerHTML = '<div class="pa-empty">Inicia sesión para consultar tus citas.</div>';
      return;
    }
    const ahora = Date.now();
    const citas = (await porIndice('citas', 'alumno_id', estado.alumno.id).catch(() => []))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    const programadas = citas.filter((cita) => cita.estado === 'Programada' && new Date(cita.fecha).getTime() >= ahora);
    const contador = $('#pa-alumno-citas-count');
    if (contador) contador.textContent = String(programadas.length);
    cont.innerHTML = programadas.length
      ? programadas.map(filaCitaAlumno).join('')
      : '<div class="pa-empty">Sin citas programadas.</div>';
    if (window.pintarIconos) window.pintarIconos(cont);
  }

  async function guardarCita(event) {
    event.preventDefault();
    const alumnoId = $('#pa-cita-alumno') ? $('#pa-cita-alumno').value : '';
    const fechaValor = $('#pa-cita-fecha') ? $('#pa-cita-fecha').value : '';
    const motivo = $('#pa-cita-motivo') ? $('#pa-cita-motivo').value.trim() : '';
    if (!alumnoId || !fechaValor || !motivo) {
      toast('Completa el alumno, la fecha y el motivo de la cita.', 'warn');
      return;
    }
    const fecha = new Date(fechaValor);
    if (Number.isNaN(fecha.getTime())) {
      toast('La fecha de la cita no es válida.', 'warn');
      return;
    }

    const sesion = sesionActual();
    const cita = {
      id: `cita-${uid()}`,
      alumno_id: alumnoId,
      asesor_id: (sesion && sesion.userId) || '',
      fecha: fecha.toISOString(),
      motivo,
      estado: 'Programada',
      created_at: new Date().toISOString()
    };

    try {
      await guardar('citas', cita);
      await sincronizarCambio('citas', cita);
      await registrarNotificacion({
        alumnoId,
        titulo: 'Nueva cita programada',
        cuerpo: `${fechaCita(cita.fecha)} · ${motivo}`
      });
      await renderCitasAsesor();
      await actualizarPanelNotificaciones();
      const form = $('#pa-cita-form');
      if (form) form.reset();
      const card = $('#pa-cita-form-card');
      if (card) card.classList.add('d-none');
      toast('Cita programada y guardada.', 'ok');
      if (CANAL) CANAL.postMessage({ tipo: 'cita-actualizada', citaId: cita.id });
    } catch (error) {
      console.warn('[SIGEP] No se pudo guardar la cita:', error);
      toast('No se pudo guardar la cita.', 'bad');
    }
  }

  async function completarCita(id) {
    const cita = await obtener('citas', id).catch(() => null);
    if (!cita) return;
    cita.estado = 'Completada';
    try {
      await guardar('citas', cita);
      await sincronizarCambio('citas', cita);
      await renderCitasAsesor();
      await actualizarPanelNotificaciones();
      toast('Cita marcada como completada.', 'ok');
      if (CANAL) CANAL.postMessage({ tipo: 'cita-actualizada', citaId: cita.id });
    } catch (error) {
      console.warn('[SIGEP] No se pudo completar la cita:', error);
      toast('No se pudo actualizar la cita.', 'bad');
    }
  }

  function enlazarCitas() {
    const nueva = $('#pa-cita-nueva');
    const card = $('#pa-cita-form-card');
    if (nueva && card) {
      nueva.addEventListener('click', () => {
        const oculto = card.classList.toggle('d-none');
        if (!oculto) {
          const input = $('#pa-cita-fecha');
          if (input && !input.value) input.value = valorDatetimeLocal(Date.now() + 86400000);
          const select = $('#pa-cita-alumno');
          if (select && estado.alumno) select.value = estado.alumno.id;
        }
      });
    }
    const cancelar = $('#pa-cita-cancelar');
    if (cancelar && card) cancelar.addEventListener('click', () => card.classList.add('d-none'));
    const form = $('#pa-cita-form');
    if (form) form.addEventListener('submit', guardarCita);
    const proximas = $('#pa-citas-proximas');
    if (proximas) {
      proximas.addEventListener('click', (event) => {
        const boton = event.target.closest('[data-cita-completar]');
        if (boton) completarCita(boton.dataset.citaCompletar);
      });
    }
  }

  async function aplicarDictamenesRemotos(dictamenes) {
    for (const dictamen of dictamenes) {
      if (!dictamen || !dictamen.version_id) continue;
      const version = await obtener('versiones', dictamen.version_id).catch(() => null);
      if (!version) continue;
      const fechaRemota = dictamen.actualizado ? new Date(dictamen.actualizado).getTime() : Date.now();
      if (Number.isFinite(fechaRemota) && fechaRemota < (version.actualizado || 0)) continue;
      version.estado = dictamen.estado || version.estado;
      if (dictamen.observacion != null) version.observacionAsesor = dictamen.observacion;
      if (Number.isFinite(fechaRemota)) version.actualizado = fechaRemota;
      await guardar('versiones', version).catch(() => {});
    }
  }

  async function aplicarChecklistRemoto(evaluaciones) {
    const porVersion = new Map();
    evaluaciones.forEach((evaluacion) => {
      if (!evaluacion || !evaluacion.version_id || !evaluacion.criterio_id) return;
      if (!porVersion.has(evaluacion.version_id)) porVersion.set(evaluacion.version_id, new Map());
      porVersion.get(evaluacion.version_id).set(evaluacion.criterio_id, evaluacion);
    });

    for (const [versionId, criterios] of porVersion) {
      const version = await obtener('versiones', versionId).catch(() => null);
      if (!version || !Array.isArray(version.checklist)) continue;
      let modificado = false;
      version.checklist = version.checklist.map((item) => {
        const remoto = criterios.get(item.id);
        if (!remoto) return item;
        const cumple = Boolean(remoto.cumple);
        const nota = remoto.nota || item.nota;
        if (item.cumple === cumple && item.nota === nota) return item;
        modificado = true;
        return { ...item, cumple, nota };
      });
      if (!modificado) continue;
      const fechas = Array.from(criterios.values())
        .map((criterio) => new Date(criterio.actualizado || 0).getTime())
        .filter((valor) => Number.isFinite(valor));
      const ultima = fechas.length ? Math.max(...fechas) : Date.now();
      if (ultima > (version.actualizado || 0)) version.actualizado = ultima;
      await guardar('versiones', version).catch(() => {});
    }
  }

  async function sincronizarDesdeNube() {
    if (!navigator.onLine || !window.SIGEPSync || typeof window.SIGEPSync.sincronizar !== 'function') return false;
    try {
      const datos = await window.SIGEPSync.sincronizar();
      if (!datos) return false;
      const dictamenes = Array.isArray(datos.dictamenes) ? datos.dictamenes : [];
      const evaluaciones = Array.isArray(datos.evaluaciones_checklist) ? datos.evaluaciones_checklist : [];
      await aplicarDictamenesRemotos(dictamenes);
      await aplicarChecklistRemoto(evaluaciones);

      if (estado.rol === 'asesor') {
        if (estado.alumno) await cargarAlumno(estado.alumno.id);
        await renderCitasAsesor();
        await actualizarPanelNotificaciones();
      } else if (estado.rol === 'alumno' && estado.alumno) {
        await recargarAlumno();
      }
      return true;
    } catch (error) {
      console.warn('[SIGEP] No se pudo leer la información de Supabase:', error);
      return false;
    }
  }

  function renderObservacionesAlumno() {
    const cont = $('#pa-alumno-observaciones-lista');
    if (!cont) return;
    if (!estado.versiones.length) {
      cont.innerHTML = '<div class="pa-empty">Aún no tienes versiones con observaciones.</div>';
      return;
    }
    cont.innerHTML = estado.versiones.map((version) => {
      const observacion = version.observacionAsesor || 'Sin observaciones por ahora.';
      const pendiente = version.estadoEnvio === 'pendiente_envio' ? '<span class="chip warn">Pendiente de envío</span>' : '';
      return `
        <div class="pa-obs-item">
          <span class="ic-box"><i data-ic="file"></i></span>
          <div class="grow">
            <b>${escapar(etiquetaVersion(version.numero))} · V${version.numero}</b>
            <p>${escapar(observacion)}</p>
            <span class="mono">${fecha(version.actualizado)}</span>
          </div>
          <span class="chip ${claseEstado(version.estado)}">${escapar(version.estado)}</span>
          ${pendiente}
          <button class="btn out sm" type="button" data-version="${escapar(version.id)}">Ver</button>
        </div>`;
    }).join('');
    if (window.pintarIconos) window.pintarIconos(cont);
  }

  function actualizarNavObservaciones() {
    const contador = $('#pa-nav-obs');
    if (!contador) return;
    const total = estado.versiones.filter((version) => version.estado === 'Requiere Correcciones' || version.estado === 'No pasa').length;
    contador.textContent = String(total);
    contador.hidden = total === 0;
  }

  async function recargarAlumno(mensaje) {
    if (!estado.alumno) return;
    const versionActual = estado.version && estado.version.id;
    estado.versiones = (await porIndice('versiones', 'alumnoId', estado.alumno.id)).sort((a, b) => a.numero - b.numero);
    renderAlumnoStats();
    renderAlumnoVersionTabs();
    renderObservacionesAlumno();
    await renderNotificaciones();
    await renderCitasAlumno();
    await actualizarPanelNotificaciones();
    actualizarNavObservaciones();
    const elegida = estado.versiones.find((version) => version.id === versionActual) || estado.versiones[0];
    if (elegida) await seleccionarVersionAlumno(elegida.id);
    if (mensaje) toast(mensaje, 'ok');
  }

  function registrarSyncAlumno() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready
        .then((registro) => registro.sync.register(SYNC_TAG))
        .catch((error) => console.warn('[SIGEP] No se pudo registrar el Background Sync:', error));
    }
  }

  /* ---------- Arranque y eventos globales ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    const rol = document.body.dataset.rol;
    if (!rol) return;
    // Sesión de Supabase (compartida con los otros módulos) y rol correcto
    const perfil = window.SIGEPAuth ? await window.SIGEPAuth.verificar(rol) : null;
    if (!perfil) return;
    if (window.SIGEPPintarSesion) window.SIGEPPintarSesion();
    await prepararUsuario(perfil.userId).catch((error) => console.warn('[SIGEP] No se pudo preparar el almacenamiento local:', error));
    estado.rol = rol;
    prepararToast();
    actualizarConexion();
    enlazarPanelNotificaciones();

    if (rol === 'asesor') initAsesor();
    if (rol === 'alumno') initAlumno();

    window.addEventListener('online', () => {
      actualizarConexion();
      toast('Conexión restablecida. Sincronizando datos...', 'ok');
      if (estado.rol === 'asesor') {
        procesarPendientesLocales().catch((error) => console.warn('[SIGEP] No se pudieron procesar pendientes:', error));
        sincronizarDesdeNube().catch((error) => console.warn('[SIGEP] No se pudo sincronizar desde la nube:', error));
        if (estado.version) actualizarBorradores(estado.version.id);
      }
      if (estado.rol === 'alumno') {
        registrarSyncAlumno();
        sincronizarDesdeNube()
          .then(() => recargarAlumno('Estado sincronizado con el dictamen del asesor.'))
          .catch((error) => console.warn('[SIGEP] No se pudo sincronizar desde la nube:', error));
      }
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ tipo: 'sincronizar' });
      }
    });

    window.addEventListener('offline', () => {
      actualizarConexion();
      toast('Sin conexión. El PDF y el checklist siguen disponibles; el chat guardará borradores.', 'warn');
      if (estado.rol === 'asesor' && estado.version) actualizarBorradores(estado.version.id);
    });

    if (CANAL) {
      CANAL.onmessage = (event) => {
        const data = event.data || {};
        if (data.tipo === 'version-actualizada') {
          actualizarPanelNotificaciones().catch(() => {});
          if (estado.rol === 'alumno') {
            recargarAlumno('Tu asesor actualizó el dictamen de una versión.');
          } else if (estado.rol === 'asesor' && estado.version && estado.version.id === data.versionId) {
            cargarVersion(data.versionId);
          }
        }
        if (data.tipo === 'cita-actualizada') {
          actualizarPanelNotificaciones().catch(() => {});
          if (estado.rol === 'alumno') recargarAlumno('Tu asesor actualizó una cita.');
          if (estado.rol === 'asesor') renderCitasAsesor().catch(() => {});
        }
      };
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.tipo === 'sincronizar-dictamenes' || data.tipo === 'observacion-sincronizada') {
          actualizarPanelNotificaciones().catch(() => {});
        }
        if (data.tipo === 'sincronizar-dictamenes' && estado.rol === 'alumno') {
          recargarAlumno('Background Sync: dictamen actualizado.');
        }
        if (data.tipo === 'observacion-sincronizada') {
          if (estado.rol === 'alumno') {
            recargarAlumno('Background Sync: nueva observación recibida.');
          } else if (estado.rol === 'asesor' && estado.version) {
            const ids = Array.isArray(data.versionIds) ? data.versionIds : [];
            if (ids.includes(estado.version.id)) cargarVersion(estado.version.id);
          }
        }
      });
    }
  });
})();
