/* =====================================================================
   SIGEP UTP · Módulo 2: Administración y gestión académica
   Servidor Node.js + Express
   - Entrega el panel administrativo (carpeta public/)
   - Expone la API REST en /api
   - Guarda los datos en Supabase (PostgreSQL) si hay llaves en .env;
     si no, en el archivo data/db.json (una colección por tabla)
   ===================================================================== */
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { seed, cifrar, CARRERAS, AREAS, PERMISOS } = require('./server/seed');
const supa = require('./server/supabase');
const push = require('./server/push');
const Radar = require('./public/js/radar.js');   // mismo cálculo que usa el panel

// Lee las variables del archivo .env (SUPABASE_URL, SUPABASE_KEY, PORT) sin paquetes extra
(function cargarEnv() {
  const archivo = path.join(__dirname, '.env');
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();
const USA_SUPABASE = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
const LOCAL_PATH = path.join(__dirname, 'data', 'local.json');   // sesiones y bitácora cuando se usa Supabase

const PUERTO = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const HOY = '2025-04-14';            // fecha fija de la demostración
const HORAS_SESION = 12;             // duración de una sesión
const CLAVES_PERMISO = PERMISOS.map((p) => p.clave);

/* ---------- Base de datos en archivo JSON ---------- */
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const nuevaBase = () => ({ version: 1, datos: seed(), sesiones: {}, suscripciones: [] });
function escribirBase(b) {
  // Con Supabase, las tablas viven en la nube; aquí solo se guardan sesiones y bitácora
  const destino = USA_SUPABASE ? LOCAL_PATH : DB_PATH;
  const contenido = USA_SUPABASE ? { sesiones: b.sesiones, actividad: b.datos.actividad, suscripciones: b.suscripciones } : b;
  const tmp = destino + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(contenido));
  fs.renameSync(tmp, destino);       // reemplazo atómico: el archivo nunca queda a medias
}
function leerBase() {
  if (USA_SUPABASE) {
    let local = {};
    try { local = JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf8')); } catch (e) {}
    const vacias = Object.fromEntries(supa.TABLAS.map((t) => [t, []]));
    return { version: 1, datos: { ...vacias, actividad: local.actividad || [] }, sesiones: local.sesiones || {}, suscripciones: local.suscripciones || [] };
  }
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch (e) { const b = nuevaBase(); escribirBase(b); return b; }
}
let db = leerBase();
db.suscripciones = db.suscripciones || [];   // dispositivos que reciben notificaciones push

/* ---------- Sincronización con Supabase ---------- */
let sincronizado = null;             // copia de lo último que se guardó en Supabase
let ocupado = 0;                     // peticiones que están modificando datos en este momento
let cola = Promise.resolve();        // las operaciones con Supabase se hacen una por una
const enCola = (fn) => { const p = cola.then(fn); cola = p.catch(() => {}); return p; };
const copiaTablas = (d) => JSON.parse(JSON.stringify(Object.fromEntries(supa.TABLAS.map((t) => [t, d[t]]))));

// Envía a Supabase solo lo que cambió desde la última vez
const guardarEnSupabase = () => enCola(async () => {
  const n = await supa.guardarCambios(sincronizado, db.datos);
  sincronizado = copiaTablas(db.datos);
  if (n) console.log(`  Supabase: ${n} cambio${n === 1 ? '' : 's'} guardado${n === 1 ? '' : 's'}`);
});
// Vuelve a leer todo desde Supabase (la base es la fuente de verdad)
async function recargarDeSupabase() {
  const d = await supa.cargarTodo();
  Object.assign(db.datos, d);
  sincronizado = copiaTablas(d);
  db.version++;
}
// Detecta cambios hechos directamente en Supabase (por ejemplo, borrar una fila en el Table Editor)
async function revisarSupabase() {
  if (ocupado) return;
  await enCola(async () => {
    if (ocupado) return;
    const d = await supa.cargarTodo();
    if (ocupado || !supa.hayCambios(supa.diferencias(sincronizado, d))) return;
    Object.assign(db.datos, d);
    sincronizado = copiaTablas(d);
    db.version++;
    console.log('  Supabase: se detectaron cambios hechos directamente en la base; el sitio se actualizó');
    revisarRiesgo().catch(() => {});
  });
}
const T = () => db.datos;            // acceso corto a las tablas

/* ---------- Utilidades ---------- */
const nuevoId = (prefijo) => prefijo + Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
const txt = (v, max = 160) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const esCorreo = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const fmtFecha = (v) => new Date(v + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v));
const permisosDe = (rolId) => (T().roles.find((r) => r.id === rolId) || { permisos: [] }).permisos;
const periodoActivo = () => T().periodos.find((p) => p.estado === 'activo');
const cargaDe = (asesorId, periodoId) => T().asignaciones_asesor.filter((a) => a.asesor_id === asesorId && a.periodo_id === periodoId).length;

class ErrorApi extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fallo = (status, msg) => { throw new ErrorApi(status, msg); };

// Datos que se envían al navegador (sin contraseñas y según los permisos)
function vista(permisos) {
  const d = T();
  return {
    ...d,
    usuarios: permisos.includes('usuarios.ver') ? d.usuarios.map(({ hash, salt, ...u }) => u) : [],
    actividad: d.actividad.slice(0, 30)
  };
}
const respuesta = (req, extra = {}) => ({ version: db.version, permisos: req.usuario.permisos, datos: vista(req.usuario.permisos), ...extra });

// Guarda en Supabase (si está configurado), registra en la bitácora y responde con los datos actualizados
async function confirmar(req, res, accion, mensaje, status = 200) {
  if (USA_SUPABASE) {
    try { await guardarEnSupabase(); }
    catch (e) {
      console.error('  Error al guardar en Supabase:', e.message);
      await recargarDeSupabase().catch(() => {});
      return res.status(502).json({ error: 'No se guardó el cambio. ' + e.message });
    }
  }
  T().actividad.unshift({ fecha: new Date().toISOString(), usuario: req.usuario.nombre, accion });
  T().actividad.length = Math.min(T().actividad.length, 100);
  db.version++;
  escribirBase(db);
  res.status(status).json(respuesta(req, { mensaje }));
  revisarRiesgo().catch((e) => console.error('  Push:', e.message));
}

/* ---------- Aplicación Express ---------- */
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) console.log(`${new Date().toLocaleTimeString('es-MX')}  ${req.method} ${req.path}`);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

