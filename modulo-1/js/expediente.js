/* ==========================================================================
   expediente.js — Módulo 1: Expediente digital y gestión de documentos
   --------------------------------------------------------------------------
   Antes llamaba a un servidor Express con MySQL (Clever Cloud). Ahora usa el
   mismo Supabase que el resto de SIGEP (../js/config.js):
     · Inicio de sesión con Supabase Auth: las mismas cuentas de los módulos
       3 y 4; la sesión se comparte entre módulos.
     · Alumno: ve su expediente, sube cada PDF (bucket privado
       "expedientes") y consulta observaciones, historial y avance.
     · Asesor: revisa los documentos de sus alumnos asignados y los aprueba
       o pide corrección.
     · Reglas de seguridad RLS en la base de datos (supabase/modulo-1.sql).
     · Sin conexión muestra la última copia guardada en el dispositivo.
   ========================================================================== */
(() => {
  'use strict';

  const { supabaseUrl, supabaseKey, storageKey = 'estadias-sesion' } = window.App?.config || {};
  const BUCKET = 'expedientes';
  const MAX_BYTES = 5 * 1024 * 1024;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const fechaHora = (iso) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const iniciales = (n) => String(n || '?').split(/\s+/).filter((p) => p && !/^(dr|dra|mtro|mtra|ing|lic)\.?$/i.test(p)).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
  const CHIP = { 'Aprobado': 'chip ok', 'En revisión': 'chip warn', 'Requiere corrección': 'chip bad', 'Pendiente': 'chip' };

  if (!window.supabase || !supabaseUrl) {
    document.body.innerHTML = '<p style="padding:24px">Falta la configuración de Supabase (js/config.js).</p>';
    return;
  }
  const cliente = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey },
  });

  const estado = { rol: null, usuario: null, perfil: null, tipos: [], expediente: null, documentos: [], revisiones: [], historial: [], alumnos: [], expedientes: [] };

  /* ---------- Mensajes de error en español ---------- */
  function mensaje(error) {
    const m = String(error?.message || error || '');
    if (/^(Solo |El archivo|No se |El tipo|El documento|Estado no|Escribe )/.test(m)) return m;
    if (/failed to fetch|network|load failed/i.test(m)) return 'No hay conexión con el servidor. Revisa tu internet.';
    if (/mime|type/i.test(m) && /pdf|application/i.test(m)) return 'Solo se aceptan archivos PDF.';
    if (/too large|maximum allowed size|413/i.test(m)) return 'El archivo pesa más de 5 MB.';
    if (/row-level security|permission|42501|403/i.test(m)) return 'No tienes permiso para hacer esto.';
    return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }

  /* ---------- Copia local para usar sin conexión ---------- */
  const claveCopia = () => `sigep-m1:${estado.usuario?.id || 'anon'}`;
  function guardarCopia() {
    try {
      const { rol, perfil, tipos, expediente, documentos, revisiones, historial, alumnos, expedientes } = estado;
      localStorage.setItem(claveCopia(), JSON.stringify({ rol, perfil, tipos, expediente, documentos, revisiones, historial, alumnos, expedientes, guardadoEn: Date.now() }));
    } catch { /* sin almacenamiento */ }
  }
  function leerCopia() {
    try { return JSON.parse(localStorage.getItem(claveCopia()) || 'null'); } catch { return null; }
  }

  /* ---------- Sesión y rol ---------- */
  async function iniciarSesion() {
    const { data } = await cliente.auth.getSession();
    if (!data.session) { location.replace('login.html'); return false; }
    estado.usuario = data.session.user;
    if (!navigator.onLine) {
      const copia = leerCopia();
      if (!copia) { location.replace('login.html'); return false; }
      Object.assign(estado, copia);
      return true;
    }
    const [asesor, alumno] = await Promise.all([
      cliente.from('asesores').select('nombre, correo').eq('id', estado.usuario.id).maybeSingle(),
      cliente.from('alumnos').select('nombre, matricula, correo, nivel').eq('id', estado.usuario.id).maybeSingle(),
    ]);
    if (asesor.data) { estado.rol = 'asesor'; estado.perfil = asesor.data; }
    else if (alumno.data) { estado.rol = 'alumno'; estado.perfil = alumno.data; }
    else {
      const copia = leerCopia();
      if (copia) { Object.assign(estado, copia); return true; }
      await cliente.auth.signOut({ scope: 'local' });
      location.replace('login.html?sin-rol=1');
      return false;
    }
    return true;
  }

  /* ---------- Carga de datos ---------- */
  async function cargarComunes(ids) {
    if (!ids.length) { estado.revisiones = []; estado.historial = []; return; }
    const [rev, his] = await Promise.all([
      cliente.from('revisiones_documento').select('id, documento_id, comentario, estado_revision, fecha_revision, asesor:asesores (nombre)')
        .in('documento_id', ids).order('fecha_revision', { ascending: false }),
      cliente.from('historial_documentos').select('id, documento_id, accion, usuario, fecha')
        .in('documento_id', ids).order('fecha', { ascending: false }),
    ]);
    if (rev.error) throw rev.error;
    if (his.error) throw his.error;
    estado.revisiones = rev.data;
    estado.historial = his.data;
  }

  async function cargarAlumno() {
    const [tipos, exp] = await Promise.all([
      cliente.from('tipos_documento').select('*').order('id'),
      cliente.rpc('mi_expediente'),
    ]);
    if (tipos.error) throw tipos.error;
    if (exp.error) throw exp.error;
    estado.tipos = tipos.data;
    estado.expediente = Array.isArray(exp.data) ? exp.data[0] : exp.data;
    const docs = await cliente.from('documentos')
      .select('id, tipo_documento_id, archivo_path, nombre_archivo, version, estado, fecha_subida')
      .eq('expediente_id', estado.expediente.id);
    if (docs.error) throw docs.error;
    estado.documentos = docs.data;
    await cargarComunes(docs.data.map((d) => d.id));
  }

  async function cargarAsesor() {
    const [tipos, alumnos, expedientes, docs] = await Promise.all([
      cliente.from('tipos_documento').select('*').order('id'),
      cliente.from('alumnos').select('id, nombre, matricula'),
      cliente.from('expedientes').select('id, alumno_id, estado_general'),
      cliente.from('documentos').select('id, expediente_id, tipo_documento_id, archivo_path, nombre_archivo, version, estado, fecha_subida'),
    ]);
    for (const r of [tipos, alumnos, expedientes, docs]) if (r.error) throw r.error;
    estado.tipos = tipos.data;
    estado.alumnos = alumnos.data.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    estado.expedientes = expedientes.data;
    estado.documentos = docs.data;
    await cargarComunes(docs.data.map((d) => d.id));
  }

  async function cargar() {
    $('aviso-conexion').hidden = navigator.onLine;
    if (!navigator.onLine) {
      const copia = leerCopia();
      if (copia) Object.assign(estado, copia);
      pintarTodo();
      return;
    }
    try {
      if (estado.rol === 'alumno') await cargarAlumno(); else await cargarAsesor();
      guardarCopia();
    } catch (error) {
      console.error(error);
      const copia = leerCopia();
      if (copia) { Object.assign(estado, copia); $('aviso-conexion').hidden = false; }
      else toast(mensaje(error));
    }
    pintarTodo();
  }

  /* ---------- Utilidades de dibujo ---------- */
  const nombreTipo = (id) => estado.tipos.find((t) => t.id === id)?.nombre || 'Documento';
  const documento = (id) => estado.documentos.find((d) => d.id === id);
  const alumnoDeDocumento = (doc) => {
    const exp = estado.expedientes.find((e) => e.id === doc.expediente_id);
    return estado.alumnos.find((a) => a.id === exp?.alumno_id);
  };
  function pintarIconosEn(nodo) { if (typeof window.pintarIconos === 'function') window.pintarIconos(nodo); }

  function toast(texto) {
    let zona = $('m1-toast');
    if (!zona) {
      zona = document.createElement('div');
      zona.id = 'm1-toast';
      zona.setAttribute('role', 'status');
      zona.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:1100;width:min(440px,calc(100% - 32px))';
      document.body.append(zona);
    }
    zona.innerHTML = `<div style="background:var(--side);color:var(--side-text);padding:12px 16px;border-radius:12px;box-shadow:var(--sombra-pop);font-size:.9rem">${esc(texto)}</div>`;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { zona.innerHTML = ''; }, 5000);
  }

  /* ---------- Vista del alumno ---------- */
  function filasAlumno() {
    return estado.tipos.map((tipo) => {
      const doc = estado.documentos.find((d) => d.tipo_documento_id === tipo.id);
      return doc ? { ...doc, tipo: tipo.nombre } : { id: null, tipo: tipo.nombre, tipo_documento_id: tipo.id, estado: 'Pendiente', version: 0, fecha_subida: null };
    });
  }

  function pintarAlumno() {
    const filas = filasAlumno();
    $('sub-expediente').textContent = `Expediente de ${estado.perfil.nombre} · Matrícula ${estado.perfil.matricula || '—'}`;
    $('tabla-documentos').querySelector('tbody').innerHTML = filas.map((d) => {
      const accion = d.id === null
        ? `<button class="btn sm" type="button" data-subir="${d.tipo_documento_id}">Subir</button>`
        : `<div class="acciones-fila"><button class="btn out xs" type="button" data-ver="${esc(d.id)}">Ver</button>${d.estado === 'Requiere corrección' ? `<button class="btn sm" type="button" data-subir="${d.tipo_documento_id}">Subir corrección</button>` : ''}</div>`;
      return `<tr data-estado="${esc(d.estado)}">
        <td><div class="who"><span class="ic-box" style="margin:0"><i data-ic="file"></i></span>
          <div><b>${esc(d.tipo)}</b><small>${d.version ? `PDF · v${d.version}` : 'Sin archivo'}</small></div></div></td>
        <td class="num">${fecha(d.fecha_subida)}</td>
        <td><span class="${CHIP[d.estado] || 'chip'}">${esc(d.estado)}</span></td>
        <td>${accion}</td></tr>`;
    }).join('');
    pintarIconosEn($('tabla-documentos'));

    const total = filas.length;
    const subidos = filas.filter((d) => d.id !== null).length;
    const aprobados = filas.filter((d) => d.estado === 'Aprobado').length;
    // El avance cuenta cada documento subido, sin importar si ya se aprobó;
    // dentro de la barra, la parte verde son los aprobados
    const porcentaje = total ? Math.round((subidos / total) * 100) : 0;
    const pctAprobados = total ? Math.round((aprobados / total) * 100) : 0;
    ['barra-progreso', 'barra-progreso-grande'].forEach((id) => { $(id).style.width = `${porcentaje}%`; });
    ['barra-aprobados', 'barra-aprobados-grande'].forEach((id) => { $(id).style.width = `${pctAprobados}%`; });
    $('barra-avance').setAttribute('aria-valuenow', String(porcentaje));
    $('porcentaje-avance').textContent = `${porcentaje}%`;
    $('porcentaje-avance-grande').textContent = `${porcentaje}%`;
    $('texto-progreso').textContent = `${subidos} de ${total} subidos · ${aprobados} aprobados`;
    $('texto-avance-grande').textContent = `${subidos} de ${total} documentos subidos y ${aprobados} aprobados. Estado del expediente: ${estado.expediente?.estado_general || 'En proceso'}.`;
    $('stat-total').textContent = total;
    $('stat-aprobados').textContent = aprobados;
    $('stat-revision').textContent = filas.filter((d) => d.estado === 'En revisión').length;
    $('stat-correccion').textContent = filas.filter((d) => d.estado === 'Requiere corrección').length;

    const select = $('tipo-documento');
    select.innerHTML = '<option value="">Selecciona uno…</option>' + estado.tipos.map((t) => `<option value="${t.id}">${esc(t.nombre)}</option>`).join('');
  }

  /* ---------- Vista del asesor ---------- */
  function pintarAsesor() {
    $('sub-revisar').textContent = `${estado.perfil.nombre} · ${estado.alumnos.length} ${estado.alumnos.length === 1 ? 'alumno asignado' : 'alumnos asignados'}`;
    const docs = [...estado.documentos].sort((a, b) => new Date(b.fecha_subida) - new Date(a.fecha_subida));
    const pendientes = docs.filter((d) => d.estado === 'En revisión').length;
    $('rev-alumnos').textContent = estado.alumnos.length;
    $('rev-pendientes').textContent = pendientes;
    $('rev-aprobados').textContent = docs.filter((d) => d.estado === 'Aprobado').length;
    $('rev-completos').textContent = estado.expedientes.filter((e) => e.estado_general === 'Completo').length;
    $('cuenta-revisar').hidden = pendientes === 0;
    $('cuenta-revisar').textContent = pendientes;

    const tbody = $('tabla-revisar').querySelector('tbody');
    tbody.innerHTML = docs.length ? docs.map((d) => {
      const alumno = alumnoDeDocumento(d);
      return `<tr data-estado="${esc(d.estado)}">
        <td><div class="who"><span class="avatar">${esc(iniciales(alumno?.nombre))}</span><div><b>${esc(alumno?.nombre || 'Alumno')}</b><small class="num">${esc(alumno?.matricula || '')}</small></div></div></td>
        <td><b>${esc(nombreTipo(d.tipo_documento_id))}</b><br><small class="muted">PDF · v${d.version}</small></td>
        <td class="num">${fecha(d.fecha_subida)}</td>
        <td><span class="${CHIP[d.estado] || 'chip'}">${esc(d.estado)}</span></td>
        <td><div class="acciones-fila"><button class="btn out xs" type="button" data-ver="${esc(d.id)}">Ver</button>
          <button class="btn sm" type="button" data-revisar="${esc(d.id)}">Revisar</button></div></td></tr>`;
    }).join('') : '<tr><td colspan="5" class="vacio">Tus alumnos aún no han subido documentos.</td></tr>';
    pintarIconosEn(tbody);
    filtrarTabla('#tabla-revisar');
  }

  // Aplica el filtro de la pestaña seleccionada (sigep.js solo filtra al hacer clic)
  function filtrarTabla(selector) {
    const tabs = document.querySelector(`.tabs[data-tabla="${selector}"]`);
    const filtro = tabs?.querySelector('[aria-selected="true"]')?.dataset.filtro || '';
    document.querySelectorAll(`${selector} tbody tr[data-estado]`).forEach((tr) => { tr.hidden = !!filtro && tr.dataset.estado !== filtro; });
  }

  /* ---------- Observaciones e historial (ambos) ---------- */
  function pintarComunes() {
    const titulo = (docId) => {
      const doc = documento(docId);
      if (!doc) return 'Documento';
      const alumno = estado.rol === 'asesor' ? alumnoDeDocumento(doc) : null;
      return `${nombreTipo(doc.tipo_documento_id)}${alumno ? ` · ${alumno.nombre}` : ''}`;
    };
    $('sub-observaciones').textContent = estado.rol === 'asesor' ? 'Comentarios que has dejado a tus alumnos' : 'Comentarios de tu asesor';
    $('lista-observaciones').innerHTML = estado.revisiones.length ? estado.revisiones.map((r) => `
      <div class="r"><span class="ic-box" style="margin:0"><i data-ic="userCheck"></i></span>
        <div class="grow"><b>${esc(titulo(r.documento_id))}</b>
          <p class="small" style="margin-top:4px">${esc(r.comentario || (r.estado_revision === 'Aprobado' ? 'Documento aprobado.' : ''))}</p>
          <small class="mono">${esc(r.asesor?.nombre || 'Asesor')} · ${esc(fechaHora(r.fecha_revision))}</small></div>
        <span class="${CHIP[r.estado_revision]}">${esc(r.estado_revision)}</span></div>`).join('')
      : '<p class="vacio">Aún no hay observaciones.</p>';
    $('lista-historial').innerHTML = estado.historial.length ? estado.historial.map((h) => `
      <div class="r"><span class="ic-box" style="margin:0"><i data-ic="history"></i></span>
        <div class="grow"><b>${esc(h.accion)}</b>
          <p class="small" style="margin-top:4px">${esc(titulo(h.documento_id))}</p>
          <small class="mono">${esc(fechaHora(h.fecha))} · Por: ${esc(h.usuario)}</small></div></div>`).join('')
      : '<p class="vacio">Aún no hay movimientos registrados.</p>';
    pintarIconosEn($('lista-observaciones'));
    pintarIconosEn($('lista-historial'));
  }

  function pintarTodo() {
    $('avatar').textContent = iniciales(estado.perfil?.nombre);
    $('avatar').title = estado.perfil?.nombre || '';
    document.querySelectorAll('[data-solo]').forEach((el) => { el.hidden = el.dataset.solo !== estado.rol; });
    if (estado.rol === 'alumno') pintarAlumno(); else pintarAsesor();
    pintarComunes();
  }

  /* ---------- Navegación entre vistas ---------- */
  const TITULOS = { documentos: 'Mis documentos', revisar: 'Revisar documentos', observaciones: 'Observaciones', historial: 'Historial de versiones', avance: 'Avance del expediente' };
  function cambiarVista(vista) {
    document.querySelectorAll('.dashboard-view').forEach((v) => v.classList.toggle('active', v.id === `view-${vista}`));
    document.querySelectorAll('.side-nav [data-vista]').forEach((a) => {
      a.classList.toggle('active', a.dataset.vista === vista);
      if (a.dataset.vista === vista) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $('crumb-text').textContent = TITULOS[vista] || 'Módulo 1';
    document.querySelector('.shell')?.classList.remove('menu-abierto');
    if (location.hash !== `#${vista}`) history.replaceState(null, '', `#${vista}`);
  }

  /* ---------- Modales ---------- */
  const abrirModal = (id) => { $(id).style.display = 'flex'; };
  function cerrarModales() {
    document.querySelectorAll('.modal-overlay').forEach((m) => { m.style.display = 'none'; });
    $('form-subir-documento').reset();
    $('form-revisar').reset();
    $('error-subir').textContent = '';
    $('error-revisar').textContent = '';
  }

  function abrirSubir(tipoId) {
    if (!navigator.onLine) { toast('Necesitas conexión a internet para subir documentos.'); return; }
    abrirModal('modal-subir');
    if (tipoId) $('tipo-documento').value = String(tipoId);
  }

  async function subirDocumento(event) {
    event.preventDefault();
    const tipo = Number($('tipo-documento').value);
    const archivo = $('archivo-pdf').files[0];
    const error = $('error-subir');
    if (!tipo) { error.textContent = 'Elige el tipo de documento.'; return; }
    if (!archivo) { error.textContent = 'Elige el archivo PDF.'; return; }
    if (archivo.type !== 'application/pdf' && !/\.pdf$/i.test(archivo.name)) { error.textContent = 'Solo se aceptan archivos PDF.'; return; }
    if (archivo.size > MAX_BYTES) { error.textContent = 'El archivo pesa más de 5 MB.'; return; }

    const boton = $('btn-subir');
    boton.disabled = true;
    boton.textContent = 'Subiendo…';
    const ruta = `${estado.usuario.id}/${crypto.randomUUID()}.pdf`;
    try {
      const subida = await cliente.storage.from(BUCKET).upload(ruta, archivo, { contentType: 'application/pdf', upsert: false });
      if (subida.error) throw subida.error;
      const { data, error: e } = await cliente.rpc('subir_documento', { p_tipo: tipo, p_path: ruta, p_nombre: archivo.name });
      if (e) {
        await cliente.storage.from(BUCKET).remove([ruta]).catch(() => {});
        throw e;
      }
      const doc = Array.isArray(data) ? data[0] : data;
      avisar(doc.id); // notificación push para el asesor
      cerrarModales();
      toast(`«${nombreTipo(tipo)}» se subió como versión ${doc.version}. Tu asesor ya puede revisarlo.`);
      await cargar();
    } catch (err) {
      error.textContent = mensaje(err);
    } finally {
      boton.disabled = false;
      boton.textContent = 'Subir documento';
    }
  }

  function abrirRevisar(docId) {
    if (!navigator.onLine) { toast('Necesitas conexión a internet para revisar documentos.'); return; }
    const doc = documento(docId);
    if (!doc) return;
    const alumno = alumnoDeDocumento(doc);
    $('form-revisar').dataset.documento = docId;
    $('revisar-detalle').textContent = `${nombreTipo(doc.tipo_documento_id)} · ${alumno?.nombre || ''} · versión ${doc.version}`;
    abrirModal('modal-revisar');
  }

  async function revisarDocumento(event) {
    event.preventDefault();
    const docId = event.target.dataset.documento;
    const estadoNuevo = $('revisar-estado').value;
    const comentario = $('revisar-comentario').value.trim();
    if (estadoNuevo === 'Requiere corrección' && !comentario) { $('error-revisar').textContent = 'Escribe qué debe corregir el alumno.'; return; }
    const boton = $('btn-revisar');
    boton.disabled = true;
    try {
      const { error } = await cliente.rpc('revisar_documento', { p_documento: docId, p_estado: estadoNuevo, p_comentario: comentario || null });
      if (error) throw error;
      avisar(docId); // notificación push para el alumno
      cerrarModales();
      toast(`Revisión guardada: ${estadoNuevo}. El alumno ya puede verla.`);
      await cargar();
    } catch (err) {
      $('error-revisar').textContent = mensaje(err);
    } finally {
      boton.disabled = false;
    }
  }

  async function verDocumento(docId) {
    const doc = documento(docId);
    if (!doc) return;
    if (!navigator.onLine) { toast('Necesitas conexión a internet para abrir el archivo.'); return; }
    const { data, error } = await cliente.storage.from(BUCKET).createSignedUrl(doc.archivo_path, 120);
    if (error) { toast(mensaje(error)); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  /* ---------- Notificaciones push (función enviar-push del Módulo 4) ---------- */
  async function avisar(documentoId) {
    try { await cliente.functions.invoke('enviar-push', { body: { accion: 'avisar-documento', documento: documentoId } }); } catch { /* el aviso es un extra */ }
  }

  function bytes(b64) {
    const base = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base), (c) => c.charCodeAt(0));
  }

  async function activarNotificaciones() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { toast('Este navegador no admite notificaciones push.'); return; }
    if (!navigator.onLine) { toast('Necesitas conexión a internet para activar las notificaciones.'); return; }
    try {
      if (await Notification.requestPermission() !== 'granted') { toast('No diste permiso para mostrar notificaciones.'); return; }
      const { data, error } = await cliente.functions.invoke('enviar-push', { body: { accion: 'clave' } });
      if (error || !data?.clave) throw new Error('El servidor de notificaciones no está configurado todavía.');
      const registro = await navigator.serviceWorker.getRegistration();
      if (!registro) throw new Error('La app todavía no termina de instalarse. Recarga la página.');
      const suscripcion = await registro.pushManager.getSubscription()
        || await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(data.clave) });
      const { endpoint, keys } = suscripcion.toJSON();
      const r = await cliente.rpc('registrar_push', { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth });
      if (r.error) throw r.error;
      toast('Notificaciones activadas. Te avisaremos aunque la app esté cerrada.');
    } catch (err) {
      toast(err.message?.startsWith('El servidor') || err.message?.startsWith('La app') ? err.message : mensaje(err));
    }
  }

  async function cerrarSesion() {
    try { localStorage.removeItem(claveCopia()); } catch { /* sin almacenamiento */ }
    await cliente.auth.signOut({ scope: 'local' }).catch(() => {});
    location.replace('login.html');
  }

  /* ---------- Eventos ---------- */
  document.addEventListener('click', (e) => {
    const vista = e.target.closest('.side-nav [data-vista]');
    if (vista) { e.preventDefault(); cambiarVista(vista.dataset.vista); return; }
    if (e.target.closest('[data-accion="subir"]')) { e.preventDefault(); abrirSubir(); return; }
    const subir = e.target.closest('[data-subir]');
    if (subir) { abrirSubir(subir.dataset.subir); return; }
    const ver = e.target.closest('[data-ver]');
    if (ver) { verDocumento(ver.dataset.ver); return; }
    const revisar = e.target.closest('[data-revisar]');
    if (revisar) { abrirRevisar(revisar.dataset.revisar); return; }
    if (e.target.closest('[data-cerrar-modal]') || e.target.classList.contains('modal-overlay')) { cerrarModales(); return; }
    if (e.target.closest('[data-activar-push], #btn-notificaciones')) { activarNotificaciones(); return; }
    if (e.target.closest('[data-cerrar-sesion]')) cerrarSesion();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModales(); });
  $('form-subir-documento').addEventListener('submit', subirDocumento);
  $('form-revisar').addEventListener('submit', revisarDocumento);
  $('revisar-estado').addEventListener('change', () => { $('error-revisar').textContent = ''; });
  window.addEventListener('online', () => cargar());
  window.addEventListener('offline', () => { $('aviso-conexion').hidden = false; });

  // PWA: el service worker del módulo guarda la app para usarla sin conexión
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => navigator.serviceWorker.register('serviceworker.js').catch(() => {}));
  }

  // Vista del #hash, si el rol la puede ver; si no, la vista principal del rol
  const vistaDelHash = () => {
    const vista = (location.hash || '').slice(1);
    return TITULOS[vista] && (vista !== 'revisar' || estado.rol === 'asesor') && (!['documentos', 'avance'].includes(vista) || estado.rol === 'alumno')
      ? vista : (estado.rol === 'asesor' ? 'revisar' : 'documentos');
  };

  (async () => {
    if (!(await iniciarSesion())) return;
    cambiarVista(vistaDelHash());
    // Enlaces de otros módulos o de una notificación con la página ya abierta
    window.addEventListener('hashchange', () => cambiarVista(vistaDelHash()));
    await cargar();
  })();
})();
