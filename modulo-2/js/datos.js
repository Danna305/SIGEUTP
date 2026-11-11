/* =====================================================================
   SIGEP UTP · Módulo 2 · Conexión con Supabase
   ---------------------------------------------------------------------
   Antes el panel hablaba con un servidor Node.js (rutas /api/...). Ahora
   este archivo atiende esas mismas rutas directamente con el Supabase de
   SIGEP, así el resto del panel (js/app.js) casi no cambió:

     M2.pedir('PUT', '/alumnos/<id>', datos)  →  { version, permisos, datos, mensaje }

   · Sesión: Supabase Auth, compartida con los módulos 1, 3 y 4.
   · Lecturas: tablas con reglas RLS (solo personal de coordinación).
   · Cambios: funciones de la base de datos que revisan el permiso del rol
     (m2_asignar, m2_guardar_alumno…) o tablas con RLS por permiso.
   · Altas y bajas de cuentas: Edge Function «gestion-cuentas».
   · Sin conexión: la última copia de los datos se guarda en la caché
     «sigep-m2-datos-v1» y el panel se puede consultar sin internet.
   Depende de ../js/vendor/supabase.js, ../js/config.js y js/radar.js.
   ===================================================================== */
window.M2 = (() => {
  'use strict';

  const config = (window.App && window.App.config) || {};
  const cliente = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: config.storageKey || 'estadias-sesion' }
  });

  const CACHE_DATOS = 'sigep-m2-datos-v1';
  const URL_DATOS = new URL('datos/estado.json', location.href).href;
  const CLAVE_PERFIL = 'sigep-m2-perfil';
  const DOC_TIPO = { 1: 'presentacion', 2: 'aceptacion', 3: 'seguro', 4: 'ine' };
  const DOC_ESTADO = { 'En revisión': 'cargado', 'Aprobado': 'aprobado', 'Requiere corrección': 'rechazado' };
  const CARRERAS = ['ISC', 'IMT', 'IIN', 'LNM', 'IER'];
  const PERMISOS = ['alumnos.ver', 'alumnos.editar', 'asesores.ver', 'asesores.editar', 'asignaciones.editar', 'periodos.ver',
    'periodos.editar', 'empresas.ver', 'empresas.editar', 'expedientes.ver', 'usuarios.ver', 'usuarios.editar'];

  let D = null;            // últimos datos leídos (para validar duplicados)
  let PERFIL = null;       // { id, nombre, email, rol_id, rol, permisos }
  let rojosPrevios = null; // alumnos en riesgo alto la última vez (alertas push)

  const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const txt = (v, max = 160) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const esCorreo = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v));
  const fmtFecha = (v) => new Date(v + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

  class ErrorM2 extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }
  const fallo = (msg, status) => { throw new ErrorM2(msg, status); };

  // Convierte los errores de Supabase en mensajes para la persona
  function traducir(error) {
    if (!error) return new ErrorM2('Ocurrió un error.');
    if (error instanceof ErrorM2) return error;
    const m = String(error.message || error);
    if (/failed to fetch|networkerror|load failed|fetch/i.test(m) && !navigator.onLine) return new ErrorM2('Sin conexión. Los cambios necesitan internet.', 0);
    if (/failed to fetch|networkerror|load failed/i.test(m)) return new ErrorM2('No se pudo conectar con la base de datos. Revisa tu internet.', 0);
    if (error.code === '42501' || /permission denied|row-level security/i.test(m)) return new ErrorM2('Tu rol no tiene permiso para esta acción.', 403);
    if (error.code === '23505') {
      if (/clave/.test(m)) return new ErrorM2('Ya existe un periodo con esa clave.', 409);
      if (/empresas_nombre/.test(m)) return new ErrorM2('Ya existe una empresa con ese nombre.', 409);
      return new ErrorM2('Ese registro ya existe.', 409);
    }
    if (error.code === '23503') return new ErrorM2('Hay registros que dependen de este; no se puede eliminar.', 409);
    if (error.code === '23514') return new ErrorM2('Algún dato no tiene un formato válido.', 400);
    if (/JWT|session/i.test(m)) return new ErrorM2('Tu sesión terminó. Vuelve a iniciar sesión.', 401);
    return new ErrorM2(m);
  }
  const ok = ({ data, error }) => { if (error) throw traducir(error); return data; };

  // Llama una Edge Function y devuelve su JSON (o el mensaje de error que envía)
  async function funcion(nombre, cuerpo) {
    const { data, error } = await cliente.functions.invoke(nombre, { body: cuerpo });
    if (error) {
      let msg = null;
      try { msg = (await error.context.json()).error; } catch (e) { /* sin cuerpo */ }
      if (!msg && !navigator.onLine) msg = 'Sin conexión. Los cambios necesitan internet.';
      throw new ErrorM2(msg || `El servicio «${nombre}» no respondió. ¿Ya está publicado en Supabase?`, error.context?.status || 400);
    }
    return data;
  }

  /* ---------- Sesión ---------- */
  function perfilGuardado(userId) {
    try { const p = JSON.parse(localStorage.getItem(CLAVE_PERFIL) || 'null'); return p && p.id === userId ? p : null; } catch (e) { return null; }
  }

  // Perfil del personal con sesión; null si no hay sesión; { sinAcceso } si la cuenta no es de coordinación
  async function sesion() {
    const { data } = await cliente.auth.getSession();
    const usuario = data.session && data.session.user;
    if (!usuario) return null;
    try {
      const p = ok(await cliente.rpc('mi_personal'));
      if (!p) return { sinAcceso: true };
      if (!p.activo) return { sinAcceso: true, inactivo: true };
      PERFIL = { id: p.id, nombre: p.nombre, email: p.email, rol_id: p.rol_id, rol: p.rol, permisos: p.permisos || [] };
      try { localStorage.setItem(CLAVE_PERFIL, JSON.stringify(PERFIL)); } catch (e) { /* sin almacenamiento */ }
      return PERFIL;
    } catch (e) {
      // Sin conexión: se usa el perfil guardado de esa misma cuenta
      PERFIL = perfilGuardado(usuario.id);
      return PERFIL;
    }
  }

  async function entrar(email, password) {
    if (!navigator.onLine) fallo('Necesitas conexión a internet para iniciar sesión.');
    const { error } = await cliente.auth.signInWithPassword({ email: txt(email, 120).toLowerCase(), password: String(password || '') });
    if (error) fallo(/invalid login credentials/i.test(error.message) ? 'Correo o contraseña incorrectos.' : 'No se pudo iniciar sesión. Inténtalo de nuevo.', 401);
    const p = await sesion();
    if (!p || p.sinAcceso) {
      await cliente.auth.signOut({ scope: 'local' });
      fallo(p && p.inactivo ? 'Tu usuario está desactivado. Contacta al administrador.' : 'Esta cuenta no pertenece al personal de coordinación. Alumnos y asesores usan los módulos 1, 3 y 4.', 403);
    }
    return p;
  }

  async function salir() {
    PERFIL = null; D = null; rojosPrevios = null;
    try { localStorage.removeItem(CLAVE_PERFIL); } catch (e) { /* sin almacenamiento */ }
    if ('caches' in window) await caches.delete(CACHE_DATOS).catch(() => {});
    await cliente.auth.signOut({ scope: 'local' }).catch(() => {});
  }

  // Datos que necesita el Service Worker para enviar la cola sin la página abierta
  async function credenciales() {
    const { data } = await cliente.auth.getSession();
    return data.session ? { token: data.session.access_token, url: config.supabaseUrl, key: config.supabaseKey } : null;
  }
  const alCambiarSesion = (fn) => cliente.auth.onAuthStateChange((evento) => fn(evento));

  /* ---------- Lectura de todos los datos del panel ---------- */
  const puede = (p) => !!(PERFIL && PERFIL.permisos.includes(p));

  async function leerTodo() {
    const [roles, personal, periodos, empresas, contactos, asesores, alumnos, asignaciones, documentos, actividad, version] = await Promise.all([
      cliente.from('roles_admin').select('id, nombre, descripcion, permisos, sistema').order('orden'),
      puede('usuarios.ver') ? cliente.from('personal_admin').select('id, nombre, correo, rol_id, activo, ultimo_acceso').order('nombre') : Promise.resolve({ data: [] }),
      cliente.from('periodos').select('*').order('inicio'),
      cliente.from('empresas').select('*').order('creado_en', { ascending: false }),
      cliente.from('contactos_empresa').select('*').order('nombre'),
      cliente.from('asesores').select('id, nombre, correo, telefono, carrera, area, capacidad, activo').order('nombre'),
      cliente.from('alumnos').select('id, matricula, nombre, correo, nivel, telefono, carrera, grupo, periodo_id, empresa_id, proyecto, estado, creado_en').order('creado_en', { ascending: false }),
      cliente.from('asignaciones_asesor').select('alumno_id, asesor_id, periodo_id, tipo, asignado_en'),
      puede('expedientes.ver') ? cliente.from('documentos').select('tipo_documento_id, estado, expedientes (alumno_id)') : Promise.resolve({ data: [] }),
      cliente.from('bitacora_admin').select('fecha, usuario, accion').order('id', { ascending: false }).limit(30),
      cliente.rpc('m2_version_actual')
    ]);
    [roles, personal, periodos, empresas, contactos, asesores, alumnos, asignaciones, documentos, actividad, version].forEach(ok);

    // Expediente (Módulo 1): estado de cada documento por alumno
    const expedientes = new Map();
    (documentos.data || []).forEach((d) => {
      const alumnoId = d.expedientes && d.expedientes.alumno_id;
      if (!alumnoId) return;
      if (!expedientes.has(alumnoId)) expedientes.set(alumnoId, {});
      expedientes.get(alumnoId)[DOC_TIPO[d.tipo_documento_id]] = DOC_ESTADO[d.estado] || 'pendiente';
    });
    const expedienteDe = (id) => Object.fromEntries(Object.values(DOC_TIPO).map((k) => [k, (expedientes.get(id) || {})[k] || 'pendiente']));

    const datos = {
      roles: roles.data,
      usuarios: (personal.data || []).map((u) => ({ id: u.id, nombre: u.nombre, email: u.correo, rol_id: u.rol_id, activo: u.activo, ultimo_acceso: u.ultimo_acceso })),
      periodos: periodos.data,
      empresas: empresas.data.map((e) => ({ ...e, rfc: e.rfc || '', ciudad: e.ciudad || '', direccion: e.direccion || '', vence: e.vence || '' })),
      contactos_empresa: contactos.data.map((c) => ({ ...c, puesto: c.puesto || '', email: c.email || '', telefono: c.telefono || '' })),
      asesores: asesores.data.map((t) => ({ id: t.id, nombre: t.nombre, email: t.correo, telefono: t.telefono || '', carrera: t.carrera || '', area: t.area || 'Sin área', capacidad: t.capacidad, activo: t.activo })),
      alumnos: alumnos.data.map((a) => ({
        id: a.id, matricula: a.matricula, nombre: a.nombre, email: a.correo, nivel: a.nivel, telefono: a.telefono || '',
        carrera: a.carrera || '', grupo: a.grupo || '', periodo_id: a.periodo_id || '', empresa_id: a.empresa_id || '',
        proyecto: a.proyecto || '', estado: a.estado || 'activo', expediente: expedienteDe(a.id)
      })),
      asignaciones_asesor: asignaciones.data.map((g) => ({ id: g.alumno_id, alumno_id: g.alumno_id, asesor_id: g.asesor_id, periodo_id: g.periodo_id || '', tipo: g.tipo || 'individual', fecha: String(g.asignado_en || '').slice(0, 10) })),
      actividad: actividad.data
    };
    return { version: Number(version.data) || 0, permisos: PERFIL ? PERFIL.permisos : [], datos };
  }

  // Lee de Supabase y guarda la copia; sin conexión devuelve la última copia guardada
  async function estado() {
    try {
      // Sin conexión no se espera a la red; si Supabase tarda más de 6 s, también se usa la copia
      if (!navigator.onLine) throw new ErrorM2('Sin conexión.', 0);
      const r = await Promise.race([
        leerTodo(),
        new Promise((_, rechazar) => setTimeout(() => rechazar(new ErrorM2('La base de datos no responde.', 0)), 6000))
      ]);
      D = r.datos;
      await guardarCopia(r);
      revisarRiesgo().catch(() => {});
      return r;
    } catch (e) {
      const copia = await leerCopia();
      if (copia) { D = copia.datos; return { ...copia, sinConexion: true }; }
      throw traducir(e);
    }
  }

  async function guardarCopia(r) {
    if (!('caches' in window)) return;
    try {
      const cache = await caches.open(CACHE_DATOS);
      await cache.put(URL_DATOS, new Response(JSON.stringify(r), {
        headers: { 'Content-Type': 'application/json', 'sw-fecha': new Date().toISOString() }
      }));
    } catch (e) { /* sin espacio o sin Cache API */ }
  }
  async function leerCopia() {
    if (!('caches' in window)) return null;
    try { const r = await caches.match(URL_DATOS); return r ? await r.json() : null; } catch (e) { return null; }
  }

  async function version() {
    return { version: Number(ok(await cliente.rpc('m2_version_actual'))) || 0 };
  }

  /* ---------- Alertas del Radar de Estadías ---------- */
  // Después de un cambio, si algún alumno pasó a riesgo alto, avisa al personal
  async function revisarRiesgo() {
    if (!D || !window.Radar || !puede('alumnos.ver')) return;
    const r = window.Radar.calcular(D, hoy());
    const rojos = r.alumnos.filter((a) => a.nivel === 'alto');
    const nuevos = rojosPrevios ? rojos.filter((a) => !rojosPrevios.has(a.id)) : [];
    rojosPrevios = new Set(rojos.map((a) => a.id));
    if (!nuevos.length || !navigator.onLine) return;
    const primero = nuevos[0];
    await funcion('enviar-push', {
      accion: 'radar', rojos: r.conteo.alto,
      titulo: nuevos.length === 1 ? `${primero.nombre} pasó a riesgo alto` : `${nuevos.length} alumnos pasaron a riesgo alto`,
      texto: `${primero.nombre}: ${primero.motivos.map((m) => m.t).join(', ')}. Hay ${r.conteo.alto} en rojo en total.`
    }).catch(() => {});
  }

  /* ---------- Validaciones (las mismas reglas que tenía el servidor) ---------- */
  const T = () => D || { alumnos: [], asesores: [], periodos: [], empresas: [], usuarios: [], roles: [] };

  function validarAlumno(b, id) {
    const a = {
      matricula: txt(b.matricula, 10), nombre: txt(b.nombre, 90), email: txt(b.email, 90).toLowerCase(), nivel: txt(b.nivel, 12),
      telefono: txt(b.telefono, 20), carrera: txt(b.carrera, 3), grupo: txt(b.grupo, 3).toUpperCase(),
      periodo_id: txt(b.periodo_id, 60), empresa_id: txt(b.empresa_id, 60), proyecto: txt(b.proyecto, 140),
      estado: ['activo', 'baja', 'concluido'].includes(b.estado) ? b.estado : 'activo'
    };
    if (!/^[0-9]{10}$/.test(a.matricula)) fallo('La matrícula debe tener 10 dígitos.');
    if (T().alumnos.some((x) => x.matricula === a.matricula && x.id !== id)) fallo(`Ya existe un alumno con la matrícula ${a.matricula}.`, 409);
    if (a.nombre.length < 5) fallo('Escribe el nombre completo del alumno.');
    if (!id && !esCorreo(a.email)) fallo('El correo electrónico no es válido.');
    if (!['TSU', 'Ingeniería'].includes(a.nivel)) fallo('Selecciona el nivel: TSU o Ingeniería.');
    if (!CARRERAS.includes(a.carrera)) fallo('Selecciona una carrera válida.');
    if (!/^[A-Z0-9]{1,3}$/.test(a.grupo)) fallo('Escribe el grupo del alumno (hasta 3 letras o números).');
    if (!T().periodos.some((p) => p.id === a.periodo_id)) fallo('Selecciona un periodo válido.');
    if (a.empresa_id && !T().empresas.some((e) => e.id === a.empresa_id)) fallo('La empresa seleccionada no existe.');
    return a;
  }
  function validarAsesor(b, id) {
    const a = {
      nombre: txt(b.nombre, 90), email: txt(b.email, 90).toLowerCase(), telefono: txt(b.telefono, 20),
      carrera: txt(b.carrera, 3), capacidad: parseInt(b.capacidad, 10), activo: b.activo !== false && b.activo !== 'false'
    };
    if (a.nombre.length < 5) fallo('Escribe el nombre completo del asesor.');
    if (!id && !esCorreo(a.email)) fallo('El correo electrónico no es válido.');
    if (!id && T().asesores.some((x) => x.email === a.email)) fallo('Ya existe un asesor con ese correo.', 409);
    if (!CARRERAS.includes(a.carrera)) fallo('Selecciona la carrera que atiende el asesor.');
    if (!(a.capacidad >= 1 && a.capacidad <= 30)) fallo('La capacidad debe estar entre 1 y 30 alumnos.');
    return a;
  }
  function validarPeriodo(b, id) {
    const p = { nombre: txt(b.nombre, 60), clave: txt(b.clave, 12).toUpperCase(), inicio: txt(b.inicio, 10), fin: txt(b.fin, 10) };
    if (p.nombre.length < 4) fallo('Escribe el nombre del periodo, por ejemplo “Septiembre – Diciembre 2026”.');
    if (!/^[A-Z0-9-]{4,12}$/.test(p.clave)) fallo('La clave debe tener de 4 a 12 caracteres, por ejemplo 2026-3.');
    if (T().periodos.some((x) => x.clave === p.clave && x.id !== id)) fallo(`Ya existe un periodo con la clave ${p.clave}.`, 409);
    if (!esFecha(p.inicio) || !esFecha(p.fin)) fallo('Indica las fechas de inicio y fin.');
    if (p.fin <= p.inicio) fallo('La fecha de fin debe ser posterior a la de inicio.');
    return p;
  }
  function validarEmpresa(b, id) {
    const e = {
      nombre: txt(b.nombre, 90), rfc: txt(b.rfc, 13).toUpperCase(), giro: txt(b.giro, 60), ciudad: txt(b.ciudad, 60),
      direccion: txt(b.direccion, 120), convenio: b.convenio === 'tramite' ? 'tramite' : 'vigente', vence: txt(b.vence, 10)
    };
    if (e.nombre.length < 3) fallo('Escribe el nombre de la empresa.');
    if (T().empresas.some((x) => x.nombre.toLowerCase() === e.nombre.toLowerCase() && x.id !== id)) fallo('Ya existe una empresa con ese nombre.', 409);
    if (e.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(e.rfc)) fallo('El RFC no tiene un formato válido (12 o 13 caracteres).');
    if (!e.giro) fallo('Escribe el giro de la empresa.');
    if (e.convenio === 'vigente' && !esFecha(e.vence)) fallo('Indica la fecha de vencimiento del convenio.');
    return { ...e, rfc: e.rfc || null, ciudad: e.ciudad || null, direccion: e.direccion || null, vence: e.convenio === 'tramite' ? null : e.vence };
  }
  function validarContacto(b) {
    const c = { nombre: txt(b.nombre, 90), puesto: txt(b.puesto, 60), email: txt(b.email, 90).toLowerCase(), telefono: txt(b.telefono, 20),
      principal: b.principal === true || b.principal === 'on' || b.principal === 'true' };
    if (c.nombre.length < 4) fallo('Escribe el nombre del contacto.');
    if (c.email && !esCorreo(c.email)) fallo('El correo del contacto no es válido.');
    if (!c.email && !c.telefono) fallo('Agrega al menos un correo o un teléfono del contacto.');
    return { ...c, puesto: c.puesto || null, email: c.email || null, telefono: c.telefono || null };
  }
  function validarUsuario(b, id) {
    const u = { nombre: txt(b.nombre, 90), email: txt(b.email, 90).toLowerCase(), rol_id: txt(b.rol_id, 30), activo: b.activo !== false && b.activo !== 'false' };
    if (u.nombre.length < 4) fallo('Escribe el nombre del usuario.');
    if (!id && !esCorreo(u.email)) fallo('El correo electrónico no es válido.');
    if (!T().roles.some((r) => r.id === u.rol_id)) fallo('Selecciona un rol válido.');
    return u;
  }
  const exigir = (p) => { if (!puede(p)) fallo('Tu rol no tiene permiso para esta acción.', 403); };
  const nombreDe = (lista, id) => ((T()[lista] || []).find((x) => x.id === id) || {}).nombre || '';

  // Deja un solo contacto principal por empresa
  async function unPrincipal(empresaId, contactoId) {
    if (contactoId) {
      ok(await cliente.from('contactos_empresa').update({ principal: false }).eq('empresa_id', empresaId).neq('id', contactoId));
      return;
    }
    const lista = ok(await cliente.from('contactos_empresa').select('id, principal').eq('empresa_id', empresaId).order('nombre'));
    if (lista.length && !lista.some((c) => c.principal)) ok(await cliente.from('contactos_empresa').update({ principal: true }).eq('id', lista[0].id));
  }

  /* ---------- Rutas (las mismas que tenía la API del servidor) ---------- */
  async function ejecutar(metodo, ruta, b = {}) {
    const [, recurso, id, extra] = ruta.split('/');
    const fija = ['asignaciones/automatica', 'perfil/password'].includes(`${recurso}/${id}`);   // rutas fijas: no llevan id
    const clave = fija ? `${metodo} /${recurso}/${id}` : `${metodo} /${recurso}${id ? '/:id' : ''}${extra ? '/' + extra : ''}`;
    switch (clave) {
      /* Perfil */
      case 'PUT /perfil/password': {
        const { actual = '', nueva = '' } = b;
        if (String(nueva).length < 8) fallo('La nueva contraseña debe tener al menos 8 caracteres.');
        const { error } = await cliente.auth.signInWithPassword({ email: PERFIL.email, password: String(actual) });
        if (error) fallo('La contraseña actual no es correcta.');
        ok(await cliente.auth.updateUser({ password: String(nueva) }));
        return ['Cambió su contraseña', 'Contraseña actualizada'];
      }

      /* Alumnos */
      case 'POST /alumnos': {
        exigir('alumnos.editar');
        const a = validarAlumno(b);
        if (b.asesor_id) exigir('asignaciones.editar');
        const { id: nuevo } = await funcion('gestion-cuentas', {
          accion: 'crear', tipo: 'alumno', correo: a.email, password: b.password, nombre: a.nombre, matricula: a.matricula, nivel: a.nivel
        });
        ok(await cliente.rpc('m2_guardar_alumno', { p_id: nuevo, p_datos: a, p_cambiar_asesor: !!b.asesor_id, p_asesor: b.asesor_id || null }));
        return [`Registró al alumno ${a.nombre}`, 'Alumno registrado'];
      }
      case 'PUT /alumnos/:id': {
        exigir('alumnos.editar');
        const a = validarAlumno(b, id);
        const cambiar = 'asesor_id' in b && puede('asignaciones.editar');
        ok(await cliente.rpc('m2_guardar_alumno', { p_id: id, p_datos: a, p_cambiar_asesor: cambiar, p_asesor: cambiar ? (b.asesor_id || null) : null }));
        return [`Actualizó los datos de ${a.nombre}`, 'Cambios guardados'];
      }
      case 'DELETE /alumnos/:id': {
        exigir('alumnos.editar');
        const nombre = nombreDe('alumnos', id);
        await funcion('gestion-cuentas', { accion: 'eliminar', tipo: 'alumno', id });
        return [`Eliminó al alumno ${nombre}`, 'Alumno eliminado'];
      }

      /* Asesores */
      case 'POST /asesores': {
        exigir('asesores.editar');
        const a = validarAsesor(b);
        const { id: nuevo } = await funcion('gestion-cuentas', { accion: 'crear', tipo: 'asesor', correo: a.email, password: b.password, nombre: a.nombre });
        ok(await cliente.rpc('m2_guardar_asesor', { p_id: nuevo, p_datos: a }));
        return [`Registró al asesor ${a.nombre}`, 'Asesor registrado'];
      }
      case 'PUT /asesores/:id': {
        exigir('asesores.editar');
        const a = validarAsesor(b, id);
        ok(await cliente.rpc('m2_guardar_asesor', { p_id: id, p_datos: a }));
        return [`Actualizó al asesor ${a.nombre}`, 'Cambios guardados'];
      }
      case 'DELETE /asesores/:id': {
        exigir('asesores.editar');
        const nombre = nombreDe('asesores', id);
        await funcion('gestion-cuentas', { accion: 'eliminar', tipo: 'asesor', id });
        return [`Eliminó al asesor ${nombre}`, 'Asesor eliminado'];
      }

      /* Asignaciones */
      case 'POST /asignaciones': {
        exigir('asignaciones.editar');
        const ids = Array.isArray(b.alumno_ids) ? [...new Set(b.alumno_ids.map(String))] : [];
        if (!ids.length) fallo('Selecciona al menos un alumno.');
        const nombre = nombreDe('asesores', b.asesor_id);
        const n = ok(await cliente.rpc('m2_asignar', { p_alumnos: ids, p_asesor: b.asesor_id, p_tipo: ids.length > 1 ? 'masiva' : 'individual' }));
        return [n > 1 ? `Asignó ${n} alumnos a ${nombre}` : `Asignó un alumno a ${nombre}`,
          n === 0 ? 'Los alumnos ya tenían asignado a ese asesor' : `${n} alumno${n === 1 ? '' : 's'} asignado${n === 1 ? '' : 's'} a ${nombre}`];
      }
      case 'POST /asignaciones/automatica': {
        exigir('asignaciones.editar');
        const r = ok(await cliente.rpc('m2_asignacion_automatica', { p_carrera: txt(b.carrera, 3) || null }));
        return [`Asignación automática: ${r.asignados} alumnos`,
          `${r.asignados} alumno${r.asignados === 1 ? '' : 's'} asignado${r.asignados === 1 ? '' : 's'} automáticamente` + (r.faltan ? `; ${r.faltan} quedaron sin asesor por falta de lugares` : '')];
      }
      case 'DELETE /asignaciones/:id': {
        exigir('asignaciones.editar');
        const g = (T().asignaciones_asesor || []).find((x) => x.id === id);
        ok(await cliente.rpc('m2_quitar_asignacion', { p_alumno: id }));
        return [`Quitó a ${nombreDe('asesores', g && g.asesor_id)} como asesor de ${nombreDe('alumnos', id)}`, 'Asignación eliminada'];
      }

      /* Periodos */
      case 'POST /periodos': {
        exigir('periodos.editar');
        const p = validarPeriodo(b);
        ok(await cliente.from('periodos').insert({ ...p, estado: 'planeado' }));
        return [`Creó el periodo ${p.nombre}`, 'Periodo creado'];
      }
      case 'PUT /periodos/:id': {
        exigir('periodos.editar');
        const p = validarPeriodo(b, id);
        ok(await cliente.from('periodos').update(p).eq('id', id));
        return [`Editó el periodo ${p.nombre}`, 'Cambios guardados'];
      }
      case 'PUT /periodos/:id/estado': {
        exigir('periodos.editar');
        if (!['activo', 'cerrado', 'planeado'].includes(b.estado)) fallo('Estado no válido.');
        const nombre = nombreDe('periodos', id);
        ok(await cliente.rpc('m2_periodo_estado', { p_id: id, p_estado: b.estado }));
        const verbo = { activo: 'Activó', cerrado: 'Cerró', planeado: 'Reabrió como planeado' }[b.estado];
        return [`${verbo} el periodo ${nombre}`, b.estado === 'activo' ? `${nombre} es ahora el periodo activo` : `Periodo ${b.estado}`];
      }
      case 'DELETE /periodos/:id': {
        exigir('periodos.editar');
        const p = T().periodos.find((x) => x.id === id) || fallo('Periodo no encontrado.', 404);
        if (p.estado === 'activo') fallo('No puedes eliminar el periodo activo.', 409);
        const n = T().alumnos.filter((a) => a.periodo_id === p.id).length;
        if (n) fallo(`El periodo tiene ${n} alumnos registrados; no se puede eliminar.`, 409);
        ok(await cliente.from('periodos').delete().eq('id', id));
        return [`Eliminó el periodo ${p.nombre}`, 'Periodo eliminado'];
      }

      /* Empresas y contactos */
      case 'POST /empresas': {
        exigir('empresas.editar');
        const e = validarEmpresa(b);
        ok(await cliente.from('empresas').insert(e));
        return [`Registró la empresa ${e.nombre}`, 'Empresa registrada'];
      }
      case 'PUT /empresas/:id': {
        exigir('empresas.editar');
        const e = validarEmpresa(b, id);
        ok(await cliente.from('empresas').update(e).eq('id', id));
        return [`Actualizó la empresa ${e.nombre}`, 'Cambios guardados'];
      }
      case 'PUT /empresas/:id/convenio': {
        exigir('empresas.editar');
        const vence = txt(b.vence, 10);
        if (!esFecha(vence) || vence <= hoy()) fallo('La nueva fecha de vencimiento debe ser posterior a hoy.');
        const nombre = nombreDe('empresas', id);
        ok(await cliente.from('empresas').update({ convenio: 'vigente', vence }).eq('id', id));
        return [`Renovó el convenio de ${nombre}`, `Convenio de ${nombre} vigente hasta el ${fmtFecha(vence)}`];
      }
      case 'DELETE /empresas/:id': {
        exigir('empresas.editar');
        const nombre = nombreDe('empresas', id);
        const n = T().alumnos.filter((a) => a.empresa_id === id).length;
        if (n) fallo(`${nombre} tiene ${n} alumnos registrados; cámbialos de empresa antes de eliminarla.`, 409);
        ok(await cliente.from('empresas').delete().eq('id', id));
        return [`Eliminó la empresa ${nombre}`, 'Empresa eliminada'];
      }
      case 'POST /empresas/:id/contactos': {
        exigir('empresas.editar');
        const c = validarContacto(b);
        const [nueva] = ok(await cliente.from('contactos_empresa').insert({ ...c, empresa_id: id }).select('id'));
        await unPrincipal(id, c.principal ? nueva.id : null);
        return [`Agregó el contacto ${c.nombre} a ${nombreDe('empresas', id)}`, 'Contacto agregado'];
      }
      case 'PUT /contactos/:id': {
        exigir('empresas.editar');
        const c = validarContacto(b);
        const [fila] = ok(await cliente.from('contactos_empresa').update(c).eq('id', id).select('empresa_id'));
        if (!fila) fallo('Contacto no encontrado.', 404);
        await unPrincipal(fila.empresa_id, c.principal ? id : null);
        return [`Actualizó el contacto ${c.nombre}`, 'Contacto actualizado'];
      }
      case 'DELETE /contactos/:id': {
        exigir('empresas.editar');
        const [fila] = ok(await cliente.from('contactos_empresa').delete().eq('id', id).select('empresa_id, nombre'));
        if (!fila) fallo('Contacto no encontrado.', 404);
        await unPrincipal(fila.empresa_id);
        return [`Eliminó el contacto ${fila.nombre}`, 'Contacto eliminado'];
      }

      /* Usuarios del personal y permisos */
      case 'POST /usuarios': {
        exigir('usuarios.editar');
        const u = validarUsuario(b);
        await funcion('gestion-cuentas', { accion: 'crear', tipo: 'personal', correo: u.email, password: b.password, nombre: u.nombre, rol_id: u.rol_id, activo: u.activo });
        return [`Creó el usuario ${u.nombre}`, 'Usuario creado'];
      }
      case 'PUT /usuarios/:id': {
        exigir('usuarios.editar');
        const u = validarUsuario(b, id);
        ok(await cliente.rpc('m2_guardar_personal', { p_id: id, p_nombre: u.nombre, p_rol: u.rol_id, p_activo: u.activo }));
        return [`Actualizó el usuario ${u.nombre}`, 'Usuario actualizado'];
      }
      case 'PUT /usuarios/:id/password': {
        exigir('usuarios.editar');
        await funcion('gestion-cuentas', { accion: 'contrasena', id, password: b.password });
        return [`Restableció la contraseña de ${nombreDe('usuarios', id)}`, 'Contraseña restablecida'];
      }
      case 'DELETE /usuarios/:id': {
        exigir('usuarios.editar');
        const nombre = nombreDe('usuarios', id);
        await funcion('gestion-cuentas', { accion: 'eliminar', tipo: 'personal', id });
        return [`Eliminó el usuario ${nombre}`, 'Usuario eliminado'];
      }
      case 'PUT /roles/:id': {
        exigir('usuarios.editar');
        if (!Array.isArray(b.permisos)) fallo('Lista de permisos no válida.');
        // Editar implica poder ver; asignar requiere ver asesores y alumnos
        const permisos = b.permisos.filter((p) => PERMISOS.includes(p));
        permisos.forEach((p) => { if (p.endsWith('.editar')) permisos.push(p.replace('.editar', '.ver')); });
        if (permisos.includes('asignaciones.editar')) permisos.push('asesores.ver', 'alumnos.ver');
        const nombre = nombreDe('roles', id);
        ok(await cliente.rpc('m2_guardar_rol', { p_id: id, p_permisos: PERMISOS.filter((p) => permisos.includes(p)) }));
        return [`Modificó los permisos del rol ${nombre}`, `Permisos de ${nombre} actualizados`];
      }
      default:
        fallo('Ruta no encontrada.', 404);
    }
    return null;
  }

  // Punto de entrada que usa js/app.js (mismo formato de respuesta que el servidor anterior)
  async function pedir(metodo, ruta, cuerpo) {
    if (!PERFIL) await sesion();
    if (!PERFIL) fallo('Tu sesión terminó. Vuelve a iniciar sesión.', 401);
    try {
      if (metodo === 'GET' && ruta === '/estado') return await estado();
      if (metodo === 'GET' && ruta === '/version') return await version();
      if (ruta === '/logout') { await salir(); return { ok: true }; }
      if (ruta.startsWith('/push/')) return await push(metodo, ruta);
      if (!navigator.onLine) fallo('Sin conexión. Los cambios necesitan internet.', 0);

      const [accion, mensaje] = await ejecutar(metodo, ruta, cuerpo || {});
      await cliente.rpc('m2_registrar', { p_accion: accion }).then(() => {}, () => {});
      // Los permisos pueden haber cambiado (matriz de roles): se vuelve a leer el perfil
      if (ruta.startsWith('/roles/') || ruta.startsWith('/usuarios/')) await sesion();
      return { ...(await estado()), mensaje };
    } catch (e) {
      throw traducir(e);
    }
  }

  /* ---------- Notificaciones push ---------- */
  async function push(metodo, ruta) {
    if (ruta === '/push/clave') return funcion('enviar-push', { accion: 'clave' });
    if (ruta === '/push/prueba') {
      exigir('alumnos.ver');
      const r = window.Radar.calcular(T(), hoy());
      return funcion('enviar-push', {
        accion: 'radar', prueba: true, rojos: r.conteo.alto, titulo: 'Alerta de prueba · Radar de Estadías',
        texto: `${r.conteo.alto} alumnos en riesgo alto y ${r.conteo.medio} en seguimiento. Toca para abrir el radar.`
      });
    }
    return null;
  }
  async function suscribirPush(suscripcion) {
    const { endpoint, keys } = suscripcion.toJSON();
    ok(await cliente.rpc('registrar_push', { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth }));
  }
  async function quitarPush(endpoint) {
    ok(await cliente.rpc('quitar_push', { p_endpoint: endpoint }));
  }

  return { cliente, hoy, sesion, entrar, salir, pedir, estado, credenciales, alCambiarSesion, suscribirPush, quitarPush, CACHE_DATOS, URL_DATOS };
})();