/* ---------- Autenticación y permisos ---------- */
function autenticar(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const s = db.sesiones[token];
  const u = s && T().usuarios.find((x) => x.id === s.usuario_id && x.activo);
  if (!s || !u || s.expira < Date.now()) {
    if (s) { delete db.sesiones[token]; escribirBase(db); }
    return res.status(401).json({ error: 'Tu sesión terminó. Vuelve a iniciar sesión.' });
  }
  // Los permisos se leen del rol en cada petición: un cambio de permisos aplica al momento
  req.usuario = { id: u.id, nombre: u.nombre, email: u.email, rol_id: u.rol_id, permisos: permisosDe(u.rol_id) };
  req.token = token;
  next();
}
const permiso = (clave) => (req, res, next) =>
  req.usuario.permisos.includes(clave) ? next() : res.status(403).json({ error: 'Tu rol no tiene permiso para esta acción.' });

// Envuelve cada ruta para convertir los ErrorApi en respuestas JSON
const ruta = (fn) => async (req, res, next) => {
  ocupado++;
  try { await fn(req, res, next); }
  catch (e) { if (e instanceof ErrorApi) res.status(e.status).json({ error: e.message }); else next(e); }
  finally { ocupado--; }
};

/* =====================================================================
   RUTAS DE LA API
   ===================================================================== */
const api = express.Router();

api.get('/salud', (req, res) => res.json({ ok: true, version: db.version }));

/* ---------- Sesión ---------- */
api.post('/login', ruta((req, res) => {
  const email = txt(req.body?.email).toLowerCase(), password = String(req.body?.password || '');
  const u = T().usuarios.find((x) => x.email === email);
  const valido = u && crypto.timingSafeEqual(Buffer.from(u.hash, 'hex'), crypto.scryptSync(password, u.salt, 32));
  if (!valido) fallo(401, 'Correo o contraseña incorrectos.');
  if (!u.activo) fallo(403, 'Tu usuario está desactivado. Contacta al administrador.');
  const token = crypto.randomBytes(24).toString('hex');
  db.sesiones[token] = { usuario_id: u.id, expira: Date.now() + HORAS_SESION * 3600e3 };
  u.ultimo_acceso = new Date().toISOString();
  escribirBase(db);
  if (USA_SUPABASE) guardarEnSupabase().catch((e) => console.error('  Supabase:', e.message));
  const rol = T().roles.find((r) => r.id === u.rol_id);
  res.json({ usuario: { id: u.id, nombre: u.nombre, email: u.email, rol_id: u.rol_id, rol: rol?.nombre, token } });
}));
api.post('/logout', autenticar, (req, res) => { delete db.sesiones[req.token]; escribirBase(db); res.json({ ok: true }); });
api.get('/version', autenticar, (req, res) => res.json({ version: db.version }));
api.get('/estado', autenticar, (req, res) => res.json(respuesta(req)));

api.put('/perfil/password', autenticar, ruta((req, res) => {
  const u = T().usuarios.find((x) => x.id === req.usuario.id);
  const { actual = '', nueva = '' } = req.body || {};
  if (!crypto.timingSafeEqual(Buffer.from(u.hash, 'hex'), crypto.scryptSync(String(actual), u.salt, 32))) fallo(400, 'La contraseña actual no es correcta.');
  if (String(nueva).length < 8) fallo(400, 'La nueva contraseña debe tener al menos 8 caracteres.');
  Object.assign(u, cifrar(String(nueva)));
  return confirmar(req, res, 'Cambió su contraseña', 'Contraseña actualizada');
}));

/* ---------- Alumnos ---------- */
function validarAlumno(b, id) {
  const a = {
    matricula: txt(b.matricula, 15).toUpperCase(), nombre: txt(b.nombre, 90), email: txt(b.email, 90).toLowerCase(),
    telefono: txt(b.telefono, 20), carrera: txt(b.carrera, 3), grupo: txt(b.grupo, 3).toUpperCase(),
    periodo_id: txt(b.periodo_id, 20), empresa_id: txt(b.empresa_id, 30), proyecto: txt(b.proyecto, 140),
    estado: ['activo', 'baja', 'concluido'].includes(b.estado) ? b.estado : 'activo'
  };
  if (!/^[A-Z0-9]{6,15}$/.test(a.matricula)) fallo(400, 'La matrícula debe tener de 6 a 15 letras o números, sin espacios.');
  if (T().alumnos.some((x) => x.matricula === a.matricula && x.id !== id)) fallo(409, `Ya existe un alumno con la matrícula ${a.matricula}.`);
  if (a.nombre.length < 5) fallo(400, 'Escribe el nombre completo del alumno.');
  if (!esCorreo(a.email)) fallo(400, 'El correo electrónico no es válido.');
  if (!CARRERAS[a.carrera]) fallo(400, 'Selecciona una carrera válida.');
  if (!a.grupo) fallo(400, 'Escribe el grupo del alumno.');
  if (!T().periodos.some((p) => p.id === a.periodo_id)) fallo(400, 'Selecciona un periodo válido.');
  if (a.empresa_id && !T().empresas.some((e) => e.id === a.empresa_id)) fallo(400, 'La empresa seleccionada no existe.');
  return a;
}

// Asigna (o reasigna) un asesor a varios alumnos respetando su capacidad por periodo
function asignar(alumnoIds, asesorId, tipo) {
  const as = T().asesores.find((x) => x.id === asesorId);
  if (!as) fallo(400, 'El asesor seleccionado no existe.');
  if (!as.activo) fallo(409, `${as.nombre} está inactivo y no puede recibir alumnos.`);
  const alumnos = alumnoIds.map((id) => T().alumnos.find((a) => a.id === id) || fallo(404, 'Uno de los alumnos no existe.'));
  const porPeriodo = {};
  alumnos.forEach((a) => {
    const ya = T().asignaciones_asesor.find((g) => g.alumno_id === a.id && g.periodo_id === a.periodo_id);
    if (!ya || ya.asesor_id !== asesorId) (porPeriodo[a.periodo_id] = porPeriodo[a.periodo_id] || []).push(a);
  });
  Object.entries(porPeriodo).forEach(([pid, lista]) => {
    const libres = as.capacidad - cargaDe(asesorId, pid);
    if (lista.length > libres) fallo(409, libres > 0
      ? `${as.nombre} solo tiene ${libres} lugar${libres === 1 ? '' : 'es'} disponible${libres === 1 ? '' : 's'} y elegiste ${lista.length} alumnos.`
      : `${as.nombre} ya llegó a su capacidad de ${as.capacidad} alumnos.`);
  });
  let n = 0;
  Object.values(porPeriodo).flat().forEach((a) => {
    T().asignaciones_asesor = T().asignaciones_asesor.filter((g) => !(g.alumno_id === a.id && g.periodo_id === a.periodo_id));
    T().asignaciones_asesor.push({ id: nuevoId('g'), alumno_id: a.id, asesor_id: asesorId, periodo_id: a.periodo_id, tipo, fecha: HOY });
    n++;
  });
  return { as, n };
}
const quitarAsignacion = (alumno) => {
  T().asignaciones_asesor = T().asignaciones_asesor.filter((g) => !(g.alumno_id === alumno.id && g.periodo_id === alumno.periodo_id));
};

api.post('/alumnos', autenticar, permiso('alumnos.editar'), ruta((req, res) => {
  const a = { id: nuevoId('a'), ...validarAlumno(req.body || {}), expediente: { aceptacion: 'pendiente', seguro: 'pendiente', plan: 'pendiente', parcial: 'pendiente', liberacion: 'pendiente' } };
  T().alumnos.unshift(a);
  const asesorId = txt(req.body.asesor_id, 30);
  if (asesorId) {
    if (!req.usuario.permisos.includes('asignaciones.editar')) fallo(403, 'Tu rol no puede asignar asesores.');
    try { asignar([a.id], asesorId, 'individual'); } catch (e) { T().alumnos.shift(); throw e; }
  }
  return confirmar(req, res, `Registró al alumno ${a.nombre}`, 'Alumno registrado', 201);
}));

api.put('/alumnos/:id', autenticar, permiso('alumnos.editar'), ruta((req, res) => {
  const a = T().alumnos.find((x) => x.id === req.params.id) || fallo(404, 'Alumno no encontrado.');
  const datos = validarAlumno(req.body || {}, a.id);
  const antes = { ...a };
  const periodoCambio = datos.periodo_id !== a.periodo_id;
  if (periodoCambio) quitarAsignacion(a);
  Object.assign(a, datos);
  if ('asesor_id' in (req.body || {}) && req.usuario.permisos.includes('asignaciones.editar')) {
    const asesorId = txt(req.body.asesor_id, 30);
    try { asesorId ? asignar([a.id], asesorId, 'individual') : quitarAsignacion(a); }
    catch (e) { Object.assign(a, antes); throw e; }
  }
  return confirmar(req, res, `Actualizó los datos de ${a.nombre}`, 'Cambios guardados');
}));

api.delete('/alumnos/:id', autenticar, permiso('alumnos.editar'), ruta((req, res) => {
  const a = T().alumnos.find((x) => x.id === req.params.id) || fallo(404, 'Alumno no encontrado.');
  T().alumnos = T().alumnos.filter((x) => x.id !== a.id);
  T().asignaciones_asesor = T().asignaciones_asesor.filter((g) => g.alumno_id !== a.id);
  return confirmar(req, res, `Eliminó al alumno ${a.nombre}`, 'Alumno eliminado');
}));

/* ---------- Asesores ---------- */
function validarAsesor(b, id) {
  const a = {
    nombre: txt(b.nombre, 90), email: txt(b.email, 90).toLowerCase(), telefono: txt(b.telefono, 20),
    carrera: txt(b.carrera, 3), capacidad: parseInt(b.capacidad, 10), activo: b.activo !== false && b.activo !== 'false'
  };
  if (a.nombre.length < 5) fallo(400, 'Escribe el nombre completo del asesor.');
  if (!esCorreo(a.email)) fallo(400, 'El correo electrónico no es válido.');
  if (T().asesores.some((x) => x.email === a.email && x.id !== id)) fallo(409, 'Ya existe un asesor con ese correo.');
  if (!CARRERAS[a.carrera]) fallo(400, 'Selecciona la carrera que atiende el asesor.');
  if (!(a.capacidad >= 1 && a.capacidad <= 30)) fallo(400, 'La capacidad debe estar entre 1 y 30 alumnos.');
  a.area = AREAS[a.carrera];
  return a;
}
api.post('/asesores', autenticar, permiso('asesores.editar'), ruta((req, res) => {
  const a = { id: nuevoId('t'), ...validarAsesor(req.body || {}) };
  T().asesores.unshift(a);
  return confirmar(req, res, `Registró al asesor ${a.nombre}`, 'Asesor registrado', 201);
}));
api.put('/asesores/:id', autenticar, permiso('asesores.editar'), ruta((req, res) => {
  const a = T().asesores.find((x) => x.id === req.params.id) || fallo(404, 'Asesor no encontrado.');
  const datos = validarAsesor(req.body || {}, a.id);
  const p = periodoActivo();
  if (p && datos.capacidad < cargaDe(a.id, p.id)) fallo(409, `No puedes bajar la capacidad a ${datos.capacidad}: ya tiene ${cargaDe(a.id, p.id)} alumnos en el periodo activo.`);
  Object.assign(a, datos);
  return confirmar(req, res, `Actualizó al asesor ${a.nombre}`, 'Cambios guardados');
}));
api.delete('/asesores/:id', autenticar, permiso('asesores.editar'), ruta((req, res) => {
  const a = T().asesores.find((x) => x.id === req.params.id) || fallo(404, 'Asesor no encontrado.');
  const n = T().asignaciones_asesor.filter((g) => g.asesor_id === a.id).length;
  if (n) fallo(409, `${a.nombre} tiene ${n} asignaciones registradas. Desactívalo en lugar de eliminarlo, o reasigna a sus alumnos.`);
  T().asesores = T().asesores.filter((x) => x.id !== a.id);
  return confirmar(req, res, `Eliminó al asesor ${a.nombre}`, 'Asesor eliminado');
}));

/* ---------- Asignaciones de asesor ---------- */
api.post('/asignaciones', autenticar, permiso('asignaciones.editar'), ruta((req, res) => {
  const ids = Array.isArray(req.body?.alumno_ids) ? [...new Set(req.body.alumno_ids.map(String))] : [];
  if (!ids.length) fallo(400, 'Selecciona al menos un alumno.');
  const { as, n } = asignar(ids, txt(req.body.asesor_id, 30), ids.length > 1 ? 'masiva' : 'individual');
  const msg = n === 0 ? 'Los alumnos ya tenían asignado a ese asesor' : `${n} alumno${n === 1 ? '' : 's'} asignado${n === 1 ? '' : 's'} a ${as.nombre}`;
  return confirmar(req, res, n > 1 ? `Asignó ${n} alumnos a ${as.nombre}` : `Asignó un alumno a ${as.nombre}`, msg);
}));

// Distribuye a los alumnos sin asesor entre los asesores de su carrera con menor carga
api.post('/asignaciones/automatica', autenticar, permiso('asignaciones.editar'), ruta((req, res) => {
  const p = periodoActivo() || fallo(409, 'No hay un periodo activo.');
  const carrera = txt(req.body?.carrera, 3);
  const pendientes = T().alumnos.filter((a) => a.periodo_id === p.id && a.estado === 'activo' && (!carrera || a.carrera === carrera)
    && !T().asignaciones_asesor.some((g) => g.alumno_id === a.id && g.periodo_id === p.id));
  if (!pendientes.length) fallo(409, 'No hay alumnos sin asesor con esos criterios.');
  let asignados = 0;
  pendientes.forEach((a) => {
    const cands = T().asesores.filter((t) => t.activo && t.carrera === a.carrera && cargaDe(t.id, p.id) < t.capacidad)
      .sort((x, y) => cargaDe(x.id, p.id) / x.capacidad - cargaDe(y.id, p.id) / y.capacidad);
    if (!cands.length) return;
    T().asignaciones_asesor.push({ id: nuevoId('g'), alumno_id: a.id, asesor_id: cands[0].id, periodo_id: p.id, tipo: 'automatica', fecha: HOY });
    asignados++;
  });
  if (!asignados) fallo(409, 'Los asesores de esa carrera ya no tienen lugares disponibles. Registra otro asesor o aumenta su capacidad.');
  const faltan = pendientes.length - asignados;
  return confirmar(req, res, `Asignación automática: ${asignados} alumnos`,
    `${asignados} alumno${asignados === 1 ? '' : 's'} asignado${asignados === 1 ? '' : 's'} automáticamente` + (faltan ? `; ${faltan} quedaron sin asesor por falta de lugares` : ''));
}));

api.delete('/asignaciones/:id', autenticar, permiso('asignaciones.editar'), ruta((req, res) => {
  const g = T().asignaciones_asesor.find((x) => x.id === req.params.id) || fallo(404, 'Asignación no encontrada.');
  T().asignaciones_asesor = T().asignaciones_asesor.filter((x) => x.id !== g.id);
  const al = T().alumnos.find((a) => a.id === g.alumno_id), as = T().asesores.find((a) => a.id === g.asesor_id);
  return confirmar(req, res, `Quitó a ${as?.nombre} como asesor de ${al?.nombre}`, 'Asignación eliminada');
}));

/* ---------- Periodos ---------- */
function validarPeriodo(b, id) {
  const p = { nombre: txt(b.nombre, 60), clave: txt(b.clave, 12).toUpperCase(), inicio: txt(b.inicio, 10), fin: txt(b.fin, 10) };
  if (p.nombre.length < 4) fallo(400, 'Escribe el nombre del periodo, por ejemplo “Enero – Junio 2026”.');
  if (!/^[A-Z0-9-]{4,12}$/.test(p.clave)) fallo(400, 'La clave debe tener de 4 a 12 caracteres, por ejemplo 2026-1.');
  if (T().periodos.some((x) => x.clave === p.clave && x.id !== id)) fallo(409, `Ya existe un periodo con la clave ${p.clave}.`);
  if (!esFecha(p.inicio) || !esFecha(p.fin)) fallo(400, 'Indica las fechas de inicio y fin.');
  if (p.fin <= p.inicio) fallo(400, 'La fecha de fin debe ser posterior a la de inicio.');
  return p;
}
api.post('/periodos', autenticar, permiso('periodos.editar'), ruta((req, res) => {
  const p = { id: nuevoId('p'), ...validarPeriodo(req.body || {}), estado: 'planeado' };
  T().periodos.push(p);
  T().periodos.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return confirmar(req, res, `Creó el periodo ${p.nombre}`, 'Periodo creado', 201);
}));
api.put('/periodos/:id', autenticar, permiso('periodos.editar'), ruta((req, res) => {
  const p = T().periodos.find((x) => x.id === req.params.id) || fallo(404, 'Periodo no encontrado.');
  Object.assign(p, validarPeriodo(req.body || {}, p.id));
  T().periodos.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return confirmar(req, res, `Editó el periodo ${p.nombre}`, 'Cambios guardados');
}));
api.put('/periodos/:id/estado', autenticar, permiso('periodos.editar'), ruta((req, res) => {
  const p = T().periodos.find((x) => x.id === req.params.id) || fallo(404, 'Periodo no encontrado.');
  const estado = req.body?.estado;
  if (!['activo', 'cerrado', 'planeado'].includes(estado)) fallo(400, 'Estado no válido.');
  if (estado === 'activo') T().periodos.forEach((x) => { if (x.estado === 'activo') x.estado = 'cerrado'; });
  p.estado = estado;
  const verbo = { activo: 'Activó', cerrado: 'Cerró', planeado: 'Reabrió como planeado' }[estado];
  return confirmar(req, res, `${verbo} el periodo ${p.nombre}`, estado === 'activo' ? `${p.nombre} es ahora el periodo activo` : `Periodo ${estado}`);
}));
api.delete('/periodos/:id', autenticar, permiso('periodos.editar'), ruta((req, res) => {
  const p = T().periodos.find((x) => x.id === req.params.id) || fallo(404, 'Periodo no encontrado.');
  if (p.estado === 'activo') fallo(409, 'No puedes eliminar el periodo activo.');
  const n = T().alumnos.filter((a) => a.periodo_id === p.id).length;
  if (n) fallo(409, `El periodo tiene ${n} alumnos registrados; no se puede eliminar.`);
  T().periodos = T().periodos.filter((x) => x.id !== p.id);
  return confirmar(req, res, `Eliminó el periodo ${p.nombre}`, 'Periodo eliminado');
}));

/* ---------- Empresas ---------- */
function validarEmpresa(b, id) {
  const e = {
    nombre: txt(b.nombre, 90), rfc: txt(b.rfc, 13).toUpperCase(), giro: txt(b.giro, 60), ciudad: txt(b.ciudad, 60),
    direccion: txt(b.direccion, 120), convenio: b.convenio === 'tramite' ? 'tramite' : 'vigente', vence: txt(b.vence, 10)
  };
  if (e.nombre.length < 3) fallo(400, 'Escribe el nombre de la empresa.');
  if (T().empresas.some((x) => x.nombre.toLowerCase() === e.nombre.toLowerCase() && x.id !== id)) fallo(409, 'Ya existe una empresa con ese nombre.');
  if (e.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(e.rfc)) fallo(400, 'El RFC no tiene un formato válido (12 o 13 caracteres).');
  if (!e.giro) fallo(400, 'Escribe el giro de la empresa.');
  if (e.convenio === 'vigente' && !esFecha(e.vence)) fallo(400, 'Indica la fecha de vencimiento del convenio.');
  if (e.convenio === 'tramite') e.vence = '';
  return e;
}
api.post('/empresas', autenticar, permiso('empresas.editar'), ruta((req, res) => {
  const e = { id: nuevoId('e'), ...validarEmpresa(req.body || {}) };
  T().empresas.unshift(e);
  return confirmar(req, res, `Registró la empresa ${e.nombre}`, 'Empresa registrada', 201);
}));
api.put('/empresas/:id', autenticar, permiso('empresas.editar'), ruta((req, res) => {
  const e = T().empresas.find((x) => x.id === req.params.id) || fallo(404, 'Empresa no encontrada.');
  Object.assign(e, validarEmpresa(req.body || {}, e.id));
  return confirmar(req, res, `Actualizó la empresa ${e.nombre}`, 'Cambios guardados');
}));
api.put('/empresas/:id/convenio', autenticar, permiso('empresas.editar'), ruta((req, res) => {
  const e = T().empresas.find((x) => x.id === req.params.id) || fallo(404, 'Empresa no encontrada.');
  const vence = txt(req.body?.vence, 10) || '2027-04-14';
  if (!esFecha(vence) || vence <= HOY) fallo(400, 'La nueva fecha de vencimiento debe ser posterior a hoy.');
  Object.assign(e, { convenio: 'vigente', vence });
  return confirmar(req, res, `Renovó el convenio de ${e.nombre}`, `Convenio de ${e.nombre} vigente hasta el ${fmtFecha(vence)}`);
}));
api.delete('/empresas/:id', autenticar, permiso('empresas.editar'), ruta((req, res) => {
  const e = T().empresas.find((x) => x.id === req.params.id) || fallo(404, 'Empresa no encontrada.');
  const n = T().alumnos.filter((a) => a.empresa_id === e.id).length;
  if (n) fallo(409, `${e.nombre} tiene ${n} alumnos registrados; cámbialos de empresa antes de eliminarla.`);
  T().empresas = T().empresas.filter((x) => x.id !== e.id);
  T().contactos_empresa = T().contactos_empresa.filter((c) => c.empresa_id !== e.id);
  return confirmar(req, res, `Eliminó la empresa ${e.nombre}`, 'Empresa eliminada');
}));

/* ---------- Contactos de empresa ---------- */
function validarContacto(b) {
  const c = { nombre: txt(b.nombre, 90), puesto: txt(b.puesto, 60), email: txt(b.email, 90).toLowerCase(), telefono: txt(b.telefono, 20), principal: b.principal === true || b.principal === 'on' || b.principal === 'true' };
  if (c.nombre.length < 4) fallo(400, 'Escribe el nombre del contacto.');
  if (c.email && !esCorreo(c.email)) fallo(400, 'El correo del contacto no es válido.');
  if (!c.email && !c.telefono) fallo(400, 'Agrega al menos un correo o un teléfono del contacto.');
  return c;
}
const unPrincipal = (empresaId, contactoId) => {
  const lista = T().contactos_empresa.filter((c) => c.empresa_id === empresaId);
  if (contactoId) lista.forEach((c) => (c.principal = c.id === contactoId));
  else if (lista.length && !lista.some((c) => c.principal)) lista[0].principal = true;
};
api.post('/empresas/:id/contactos', autenticar, permiso('empresas.editar'), ruta((req, res) => {
  const e = T().empresas.find((x) => x.id === req.params.id) || fallo(404, 'Empresa no encontrada.');
  const c = { id: nuevoId('c'), empresa_id: e.id, ...validarContacto(req.body || {}) };
  T().contactos_empresa.push(c);
  c.principal ? unPrincipal(e.id, c.id) : unPrincipal(e.id);
  return confirmar(req, res, `Agregó el contacto ${c.nombre} a ${e.nombre}`, 'Contacto agregado', 201);
}));
api.put('/contactos/:id', autenticar, permiso('empresas.editar'), ruta((req, res) => {
  const c = T().contactos_empresa.find((x) => x.id === req.params.id) || fallo(404, 'Contacto no encontrado.');
  Object.assign(c, validarContacto(req.body || {}));
  c.principal ? unPrincipal(c.empresa_id, c.id) : unPrincipal(c.empresa_id);
  return confirmar(req, res, `Actualizó el contacto ${c.nombre}`, 'Contacto actualizado');
}));
api.delete('/contactos/:id', autenticar, permiso('empresas.editar'), ruta((req, res) => {
  const c = T().contactos_empresa.find((x) => x.id === req.params.id) || fallo(404, 'Contacto no encontrado.');
  T().contactos_empresa = T().contactos_empresa.filter((x) => x.id !== c.id);
  unPrincipal(c.empresa_id);
  return confirmar(req, res, `Eliminó el contacto ${c.nombre}`, 'Contacto eliminado');
}));

/* ---------- Usuarios y roles ---------- */
const adminsActivos = (exceptoId) => T().usuarios.filter((u) => u.rol_id === 'admin' && u.activo && u.id !== exceptoId).length;
function validarUsuario(b, id) {
  const u = { nombre: txt(b.nombre, 90), email: txt(b.email, 90).toLowerCase(), rol_id: txt(b.rol_id, 30), activo: b.activo !== false && b.activo !== 'false' };
  if (u.nombre.length < 4) fallo(400, 'Escribe el nombre del usuario.');
  if (!esCorreo(u.email)) fallo(400, 'El correo electrónico no es válido.');
  if (T().usuarios.some((x) => x.email === u.email && x.id !== id)) fallo(409, 'Ya existe un usuario con ese correo.');
  if (!T().roles.some((r) => r.id === u.rol_id)) fallo(400, 'Selecciona un rol válido.');
  return u;
}
const cerrarSesionesDe = (usuarioId) => Object.keys(db.sesiones).forEach((t) => { if (db.sesiones[t].usuario_id === usuarioId) delete db.sesiones[t]; });

api.post('/usuarios', autenticar, permiso('usuarios.editar'), ruta((req, res) => {
  const u = validarUsuario(req.body || {});
  const password = String(req.body?.password || '');
  if (password.length < 8) fallo(400, 'La contraseña debe tener al menos 8 caracteres.');
  T().usuarios.push({ id: nuevoId('u'), ...u, ultimo_acceso: null, ...cifrar(password) });
  return confirmar(req, res, `Creó el usuario ${u.nombre}`, 'Usuario creado', 201);
}));
api.put('/usuarios/:id', autenticar, permiso('usuarios.editar'), ruta((req, res) => {
  const u = T().usuarios.find((x) => x.id === req.params.id) || fallo(404, 'Usuario no encontrado.');
  const datos = validarUsuario(req.body || {}, u.id);
  if (u.id === req.usuario.id && !datos.activo) fallo(409, 'No puedes desactivar tu propio usuario.');
  if (u.rol_id === 'admin' && (datos.rol_id !== 'admin' || !datos.activo) && !adminsActivos(u.id)) fallo(409, 'Debe quedar al menos un administrador activo.');
  Object.assign(u, datos);
  if (!u.activo) cerrarSesionesDe(u.id);
  return confirmar(req, res, `Actualizó el usuario ${u.nombre}`, 'Usuario actualizado');
}));
api.put('/usuarios/:id/password', autenticar, permiso('usuarios.editar'), ruta((req, res) => {
  const u = T().usuarios.find((x) => x.id === req.params.id) || fallo(404, 'Usuario no encontrado.');
  const password = String(req.body?.password || '');
  if (password.length < 8) fallo(400, 'La contraseña debe tener al menos 8 caracteres.');
  Object.assign(u, cifrar(password));
  if (u.id !== req.usuario.id) cerrarSesionesDe(u.id);
  return confirmar(req, res, `Restableció la contraseña de ${u.nombre}`, 'Contraseña restablecida');
}));
api.delete('/usuarios/:id', autenticar, permiso('usuarios.editar'), ruta((req, res) => {
  const u = T().usuarios.find((x) => x.id === req.params.id) || fallo(404, 'Usuario no encontrado.');
  if (u.id === req.usuario.id) fallo(409, 'No puedes eliminar tu propio usuario.');
  if (u.rol_id === 'admin' && !adminsActivos(u.id)) fallo(409, 'Debe quedar al menos un administrador activo.');
  T().usuarios = T().usuarios.filter((x) => x.id !== u.id);
  cerrarSesionesDe(u.id);
  return confirmar(req, res, `Eliminó el usuario ${u.nombre}`, 'Usuario eliminado');
}));
api.put('/roles/:id', autenticar, permiso('usuarios.editar'), ruta((req, res) => {
  const r = T().roles.find((x) => x.id === req.params.id) || fallo(404, 'Rol no encontrado.');
  if (r.sistema) fallo(409, 'Los permisos del Administrador no se pueden modificar.');
  let permisos = Array.isArray(req.body?.permisos) ? req.body.permisos.filter((p) => CLAVES_PERMISO.includes(p)) : fallo(400, 'Lista de permisos no válida.');
  // Editar implica poder ver; asignar requiere ver asesores
  permisos.forEach((p) => { if (p.endsWith('.editar')) permisos.push(p.replace('.editar', '.ver')); });
  if (permisos.includes('asignaciones.editar')) permisos.push('asesores.ver', 'alumnos.ver');
  r.permisos = CLAVES_PERMISO.filter((p) => permisos.includes(p));
  return confirmar(req, res, `Modificó los permisos del rol ${r.nombre}`, `Permisos de ${r.nombre} actualizados`);
}));

/* =====================================================================
   RADAR DE ESTADÍAS Y NOTIFICACIONES PUSH (propuesta de mejora)
   ===================================================================== */
const VAPID_PATH = path.join(__dirname, 'data', 'vapid.json');
const radar = () => Radar.calcular(T(), HOY);
let rojosPrevios = null;                 // alumnos en riesgo alto la última vez que se revisó

// Envía una notificación a los dispositivos suscritos (solo usuarios con permiso para ver alumnos)
async function notificar(mensaje, filtro = () => true) {
  const subs = db.suscripciones.filter((s) => {
    const u = T().usuarios.find((x) => x.id === s.usuario_id && x.activo);
    return u && permisosDe(u.rol_id).includes('alumnos.ver') && filtro(s);
  });
  const resultados = await Promise.all(subs.map((s) => push.enviar(s, mensaje)));
  const vencidas = subs.filter((s, i) => [404, 410].includes(resultados[i].status)).map((s) => s.endpoint);
  if (vencidas.length) { db.suscripciones = db.suscripciones.filter((s) => !vencidas.includes(s.endpoint)); escribirBase(db); }
  const enviadas = resultados.filter((r) => r.ok).length;
  if (subs.length) console.log(`  Push: ${enviadas} de ${subs.length} notificación${subs.length === 1 ? '' : 'es'} enviada${enviadas === 1 ? '' : 's'}`);
  return { dispositivos: subs.length, enviadas, errores: resultados.filter((r) => !r.ok).map((r) => r.error || 'HTTP ' + r.status) };
}
const mensajeRadar = (r, titulo, cuerpo) => ({ titulo, cuerpo, url: '/#/app/radar', rojos: r.conteo.alto, tag: 'sigep-radar' });

// Después de cada cambio: si algún alumno pasó a riesgo alto, avisa
async function revisarRiesgo() {
  const r = radar();
  const rojos = r.alumnos.filter((a) => a.nivel === 'alto');
  const nuevos = rojosPrevios ? rojos.filter((a) => !rojosPrevios.has(a.id)) : [];
  rojosPrevios = new Set(rojos.map((a) => a.id));
  if (!nuevos.length) return;
  const primero = nuevos[0];
  await notificar(mensajeRadar(r,
    nuevos.length === 1 ? `${primero.nombre} pasó a riesgo alto` : `${nuevos.length} alumnos pasaron a riesgo alto`,
    `${primero.nombre}: ${primero.motivos.map((m) => m.t).join(', ')}. Hay ${r.conteo.alto} en rojo en total.`));
}
// Resumen diario a las 7:00 a. m.
let ultimoResumen = '';
setInterval(() => {
  const ahora = new Date(), dia = ahora.toISOString().slice(0, 10);
  if (ahora.getHours() !== 7 || ultimoResumen === dia) return;
  ultimoResumen = dia;
  const r = radar();
  notificar(mensajeRadar(r, 'Resumen del Radar de Estadías', `${r.conteo.alto} en riesgo alto, ${r.conteo.medio} en seguimiento y ${r.conteo.bajo} en tiempo · semana ${r.semana}.`)).catch(() => {});
}, 60e3);

api.get('/radar', autenticar, permiso('alumnos.ver'), (req, res) => res.json(radar()));
api.get('/push/clave', autenticar, (req, res) => res.json({ clave: push.llavePublica() }));
api.post('/push/suscribir', autenticar, ruta((req, res) => {
  const s = req.body?.suscripcion || {};
  if (!/^https:\/\//.test(s.endpoint || '') || !s.keys?.p256dh || !s.keys?.auth) fallo(400, 'La suscripción no es válida.');
  db.suscripciones = db.suscripciones.filter((x) => x.endpoint !== s.endpoint);
  db.suscripciones.push({ usuario_id: req.usuario.id, endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, creada: new Date().toISOString(), dispositivo: txt(req.body?.dispositivo, 80) });
  escribirBase(db);
  res.status(201).json({ ok: true, dispositivos: db.suscripciones.filter((x) => x.usuario_id === req.usuario.id).length });
}));
api.delete('/push/suscribir', autenticar, ruta((req, res) => {
  const endpoint = String(req.body?.endpoint || '');
  db.suscripciones = db.suscripciones.filter((x) => !(x.endpoint === endpoint && x.usuario_id === req.usuario.id));
  escribirBase(db);
  res.json({ ok: true });
}));
api.post('/push/prueba', autenticar, permiso('alumnos.ver'), ruta(async (req, res) => {
  const r = radar();
  const resultado = await notificar(mensajeRadar(r, 'Alerta de prueba · Radar de Estadías',
    `${r.conteo.alto} alumnos en riesgo alto y ${r.conteo.medio} en seguimiento. Toca para abrir el radar.`), (s) => s.usuario_id === req.usuario.id);
  res.json(resultado);
}));

/* ---------- Demostración ---------- */
api.post('/reset', autenticar, permiso('usuarios.editar'), ruta(async (req, res) => {
  db.datos = seed();
  if (USA_SUPABASE) {
    try { await enCola(async () => { await supa.reemplazarTodo(db.datos); sincronizado = copiaTablas(db.datos); }); }
    catch (e) { await recargarDeSupabase().catch(() => {}); fallo(502, 'No se pudieron restablecer los datos en Supabase. ' + e.message); }
  }
  await confirmar(req, res, 'Restableció los datos de ejemplo', 'Datos de ejemplo restablecidos');
}));

app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La petición es demasiado grande.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido.' });
  console.error(err);
  res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
});

/* ---------- Arranque ---------- */
async function iniciar() {
  if (USA_SUPABASE) {
    supa.configurar(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    console.log('\n  Conectando con Supabase…');
    let d = await supa.cargarTodo();
    if (supa.estaVacia(d)) {
      console.log('  Las tablas están vacías: insertando los datos de ejemplo…');
      const ejemplo = seed();
      await supa.reemplazarTodo(ejemplo);
      d = await supa.cargarTodo();
      if (!db.datos.actividad.length) db.datos.actividad = ejemplo.actividad;
    }
    Object.assign(db.datos, d);
    sincronizado = copiaTablas(d);
    console.log(`  Supabase listo: ${d.alumnos.length} alumnos, ${d.asesores.length} asesores, ${d.empresas.length} empresas`);
    setInterval(() => revisarSupabase().catch((e) => console.error('  Supabase:', e.message)), 10000);
  }
  push.iniciar(VAPID_PATH);
  rojosPrevios = new Set(radar().alumnos.filter((a) => a.nivel === 'alto').map((a) => a.id));
  app.listen(PUERTO, mostrarInicio);
}
iniciar().catch((e) => { console.error('\n  No se pudo iniciar el servidor:', e.message, '\n'); process.exit(1); });

function mostrarInicio() {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('\n  SIGEP UTP · Módulo 2: Administración y gestión académica');
  console.log(`  - Base de datos:        ${USA_SUPABASE ? 'Supabase (' + process.env.SUPABASE_URL + ')' : 'archivo data/db.json'}`);
  const r = radar();
  console.log(`  - Radar de Estadías:    ${r.conteo.alto} en riesgo alto, ${r.conteo.medio} en seguimiento · notificaciones push listas`);
  console.log(`  - En esta computadora:  http://localhost:${PUERTO}`);
  ips.forEach((ip) => console.log(`  - En tu red WiFi:       http://${ip}:${PUERTO}`));
  console.log('\n  Para abrirlo e instalarlo en el celular con https, en otra terminal ejecuta:');
  console.log('    npm run tunel\n');
}
