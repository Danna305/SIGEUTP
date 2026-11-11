/* =====================================================================
   SIGEP UTP · Módulo 2: Administración y gestión académica
   Frontend (PWA): página informativa + panel administrativo
   Los datos vienen del Supabase de SIGEP a través de js/datos.js (M2),
   que atiende las mismas rutas que tenía la API REST del servidor.
   ===================================================================== */

/* ============ Íconos (SVG de trazo) ============ */
const P = {
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/><circle cx="12" cy="12" r="1"/>',
  cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/><path d="M22 10v6"/>',
  arrowL: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  menu: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  userCheck: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
  shuffle: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  building: '<path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M10 21v-5h4v5"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  chevU: '<path d="m18 15-6-6-6 6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  bar: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>'
};
const ic = (n, s = 18) => `<svg class="i" viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true" style="width:${s}px;height:${s}px">${P[n]}</svg>`;

/* ============ Catálogos ============ */
const HOY = M2.hoy();                           // fecha de hoy (AAAA-MM-DD, hora local)
const CARRERAS = { ISC: 'Ing. en Sistemas Computacionales', IMT: 'Ing. en Mecatrónica', IIN: 'Ing. Industrial', LNM: 'Lic. en Negocios y Mercadotecnia', IER: 'Ing. en Energías Renovables' };
// Documentos del expediente digital (Módulo 1)
const DOCS = [['presentacion', 'Carta de presentación'], ['aceptacion', 'Carta de aceptación'], ['seguro', 'Seguro facultativo (IMSS)'], ['ine', 'Identificación oficial (INE)']];
const NIVELES = { TSU: 'TSU', 'Ingeniería': 'Ingeniería' };
const EST_DOC = { pendiente: ['Pendiente', ''], cargado: ['En revisión', 'info'], aprobado: ['Aprobado', 'ok'], rechazado: ['Rechazado', 'bad'] };
const EST_AL = { activo: ['Activo', 'ok'], baja: ['Baja', 'bad'], concluido: ['Concluido', ''] };
const carreraDe = (c) => CARRERAS[c] || 'Sin carrera';
const EST_PER = { activo: ['Activo', 'ok'], planeado: ['Planeado', 'info'], cerrado: ['Cerrado', ''] };
const TIPO_ASG = { individual: 'Individual', masiva: 'Masiva', automatica: 'Automática' };
const PERMISOS = [
  ['alumnos.ver', 'Alumnos', 'Consultar'], ['alumnos.editar', 'Alumnos', 'Registrar, editar y eliminar'],
  ['asesores.ver', 'Asesores', 'Consultar'], ['asesores.editar', 'Asesores', 'Registrar, editar y eliminar'],
  ['asignaciones.editar', 'Asignaciones', 'Asignar y quitar asesores'],
  ['periodos.ver', 'Periodos', 'Consultar'], ['periodos.editar', 'Periodos', 'Crear, activar y cerrar'],
  ['empresas.ver', 'Empresas', 'Consultar empresas y contactos'], ['empresas.editar', 'Empresas', 'Registrar, editar y renovar convenios'],
  ['expedientes.ver', 'Expedientes', 'Consultar estado general'],
  ['usuarios.ver', 'Usuarios', 'Consultar usuarios y roles'], ['usuarios.editar', 'Usuarios', 'Gestionar usuarios y permisos']
];

/* ============ Utilidades ============ */
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (f) => f ? new Date(f.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '') : '—';
const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const plural = (n, s, p = s + 's') => `${n} ${n === 1 ? s : p}`;
const ini = (n) => String(n).replace(/^(Dr\.|Dra\.|Mtro\.|Mtra\.|Ing\.|Lic\.|C\.P\.)\s*/, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const chip = ([t, c]) => `<span class="chip ${c}">${t}</span>`;
const help = (t) => `<div class="help">${ic('info', 16)}<p>${t}</p></div>`;
function hace(iso) {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'Ahora'; if (m < 60) return `Hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24); return d === 1 ? 'Ayer' : `Hace ${d} días`;
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200); }

/* ============ Conexión con la base de datos (js/datos.js) ============ */
let S = null, PERMS = [], VERSION = 0;
let SESION = null;   // { id, nombre, email, rol_id, rol, permisos } del personal con sesión
const can = (p) => PERMS.includes(p);

// Índices para consultar rápido asignaciones, cargas y contactos
const IDX = { asg: new Map(), carga: new Map(), contactos: new Map(), alEmp: new Map() };
function indexar() {
  IDX.asg.clear(); IDX.carga.clear(); IDX.contactos.clear(); IDX.alEmp.clear();
  S.asignaciones_asesor.forEach((g) => {
    IDX.asg.set(g.alumno_id + '|' + g.periodo_id, g);
    const k = g.asesor_id + '|' + g.periodo_id; IDX.carga.set(k, (IDX.carga.get(k) || 0) + 1);
  });
  S.contactos_empresa.forEach((c) => { if (!IDX.contactos.has(c.empresa_id)) IDX.contactos.set(c.empresa_id, []); IDX.contactos.get(c.empresa_id).push(c); });
  S.alumnos.forEach((a) => { if (a.empresa_id) IDX.alEmp.set(a.empresa_id, (IDX.alEmp.get(a.empresa_id) || 0) + 1); });
}
function setEstado(d) { VERSION = d.version; S = d.datos; PERMS = d.permisos; indexar(); if (typeof ponerBadge === 'function') ponerBadge(); }

async function api(metodo, ruta, cuerpo) {
  try {
    return await M2.pedir(metodo, ruta, cuerpo);
  } catch (e) {
    if (e.status === 401 && SESION) { cerrarSesion(); go('#/login'); }
    throw e;
  }
}
// Ejecuta un cambio en la base de datos, actualiza los datos, redibuja y avisa
async function accion(metodo, ruta, cuerpo, mensaje, despues) {
  try {
    const d = await api(metodo, ruta, cuerpo);
    if (d.datos) setEstado(d);
    closeModal(); rerender();
    toast(mensaje || d.mensaje || 'Listo');
    if (despues) despues(d);
    return d;
  } catch (e) { toast(e.message); return null; }
}
const cargarEstado = async () => setEstado(await api('GET', '/estado'));
function cerrarSesion() { SESION = null; S = null; PERMS = []; UI.pop = null; UI.menu = false; if (typeof guardarTokenBD === 'function') guardarTokenBD(null); if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {}); }

// Cada 8 s revisa si otro usuario hizo cambios
async function sincronizar() {
  if (!SESION || !S || document.hidden) return;
  try {
    const v = await api('GET', '/version');
    if (v.version !== VERSION) {
      await cargarEstado();
      const ocupado = $('#mbg') || document.activeElement?.matches('input,textarea,select');
      if (!ocupado) rerender();
    }
  } catch (e) {}
}

/* ============ Consultas sobre los datos ============ */
const per = (id) => S.periodos.find((p) => p.id === id);
const SIN_PERIODO = { id: '', clave: 'SIN-PERIODO', nombre: 'Sin periodo registrado', inicio: HOY, fin: HOY, estado: 'planeado' };
const activo = () => S.periodos.find((p) => p.estado === 'activo') || S.periodos[S.periodos.length - 1] || SIN_PERIODO;
const al = (id) => S.alumnos.find((a) => a.id === id);
const as = (id) => S.asesores.find((a) => a.id === id);
const em = (id) => S.empresas.find((e) => e.id === id);
const asgDe = (a) => IDX.asg.get(a.id + '|' + a.periodo_id);
const asesorDe = (a) => { const g = asgDe(a); return g ? as(g.asesor_id) : null; };
const carga = (asId, perId = activo().id) => IDX.carga.get(asId + '|' + perId) || 0;
const contactos = (eId) => IDX.contactos.get(eId) || [];
const principal = (eId) => contactos(eId).find((c) => c.principal) || contactos(eId)[0];
const alumnosPer = (pid = activo().id) => S.alumnos.filter((a) => a.periodo_id === pid);
const sinAsesor = (pid = activo().id) => alumnosPer(pid).filter((a) => a.estado === 'activo' && !asgDe(a));
const aprob = (a) => DOCS.filter(([k]) => a.expediente[k] === 'aprobado').length;
function estExp(a) {
  const v = Object.values(a.expediente);
  if (v.includes('rechazado')) return ['Con rechazos', 'bad'];
  if (v.every((x) => x === 'aprobado')) return ['Completo', 'ok'];
  if (v.includes('cargado')) return ['En revisión', 'info'];
  return ['En proceso', ''];
}
function convEst(e) {
  if (e.convenio === 'tramite') return ['En trámite', 'info', 'tramite'];
  if (!e.vence || e.vence < HOY) return ['Vencido', 'bad', 'vencido'];
  if (dias(HOY, e.vence) <= 60) return ['Vence pronto', 'warn', 'pronto'];
  return ['Vigente', 'ok', 'vigente'];
}
function semanas(p) {
  const total = Math.max(1, Math.ceil(dias(p.inicio, p.fin) / 7));
  const actual = Math.min(total, Math.max(0, Math.ceil((dias(p.inicio, HOY) + 1) / 7)));
  return { total, actual };
}
const dots = (a) => `<div class="dots" title="${DOCS.map(([k, n]) => n + ': ' + EST_DOC[a.expediente[k]][0]).join(', ')}">${DOCS.map(([k]) => `<i class="${a.expediente[k]}"></i>`).join('')}</div>`;
function alertas() {
  const out = [], p = activo();
  const rojos = can('alumnos.ver') ? RADAR().conteo.alto : 0;
  if (rojos) out.push({ t: `${plural(rojos, 'alumno')} en riesgo alto`, x: 'Revisa el Radar de estadías', to: '#/app/radar', icon: 'radar', c: 'bad' });
  const sa = sinAsesor().length;
  if (sa) out.push({ t: `${plural(sa, 'alumno')} sin asesor`, x: `Periodo ${p.nombre}`, to: '#/app/asignaciones', icon: 'userCheck', c: 'warn' });
  const venc = S.empresas.filter((e) => convEst(e)[2] === 'vencido').length;
  if (venc) out.push({ t: `${plural(venc, 'convenio vencido', 'convenios vencidos')}`, x: 'Requieren renovación', to: '#/app/empresas', f: 'em.conv:vencido', icon: 'alert', c: 'bad' });
  const pronto = S.empresas.filter((e) => convEst(e)[2] === 'pronto').length;
  if (pronto) out.push({ t: `${plural(pronto, 'convenio vence', 'convenios vencen')} en menos de 60 días`, x: 'Programa su renovación', to: '#/app/empresas', f: 'em.conv:pronto', icon: 'clock', c: 'warn' });
  const inact = S.asesores.filter((t) => !t.activo && carga(t.id) > 0).length;
  if (inact) out.push({ t: `${plural(inact, 'asesor inactivo', 'asesores inactivos')} con alumnos`, x: 'Reasigna a sus alumnos', to: '#/app/asesores', f: 'as.estado:inactivo', icon: 'alert', c: 'warn' });
  const sinEmp = alumnosPer().filter((a) => a.estado === 'activo' && !a.empresa_id).length;
  if (sinEmp) out.push({ t: `${plural(sinEmp, 'alumno')} sin empresa`, x: 'Asigna una empresa con convenio', to: '#/app/alumnos', f: 'al.empresa:sin', icon: 'building', c: '' });
  return out;
}

/* ============ Estado de la interfaz ============ */
const UI = {
  pop: null, menu: false,
  al: { q: '', carrera: '', grupo: '', periodo: '', estado: 'activo', asesor: '', empresa: '', exp: '', sort: 'nombre', dir: 1, page: 1, filtros: false, sel: new Set() },
  as: { q: '', carrera: '', estado: '' },
  ag: { q: '', carrera: '', sel: new Set(), asesor: '', lq: '', page: 1, auto: '' },
  em: { q: '', conv: '' },
  ex: { q: '', doc: '', est: '', carrera: '' },
  us: { tab: 'usuarios' },
  ca: { abiertos: new Set(), log: [], url: 'datos/estado.json', resultado: null, fechaDatos: null }
};

/* ============ Router ============ */
const go = (h) => { location.hash = h; };
function route() {
  const p = location.hash.replace(/^#\/?/, '').split('/');
  UI.pop = null;
  if (p[0] === 'app') {
    if (!SESION) { go('#/login'); return; }
    if (!S) {
      $('#root').innerHTML = '<div class="login"><p class="muted">Cargando el panel…</p></div>';
      cargarEstado().then(route).catch((e) => toast(e.message));
      return;
    }
    renderApp(p[1] || 'dashboard', p[2]);
    return;
  }
  if (p[0] === 'login') { renderLogin(); return; }
  renderLanding(p[0]);
}
window.addEventListener('hashchange', route);
function rerender() { const p = location.hash.replace(/^#\/?/, '').split('/'); if (p[0] === 'app' && S) renderApp(p[1] || 'dashboard', p[2]); }

/* =====================================================================
   PÁGINA INFORMATIVA (pública)
   ===================================================================== */
function renderLanding(sec) {
  if (!document.getElementById('landing')) {
    const feats = [
      ['users', 'Registro, consulta y edición de alumnos', 'Matrícula única, carrera, grupo, periodo, empresa y proyecto. Marca bajas o estadías concluidas.'],
      ['userCheck', 'Registro y gestión de asesores', 'Carrera que atiende, capacidad máxima de alumnos y estado activo o inactivo.'],
      ['calendar', 'Creación y administración de periodos', 'Fechas, clave y semanas de cada periodo. Solo uno puede estar activo a la vez.'],
      ['shuffle', 'Asignación de asesores', 'Individual, masiva (varios alumnos a la vez) o automática equilibrando la carga. Nunca rebasa la capacidad del asesor.'],
      ['building', 'Gestión de empresas y contactos', 'RFC, giro, convenio con fecha de vencimiento y varios contactos por empresa, con uno principal.'],
      ['folder', 'Estado general de expedientes', 'Avance de los 4 documentos del expediente digital (Módulo 1) de cada alumno, con filtros por documento y estado.'],
      ['filter', 'Filtros y búsquedas avanzadas', 'Combina carrera, grupo, periodo, estado, asesor, empresa y expediente. Exporta el resultado a CSV.'],
      ['bar', 'Panel con estadísticas básicas', 'Alumnos sin asesor, carga de asesores, convenios vencidos y avance de documentación en un vistazo.'],
      ['shield', 'Gestión de usuarios y permisos', 'Usuarios con rol y una matriz de permisos editable. La base de datos valida cada acción.']
    ];
    const tablas = [
      ['personal_admin', [['id', 'PK · FK → auth.users'], ['nombre'], ['correo', 'UQ'], ['rol_id', 'FK → roles_admin'], ['activo'], ['ultimo_acceso']]],
      ['roles_admin', [['id', 'PK'], ['nombre'], ['descripcion'], ['permisos']]],
      ['alumnos', [['id', 'PK · FK → auth.users'], ['matricula', 'UQ'], ['nombre'], ['correo'], ['nivel'], ['carrera'], ['grupo'], ['periodo_id', 'FK → periodos'], ['empresa_id', 'FK → empresas'], ['proyecto'], ['estado']]],
      ['asesores', [['id', 'PK · FK → auth.users'], ['nombre'], ['correo', 'UQ'], ['carrera'], ['area'], ['capacidad'], ['activo']]],
      ['periodos', [['id', 'PK'], ['clave', 'UQ'], ['nombre'], ['inicio'], ['fin'], ['estado']]],
      ['asignaciones_asesor', [['alumno_id', 'PK · FK → alumnos'], ['asesor_id', 'FK → asesores'], ['periodo_id', 'FK → periodos'], ['tipo'], ['asignado_en']]],
      ['empresas', [['id', 'PK'], ['nombre', 'UQ'], ['rfc'], ['giro'], ['ciudad'], ['convenio'], ['vence']]],
      ['contactos_empresa', [['id', 'PK'], ['empresa_id', 'FK → empresas'], ['nombre'], ['puesto'], ['email'], ['telefono'], ['principal']]]
    ];
    const rolesTabla = [
      ['Consultar alumnos, asesores, empresas y expedientes', 1, 1, 1],
      ['Registrar y editar alumnos, asesores y empresas', 1, 1, 0],
      ['Asignar asesores (individual, masiva, automática)', 1, 1, 0],
      ['Consultar periodos', 1, 1, 1],
      ['Crear, activar y cerrar periodos', 1, 0, 0],
      ['Gestionar usuarios y permisos', 1, 0, 0]
    ];
    const modulos = [
      [1, 'Expediente digital y gestión de documentos', 'El alumno sube sus documentos y la coordinación los revisa.'],
      [2, 'Administración y gestión académica', 'Control de alumnos, asesores, empresas y periodos.'],
      [3, 'Seguimiento académico y revisión de estadías', 'El asesor da seguimiento y revisa las entregas.'],
      [4, 'Portal del alumno y acceso móvil', 'El alumno consulta su estadía desde web o celular.']
    ];
    $('#root').innerHTML = `
<div id="landing">
<header class="site-head"><div class="wrap">
  <a class="logo" href="#/"><span class="logo-mark">${ic('cap', 20)}</span><span><b>SIGEP UTP</b><small>Administración académica</small></span></a>
  <button class="site-menu-btn" id="siteMenu" aria-label="Abrir menú" aria-expanded="false">${ic('menu')}</button>
  <nav class="site-nav" id="siteNav" aria-label="Secciones">
    <a href="#/objetivo">Objetivo</a><a href="#/funciones">Funciones</a><a href="#/radar">Radar</a><a href="#/flujo">Cómo se usa</a><a href="#/roles">Roles</a>
    <a href="#/datos">Datos</a><a href="#/accion">En acción</a><a href="#/sistema">Sistema</a><a href="#/preguntas">Preguntas</a>
    <button class="btn sm out" id="installBtn" hidden>Instalar app</button>
    <a class="btn sm" href="#/login" style="color:var(--btn-text);margin-left:6px">Entrar al panel</a>
  </nav>
</div></header>
<main>
<section class="hero"><div class="wrap">
  <div>
    <p class="kicker">Propuesta 2 de SIGEP UTP</p>
    <h1 class="slab">Administración y gestión académica</h1>
    <p class="lead">Un panel para que la coordinación de estadías controle en un solo lugar a los estudiantes, los asesores, las empresas y los periodos, y sepa en segundos qué necesita atención.</p>
    <div class="ctas"><a class="btn" href="#/login">Entrar al panel</a><a class="btn out" href="#/funciones">Ver funcionalidades</a></div>
    <div class="hero-facts">
      <span>${ic('layers', 16)}<b>9 funcionalidades</b> + Radar</span>
      <span>${ic('database', 16)}<b>8 tablas</b> de base de datos</span>
      <span>${ic('shield', 16)}<b>3 roles</b> con permisos</span>
    </div>
  </div>
  <div class="phone" aria-hidden="true"><div class="mini">
    <div><b style="font-size:.95rem">Panel de Control</b><div class="mono" style="font-size:.6rem">Enero – Junio 2025 · Semana 14</div></div>
    <div class="mini-stats">
      <div><span>${ic('users', 12)}</span><b>134</b><small>Alumnos en el periodo</small></div>
      <div><span>${ic('building', 12)}</span><b>38</b><small>Empresas activas</small></div>
      <div><span>${ic('userCheck', 12)}</span><b>13</b><small>Sin asesor</small></div>
      <div><span>${ic('alert', 12)}</span><b>3</b><small>Convenios vencidos</small></div>
    </div>
    <div class="card" style="padding:10px;font-size:.62rem"><b style="font-size:.7rem">Avance de documentación</b>
      ${[['Carta de Aceptación', 96], ['Seguro Social / IMSS', 84], ['Plan de Trabajo', 79], ['Reporte Parcial', 61]].map(([n, v]) => `<div style="margin-top:7px"><div style="display:flex;justify-content:space-between"><span>${n}</span><span class="mono" style="font-size:.55rem">${v}%</span></div><div class="bar" style="height:4px;margin-top:3px"><i style="width:${v}%"></i></div></div>`).join('')}
    </div>
  </div></div>
</div></section>

<div class="cycle-strip"><div class="wrap">
  <div><div class="mono">PERIODO ACTIVO</div><b style="font-size:1.1rem">Enero – Junio 2025</b></div>
  <div style="display:grid;gap:6px"><div class="bar"><i style="width:64%"></i></div><span class="mono">Semana 14 de 22</span></div>
  <div class="mono">Módulo 2 de 4 del Sistema de Gestión de Estadías</div>
</div></div>

<section class="block" id="objetivo"><div class="wrap">
  <h2 class="slab">Objetivo del módulo</h2>
  <p class="intro">Centralizar el control de estudiantes, asesores, empresas y periodos de estadías, para que la coordinación deje de depender de listas sueltas y correos.</p>
  <div class="pitch">
    <article class="pitch-card"><span class="pitch-tag">Hoy</span><h3>Información dispersa</h3><p>Una hoja de cálculo por carrera, asignaciones de asesor por correo y convenios cuyo vencimiento nadie revisa hasta que un alumno ya está en la empresa.</p></article>
    <article class="pitch-card"><span class="pitch-tag">Con el módulo</span><h3>Un catálogo único</h3><p>Alumnos, asesores, empresas, contactos y periodos en una sola base de datos, con asignaciones que respetan la capacidad de cada asesor.</p></article>
    <article class="pitch-card"><span class="pitch-tag">Resultado</span><h3>Decisiones a tiempo</h3><p>El panel avisa quién no tiene asesor, qué convenio vence y cómo va cada expediente, sin tener que cruzar archivos a mano.</p></article>
  </div>
</div></section>

<section class="block" id="funciones"><div class="wrap">
  <h2 class="slab">Funcionalidades principales</h2>
  <p class="intro">Las nueve funciones que pide el módulo, todas conectadas al backend y protegidas por permisos.</p>
  <div class="feats">${feats.map(([i, t, d]) => `<article class="feat"><span class="ic-box">${ic(i)}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div>
</div></section>

<section class="block" id="radar"><div class="wrap">
  <p class="kicker" style="color:var(--btn)">Propuesta de mejora · Innovación y creatividad</p>
  <h2 class="slab">Radar de Estadías</h2>
  <p class="intro">El panel deja de solo mostrar datos: califica de 0 a 100 a cada alumno, avisa a la coordinación cuando alguien pasa a riesgo alto y permite resolverlo desde el celular, incluso sin internet.</p>
  <div class="feats">
    <article class="feat"><span class="ic-box">${ic('radar')}</span><h3>Semáforo de riesgo</h3><p>Cinco factores: documentos atrasados, asesor, empresa y convenio, documentos rechazados y carga del asesor. Explica por qué cada alumno está en rojo.</p></article>
    <article class="feat"><span class="ic-box">${ic('zap')}</span><h3>Acción sugerida</h3><p>Propone al asesor de su carrera con menos carga, la renovación del convenio o revisar el expediente, y se aplica con un clic.</p></article>
    <article class="feat"><span class="ic-box">${ic('bell')}</span><h3>Alertas push</h3><p>Llegan aunque la app esté cerrada cuando un alumno pasa a rojo, más un resumen diario. El ícono muestra cuántos alumnos están en rojo.</p></article>
    <article class="feat"><span class="ic-box">${ic('database')}</span><h3>Funciona sin conexión</h3><p>Las asignaciones hechas sin internet se guardan en el dispositivo y se envían solas al volver la conexión.</p></article>
  </div>
  <p style="margin-top:22px"><a class="btn" href="#/login">${ic('radar', 16)}Ver el radar en el panel</a></p>
</div></section>

<section class="block" id="flujo"><div class="wrap">
  <h2 class="slab">Cómo se usa en un periodo</h2>
  <p class="intro">El orden en que la coordinación prepara y da seguimiento a un periodo de estadías dentro del panel.</p>
  <ol class="steps">
    <li><h3>Crear y activar el periodo</h3><p>Define nombre, clave y fechas. Al activarlo, el periodo anterior se cierra solo.</p></li>
    <li><h3>Registrar empresas y contactos</h3><p>Captura la empresa, la vigencia de su convenio y a la persona responsable de los alumnos.</p></li>
    <li><h3>Registrar asesores</h3><p>Indica la carrera que atiende cada asesor y cuántos alumnos puede llevar como máximo.</p></li>
    <li><h3>Registrar alumnos</h3><p>Matrícula, carrera, grupo, empresa y proyecto. El sistema impide matrículas repetidas.</p></li>
    <li><h3>Asignar asesores</h3><p>Uno por uno, a varios seleccionados a la vez o de forma automática por carrera y carga.</p></li>
    <li><h3>Dar seguimiento</h3><p>El panel muestra alertas, carga de asesores y el avance de los expedientes durante todo el periodo.</p></li>
  </ol>
</div></section>

<section class="block" id="roles"><div class="wrap two">
  <div>
    <h2 class="slab">Roles y permisos</h2>
    <p class="intro" style="margin-bottom:20px">Cada usuario entra con un rol. El administrador puede cambiar qué permite cada rol desde la sección Usuarios y permisos, y la base de datos rechaza cualquier acción no autorizada.</p>
    <div class="card"><h3 style="font-size:1rem;margin-bottom:10px">Una sola cuenta para todo SIGEP</h3>
      <p class="muted small">El personal de coordinación entra con su cuenta de SIGEP (Supabase Auth). Si ya inició sesión en otro módulo, entra directo. Las cuentas de prueba están en el README del repositorio.</p></div>
  </div>
  <div class="table perm-table" style="--cols:2.4fr .8fr .8fr .8fr">
    <div class="trow head"><span>Permiso</span><span>Admin</span><span>Coord.</span><span>Consulta</span></div>
    ${rolesTabla.map(([n, ...v]) => `<div class="trow"><span>${n}</span>${v.map((x) => `<span class="${x ? 'yes' : 'no'}">${x ? ic('check', 16) : '—'}</span>`).join('')}</div>`).join('')}
  </div>
</div></section>

<section class="block" id="datos"><div class="wrap">
  <h2 class="slab">Modelo de datos</h2>
  <p class="intro">Las tablas que usa el módulo, en el mismo <b>Supabase</b> (PostgreSQL) de SIGEP: <span class="mono">supabase/modulo-2.sql</span> crea las propias y agrega los datos académicos a <span class="mono">alumnos</span>, <span class="mono">asesores</span> y <span class="mono">asignaciones_asesor</span>, que comparten los cuatro módulos</p>
  <div class="er">${tablas.map(([n, cols]) => `<article class="er-t"><h3>${n}</h3><ul>${cols.map(([c, k]) => `<li><span>${c}</span>${k ? `<em class="${k.startsWith('FK') ? 'fk' : k === 'PK' ? 'pk' : 'uq'}">${k}</em>` : ''}</li>`).join('')}</ul></article>`).join('')}</div>
  <p class="muted small" style="margin-top:16px">Cada alumno tiene un solo asesor (clave <span class="mono">alumno_id</span>), el mismo que lo revisa en los módulos 1, 3 y 4.</p>
</div></section>

<section class="block" id="accion"><div class="wrap">
  <h2 class="slab">El panel en acción</h2>
  <p class="intro">Recorrido real por el módulo: estadísticas, búsqueda con filtros, asignación masiva y automática, empresas con contactos y la matriz de permisos.</p>
  <figure class="video-box">
    <video controls preload="metadata" playsinline poster="img/video-poster.jpg" width="1280" height="720">
      <source src="media/recorrido-modulo2.mp4" type="video/mp4">Tu navegador no puede reproducir este video.
    </video>
    <figcaption>Recorrido por el panel administrativo (sin audio).</figcaption>
  </figure>
  <h3 style="font-size:1.2rem;margin:44px 0 16px">Galería de pantallas</h3>
  <div class="gallery">
    ${[['panel-movil.jpg', 'Panel de control en el celular', 'Panel en el celular', 390, 844], ['dashboard.jpg', 'Panel de control con estadísticas del periodo', 'Panel de control', 1440, 900], ['alumnos-filtros.jpg', 'Lista de alumnos con filtros avanzados y selección para asignación masiva', 'Alumnos con filtros', 1440, 900], ['asignaciones.jpg', 'Asignación de asesores con carga y capacidad', 'Asignaciones', 1440, 900], ['permisos.jpg', 'Matriz de permisos por rol', 'Usuarios y permisos', 1440, 900]]
      .map(([f, alt, cap, w, h]) => `<figure class="shot zoomable"><button type="button" data-zoom="img/${f}" data-alt="${alt}" aria-label="Ampliar imagen: ${cap}"><img src="img/${f}" alt="${alt}" width="${w}" height="${h}" loading="lazy"></button><figcaption>${cap}</figcaption></figure>`).join('')}
  </div>
</div></section>

<section class="block" id="sistema"><div class="wrap">
  <h2 class="slab">Lugar en el sistema completo</h2>
  <p class="intro">El Sistema de Gestión de Estadías se divide en cuatro módulos que comparten una sola base de datos. Esta propuesta desarrolla el Módulo 2.</p>
  <div class="mods">${modulos.map(([n, t, d]) => `<article class="mod ${n === 2 ? 'on' : ''}"><span class="mod-n">${n}</span><div><h3>${t}</h3><p>${d}</p>${n === 2 ? '<span class="chip solid">Esta propuesta</span>' : ''}</div></article>`).join('')}</div>
  <div class="two" style="margin-top:36px">
    <div class="card" style="padding:22px"><h3 style="font-size:1.05rem;margin-bottom:10px">Entregable</h3>
      <p class="muted" style="line-height:1.65">Panel administrativo funcional con gestión de alumnos, asesores, periodos y empresas, conectado al Supabase de SIGEP con autenticación y permisos por rol.</p>
      <p style="margin-top:14px"><b>Responsable:</b> Danna Michelle Cruz Vazquez (Integrante 2)</p></div>
    <div class="card" style="padding:22px"><h3 style="font-size:1.05rem;margin-bottom:14px">Arquitectura de esta propuesta</h3>
      <div class="arch">
        <div><b>Frontend</b><span>PWA con HTML, CSS y JavaScript</span></div>${ic('chevR')}
        <div><b>Seguridad</b><span>Supabase Auth, RLS y funciones</span></div>${ic('chevR')}
        <div><b>Datos</b><span>Supabase (PostgreSQL)</span></div>
      </div>
      <p class="muted small" style="margin-top:14px">El sistema final del equipo usará React, Kotlin con Spring Boot y MySQL. Las rutas y tablas de esta propuesta siguen la misma estructura para facilitar la integración.</p></div>
  </div>
</div></section>

<section class="block faq" id="preguntas"><div class="wrap">
  <h2 class="slab">Preguntas frecuentes</h2><p class="intro">Dudas comunes de la coordinación al usar el panel.</p>
  <details><summary>¿Qué pasa si un asesor ya llegó a su capacidad?</summary><p>La base de datos no permite asignarle más alumnos y te dice cuántos lugares le quedan. Puedes aumentar su capacidad en Asesores o elegir a otro.</p></details>
  <details><summary>¿Cómo funciona la asignación automática?</summary><p>Toma a los alumnos activos sin asesor del periodo activo y asigna cada uno al asesor de su misma carrera con menor carga en proporción a su capacidad. Si no hay lugares, te avisa cuántos quedaron pendientes.</p></details>
  <details><summary>¿Puedo cambiar el periodo activo?</summary><p>Sí, si tu rol tiene el permiso. Al activar un periodo, el que estaba activo se cierra; sus alumnos y asignaciones se conservan como historial.</p></details>
  <details><summary>¿Por qué no puedo eliminar una empresa o un asesor?</summary><p>Para no perder información: una empresa con alumnos o un asesor con asignaciones no se puede eliminar. Cambia a los alumnos de empresa o desactiva al asesor.</p></details>
  <details><summary>¿El panel funciona sin internet?</summary><p>Sí, para consultar. El Service Worker guarda la app y la última información del panel con la API Cache, así que puedes abrirlo sin conexión y ver los datos guardados. Registrar o modificar datos sí necesita conexión. En la sección Caché sin conexión puedes ver y administrar lo que está guardado.</p></details>
  <details><summary>¿Quién sube los documentos del expediente?</summary><p>El alumno, en el Módulo 1 (Expediente digital). En este módulo la coordinación consulta el estado general de todos los expedientes.</p></details>
</div></section>

<section class="block" id="contacto"><div class="wrap">
  <h2 class="slab">Contacto</h2><p class="intro">Coordinación de Estadías y Prácticas Profesionales.</p>
  <div class="contact">
    <div>${ic('mail')}<b style="margin-top:8px">Correo</b><span class="muted">admin@utpuebla.edu.mx</span></div>
    <div>${ic('clock')}<b style="margin-top:8px">Horario de atención</b><span class="muted">Lunes a viernes, 9:00 a 15:00</span></div>
    <div>${ic('pin')}<b style="margin-top:8px">Ubicación</b><span class="muted">Edificio de Vinculación, planta baja</span></div>
  </div>
</div></section>
</main>
<footer class="site-foot"><div class="wrap"><span>SIGEP UTP · Módulo 2: Administración y gestión académica</span><span>Propuesta de Danna Michelle Cruz Vazquez</span></div></footer>
</div>`;
    $('#siteMenu').onclick = () => { const n = $('#siteNav'); n.classList.toggle('open'); $('#siteMenu').setAttribute('aria-expanded', n.classList.contains('open')); };
  }
  $('#siteNav')?.classList.remove('open');
  showInstall();
  const t = sec && document.getElementById(sec);
  if (t) t.scrollIntoView(); else window.scrollTo(0, 0);
}

/* =====================================================================
   INICIO DE SESIÓN
   ===================================================================== */
function renderLogin() {
  $('#root').innerHTML = `<div class="login"><form class="login-card" id="loginForm">
    <div class="login-top"><a class="logo" href="#/"><span class="logo-mark">${ic('cap', 20)}</span><span><b>SIGEP UTP</b><small>Gestión de Estadías</small></span></a><span class="chip mod2"><span class="n">2</span>Administración</span></div>
    <div><h1 style="font-size:1.5rem;font-weight:800">Entrar al panel</h1><p class="muted small" style="margin-top:4px">Para el personal de coordinación. Usa tu cuenta de SIGEP; si ya entraste a otro módulo, entras directo.</p></div>
    <label class="field">Correo institucional<input type="email" id="lemail" name="email" autocomplete="username" required></label>
    <label class="field">Contraseña<input type="password" name="password" autocomplete="current-password" required></label>
    <button class="btn block" type="submit" id="lentrar">Entrar</button>
    <div class="login-links"><a href="#/">Información del módulo</a><a href="../index.html">${ic('arrowL', 14)}Portal SIGEP</a></div>
  </form></div>`;
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), boton = $('#lentrar');
    boton.disabled = true;
    try {
      SESION = await M2.entrar(f.get('email'), f.get('password'));
      S = null; guardarTokenBD(true);
      go('#/app/dashboard');
    } catch (err) { toast(err.message); }
    finally { boton.disabled = false; }
  };
  window.scrollTo(0, 0);
}

/* =====================================================================
   PANEL: estructura (menú lateral + barra superior)
   ===================================================================== */
const MENU = () => [
  ['dashboard', 'Panel de control', 'grid', null],
  ['radar', 'Radar de estadías', 'radar', 'alumnos.ver', RADAR().conteo.alto, true],
  ['alumnos', 'Alumnos', 'users', 'alumnos.ver', alumnosPer().length],
  ['asesores', 'Asesores', 'userCheck', 'asesores.ver', S.asesores.filter((t) => t.activo).length],
  ['asignaciones', 'Asignaciones', 'shuffle', 'asesores.ver', sinAsesor().length, true],
  ['periodos', 'Periodos', 'calendar', 'periodos.ver'],
  ['empresas', 'Empresas', 'building', 'empresas.ver', S.empresas.length],
  ['expedientes', 'Expedientes', 'folder', 'expedientes.ver'],
  ['usuarios', 'Usuarios y permisos', 'shield', 'usuarios.ver'],
  ['cache', 'Caché sin conexión', 'database', null]
];
const TITULOS = { dashboard: 'Panel de control', radar: 'Radar de estadías', alumnos: 'Alumnos', asesores: 'Asesores', asignaciones: 'Asignaciones', periodos: 'Periodos', empresas: 'Empresas', expedientes: 'Expedientes', usuarios: 'Usuarios y permisos', cache: 'Caché sin conexión', perfil: 'Mi perfil' };
const VISTAS = () => ({ dashboard: vDash, radar: vRadar, alumnos: vAlumnos, asesores: vAsesores, asignaciones: vAsignaciones, periodos: vPeriodos, empresas: vEmpresas, expedientes: vExpedientes, usuarios: vUsuarios, cache: vCache, perfil: vPerfil });

function renderApp(view) {
  const menu = MENU().filter((m) => !m[3] || can(m[3]));
  if (!VISTAS()[view] || (view !== 'perfil' && !menu.some((m) => m[0] === view))) view = 'dashboard';
  const p = activo(), sem = semanas(p), al_ = alertas();
  const rol = S.roles.find((r) => r.id === SESION.rol_id);
  const scroll = window.scrollY, mismo = renderApp._v === view;
  renderApp._v = view;
  $('#root').innerHTML = `<div class="shell">
  <aside class="side ${UI.menu ? 'open' : ''}" id="side" aria-label="Menú">
    <div class="side-head"><div class="logo"><span class="logo-mark">${ic('cap', 20)}</span><span><b>SIGEP UTP</b><small>Gestión de Estadías</small></span></div>
      <button class="side-close" data-act="closeMenu" aria-label="Cerrar menú">${ic('x')}</button></div>
    <div class="module-pill"><span class="n">2</span><span><small>Módulo 2</small>Administración</span></div>
    <div class="side-label">GESTIÓN</div>
    <nav class="side-nav">${menu.map(([k, n, i, , c, alerta]) => `<a href="#/app/${k}" ${k === view ? 'aria-current="page"' : ''}>${ic(i)}${n}${c ? `<span class="count ${alerta ? 'alert' : ''}">${c}</span>` : ''}</a>`).join('')}</nav>
    <div class="side-foot">
      <div class="cycle-card"><small>PERIODO ACTIVO</small><b>${esc(p.nombre)}</b><div class="bar"><i style="width:${pct(sem.actual, sem.total)}%"></i></div><span class="mono">Semana ${sem.actual} de ${sem.total}</span></div>
      <a class="side-link" href="../index.html">${ic('arrowL')}Portal SIGEP</a>
      <button class="side-out" data-act="logout">${ic('logout')}Cerrar sesión</button>
    </div>
  </aside>
  <div class="scrim ${UI.menu ? 'show' : ''}" data-act="closeMenu"></div>
  <div class="main">
    <header class="topbar">
      <button class="burger" data-act="openMenu" aria-label="Abrir menú">${ic('menu', 22)}</button>
      <div class="crumb">SIGEP UTP / Módulo 2 / <b>${TITULOS[view]}</b></div>
      ${navigator.onLine ? '' : `<a class="chip warn offline-chip" href="#/app/cache">${ic('alert', 13)}Sin conexión${UI.ca.fechaDatos ? ' · datos del ' + fechaHora(UI.ca.fechaDatos) : ''}</a>`}
      <div class="top-actions">
        <button class="icon-btn" data-act="pop" data-pop="notif" aria-label="Pendientes">${ic('bell', 20)}${al_.length ? `<span class="dot">${al_.length}</span>` : ''}</button>
        <button class="user-btn" data-act="pop" data-pop="user" aria-label="Menú de usuario"><span class="avatar dark">${ini(SESION.nombre)}</span>${ic('chevD', 16)}</button>
        ${UI.pop === 'notif' ? `<div class="pop"><div class="pop-head">Pendientes de la coordinación</div>${al_.length ? al_.map((a) => `<button class="notif notif-btn" data-act="ir" data-to="${a.to}" data-f="${a.f || ''}"><div class="t">${a.t}</div><p>${a.x}</p></button>`).join('') : '<div class="notif"><p>No hay pendientes. Todo está al día.</p></div>'}</div>` : ''}
        ${UI.pop === 'user' ? `<div class="pop user-pop"><div class="who"><b>${esc(SESION.nombre)}</b><span class="mono">${esc(SESION.email)}</span><span class="chip" style="margin-top:6px">${esc(rol?.nombre || '')}</span></div>
          <a href="#/app/perfil">${ic('user', 16)}Mi perfil</a><div class="sep"></div><button class="item" data-act="logout">${ic('logout', 16)}Cerrar sesión</button></div>` : ''}
      </div>
    </header>
    <main class="content" id="content" tabindex="-1">${VISTAS()[view]()}</main>
  </div></div>`;
  if (mismo) window.scrollTo(0, scroll); else window.scrollTo(0, 0);
  if (view === 'cache') { if (!UI.ca.log.length && 'caches' in window) op('caches.keys()', () => caches.keys()).catch(() => {}); cargarCache(); }
}

/* =====================================================================
   VISTA: Panel de control
   ===================================================================== */
function vDash() {
  const p = activo(), sem = semanas(p), alumnos = alumnosPer().filter((a) => a.estado !== 'baja');
  const activos = S.asesores.filter((t) => t.activo);
  const capTotal = activos.reduce((s, t) => s + t.capacidad, 0), asignados = activos.reduce((s, t) => s + carga(t.id), 0);
  const empAct = S.empresas.filter((e) => ['vigente', 'pronto'].includes(convEst(e)[2])).length;
  const tram = S.empresas.filter((e) => convEst(e)[2] === 'tramite').length;
  const venc = S.empresas.filter((e) => convEst(e)[2] === 'vencido').length;
  const al_ = alertas();
  const porCar = Object.keys(CARRERAS).map((c) => { const l = alumnos.filter((a) => a.carrera === c); return [c, l.length, l.filter((a) => asgDe(a)).length]; });
  const top = activos.map((t) => [t, carga(t.id)]).sort((a, b) => b[1] / b[0].capacidad - a[1] / a[0].capacidad).slice(0, 6);
  return `<div class="page-h"><div><h1>Panel de Control</h1><p class="sub">Periodo ${esc(p.nombre)} · Semana ${sem.actual} de ${sem.total}</p></div>
    ${can('asignaciones.editar') ? `<a class="btn sm out" href="#/app/asignaciones">${ic('shuffle', 16)}Asignar asesores</a>` : ''}</div>
  ${help('Estado general del periodo activo. Los números se actualizan solos cuando otro usuario hace cambios.')}
  <div class="stack">
  <div class="stats">
    <a class="stat link" href="#/app/alumnos"><span class="ic-box">${ic('users', 16)}</span><b>${alumnos.length}</b><span>Alumnos en el periodo</span><span class="mono ${sinAsesor().length ? 'strong' : ''}">${sinAsesor().length} sin asesor</span></a>
    <a class="stat link" href="#/app/asesores"><span class="ic-box">${ic('userCheck', 16)}</span><b>${activos.length}</b><span>Asesores activos</span><span class="mono">Ocupación ${pct(asignados, capTotal)}%</span></a>
    <a class="stat link" href="#/app/empresas"><span class="ic-box">${ic('building', 16)}</span><b>${empAct}</b><span>Empresas con convenio</span><span class="mono">+${tram} en trámite</span></a>
    <a class="stat link" href="#/app/empresas" data-act="ir" data-to="#/app/empresas" data-f="em.conv:vencido"><span class="ic-box">${ic('alert', 16)}</span><b>${venc}</b><span>Convenios vencidos</span><span class="mono strong">Requieren renovación</span></a>
  </div>
  <div class="cols">
    <section class="card"><div class="card-h"><h2>Pendientes de la coordinación</h2><span class="chip ${al_.length ? 'warn' : 'ok'}">${al_.length || 'Al día'}</span></div>
      <div class="rows">${al_.length ? al_.map((a) => `<div class="r"><span class="ic-box ${a.c}">${ic(a.icon, 16)}</span><div class="grow"><b>${a.t}</b><span class="muted">${a.x}</span></div><button class="btn xs out" data-act="ir" data-to="${a.to}" data-f="${a.f || ''}">Ver</button></div>`).join('') : '<p class="muted small">No hay pendientes. Todo está al día.</p>'}</div>
    </section>
    <section class="card"><div class="card-h"><h2>Avance de documentación</h2><span class="mono">${alumnos.length} alumnos</span></div>
      ${DOCS.map(([k, n]) => { const c = alumnos.filter((a) => a.expediente[k] === 'aprobado').length; return `<div class="bar-row"><div class="lbl">${n}<span>${pct(c, alumnos.length)}%</span></div><div class="bar"><i style="width:${pct(c, alumnos.length)}%"></i></div></div>`; }).join('')}
      <p class="mono" style="margin-top:10px">Documentos aprobados. Se gestionan en el Módulo 1.</p>
    </section>
  </div>
  <div class="cols">
    <section class="card"><div class="card-h"><h2>Alumnos por carrera</h2><span class="mono">con asesor / total</span></div>
      ${porCar.map(([c, n, g]) => `<div class="bar-row"><div class="lbl">${CARRERAS[c]}<span>${g} / ${n}</span></div><div class="bar split"><i style="width:${pct(g, alumnos.length)}%"></i><u style="width:${pct(n - g, alumnos.length)}%"></u></div></div>`).join('')}
      <div class="legend" style="margin:12px 0 0"><span><i class="sw a"></i>Con asesor</span><span><i class="sw b"></i>Sin asesor</span></div>
    </section>
    <section class="card"><div class="card-h"><h2>Carga de asesores</h2><a href="#/app/asesores">Ver todos ${ic('chevR', 14)}</a></div>
      <div class="rows">${top.map(([t, n]) => `<div class="r"><span class="avatar">${ini(t.nombre)}</span><div class="grow"><b>${esc(t.nombre)}</b><span class="muted">${esc(t.area)}</span></div><div class="end"><div class="bar ${n >= t.capacidad ? 'full' : ''}" style="width:70px"><i style="width:${pct(n, t.capacidad)}%"></i></div><span class="mono">${n}/${t.capacidad}</span></div></div>`).join('')}</div>
    </section>
  </div>
  <div class="cols">
    <section class="card"><div class="card-h"><h2>Actividad reciente</h2></div>
      <div class="rows">${S.actividad.slice(0, 7).map((a) => `<div class="r"><span class="avatar">${ini(a.usuario)}</span><div class="grow"><b style="white-space:normal">${esc(a.accion)}</b><span class="muted">${esc(a.usuario)} · ${hace(a.fecha)}</span></div></div>`).join('')}</div>
    </section>
    <section class="dark-card"><div class="lbl">PERIODO ACTIVO</div><div style="font-size:1.35rem;font-weight:800">${esc(p.nombre)}</div>
      <div class="bar"><i style="width:${pct(sem.actual, sem.total)}%"></i></div>
      <div class="foot"><span>Inicio ${fmt(p.inicio)}</span><span>Semana ${sem.actual}/${sem.total}</span><span>Fin ${fmt(p.fin)}</span></div>
      <dl class="dk"><div><dt>Alumnos</dt><dd>${alumnos.length}</dd></div><div><dt>Con asesor</dt><dd>${pct(alumnos.filter((a) => asgDe(a)).length, alumnos.length)}%</dd></div><div><dt>Expedientes completos</dt><dd>${alumnos.filter((a) => aprob(a) === DOCS.length).length}</dd></div></dl>
      ${can('periodos.ver') ? '<a class="btn sm out" href="#/app/periodos" style="justify-self:start">Ver periodos</a>' : ''}
    </section>
  </div></div>`;
}

/* =====================================================================
   VISTA: Alumnos (registro, consulta, edición, filtros, selección)
   ===================================================================== */
function filtrarAlumnos() {
  const f = UI.al, q = f.q.toLowerCase().trim(), pid = f.periodo || activo().id;
  let l = S.alumnos.filter((a) => (pid === 'todos' || a.periodo_id === pid)
    && (!q || (a.nombre + ' ' + a.matricula + ' ' + a.email + ' ' + a.proyecto).toLowerCase().includes(q))
    && (!f.carrera || a.carrera === f.carrera) && (!f.grupo || a.grupo === f.grupo) && (!f.estado || a.estado === f.estado)
    && (!f.empresa || (f.empresa === 'sin' ? !a.empresa_id : a.empresa_id === f.empresa)));
  if (f.asesor) l = l.filter((a) => { const g = asgDe(a); return f.asesor === 'sin' ? !g : f.asesor === 'con' ? !!g : g?.asesor_id === f.asesor; });
  if (f.exp) l = l.filter((a) => (f.exp === 'completo' ? aprob(a) === DOCS.length : f.exp === 'rechazado' ? Object.values(a.expediente).includes('rechazado') : aprob(a) < DOCS.length));
  const key = { nombre: (a) => a.nombre, matricula: (a) => a.matricula, carrera: (a) => a.carrera + a.grupo, empresa: (a) => em(a.empresa_id)?.nombre || '~', asesor: (a) => asesorDe(a)?.nombre || '~', exp: (a) => aprob(a) }[f.sort];
  return l.sort((a, b) => { const x = key(a), y = key(b); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * f.dir; });
}
function asesorOptions(sel, carrera, pid = activo().id, vacio = 'Sin asesor') {
  const opt = (t) => { const libres = t.capacidad - carga(t.id, pid); const dis = (!t.activo || libres <= 0) && t.id !== sel; return `<option value="${t.id}" ${t.id === sel ? 'selected' : ''} ${dis ? 'disabled' : ''}>${esc(t.nombre)} · ${t.activo ? (libres > 0 ? plural(libres, 'lugar', 'lugares') : 'sin lugares') : 'inactivo'}</option>`; };
  const misma = S.asesores.filter((t) => t.carrera === carrera), otras = S.asesores.filter((t) => t.carrera !== carrera);
  return `<option value="">${vacio}</option>${carrera ? `<optgroup label="Asesores de ${CARRERAS[carrera] || 'la carrera'}">${misma.map(opt).join('')}</optgroup><optgroup label="Otras carreras">${otras.map(opt).join('')}</optgroup>` : S.asesores.map(opt).join('')}`;
}
const th = (k, n) => `<button class="sort ${UI.al.sort === k ? 'on' : ''}" data-act="sort" data-k="${k}">${n}${UI.al.sort === k ? ic(UI.al.dir > 0 ? 'chevD' : 'chevU', 13) : ''}</button>`;

function vAlumnos() {
  const f = UI.al, l = filtrarAlumnos(), per_ = 15, pages = Math.max(1, Math.ceil(l.length / per_));
  f.page = Math.min(f.page, pages);
  const slice = l.slice((f.page - 1) * per_, f.page * per_);
  const todosPag = slice.length && slice.every((a) => f.sel.has(a.id));
  const nombres = { carrera: (v) => CARRERAS[v], grupo: (v) => 'Grupo ' + v, estado: (v) => EST_AL[v][0], asesor: (v) => (v === 'sin' ? 'Sin asesor' : v === 'con' ? 'Con asesor' : as(v)?.nombre), empresa: (v) => (v === 'sin' ? 'Sin empresa' : em(v)?.nombre), exp: (v) => ({ completo: 'Expediente completo', incompleto: 'Expediente incompleto', rechazado: 'Con documentos rechazados' }[v]), periodo: (v) => (v === 'todos' ? 'Todos los periodos' : per(v)?.nombre) };
  const activosF = Object.keys(nombres).filter((k) => f[k] && !(k === 'periodo' && f[k] === activo().id));
  const grupos = [...new Set(S.alumnos.map((a) => a.grupo))].sort();
  const editar = can('alumnos.editar'), asignar = can('asignaciones.editar');
  return `<div class="page-h"><div><h1>Alumnos</h1><p class="sub">${plural(l.length, 'resultado')} · ${esc(f.periodo === 'todos' ? 'Todos los periodos' : per(f.periodo || activo().id).nombre)}</p></div>
    <div class="row-actions"><button class="btn sm out" data-act="csv">${ic('download', 16)}Exportar CSV</button>${editar ? `<button class="btn sm" data-act="alForm">${ic('plus', 16)}Registrar alumno</button>` : ''}</div></div>
  ${help('Busca por nombre, matrícula, correo o proyecto, y combina filtros. Selecciona varios alumnos para asignarles un asesor a la vez o exportarlos.')}
  <div class="toolbar">
    <div class="search">${ic('search', 16)}<input type="search" id="q-al" placeholder="Buscar alumno" value="${esc(f.q)}" aria-label="Buscar alumno"></div>
    <button class="btn sm out ${f.filtros ? 'pressed' : ''}" data-act="toggleFiltros" aria-expanded="${f.filtros}">${ic('filter', 15)}Filtros${activosF.length ? ` · ${activosF.length}` : ''}</button>
  </div>
  ${f.filtros ? `<div class="filters card">
    <label class="field">Periodo<select data-f="al.periodo"><option value="${activo().id}">${esc(activo().nombre)} (activo)</option>${S.periodos.filter((p) => p.estado !== 'activo').map((p) => `<option value="${p.id}" ${f.periodo === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}<option value="todos" ${f.periodo === 'todos' ? 'selected' : ''}>Todos los periodos</option></select></label>
    <label class="field">Carrera<select data-f="al.carrera"><option value="">Todas</option>${Object.entries(CARRERAS).map(([k, v]) => `<option value="${k}" ${f.carrera === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="field">Grupo<select data-f="al.grupo"><option value="">Todos</option>${grupos.map((g) => `<option ${f.grupo === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
    <label class="field">Estado<select data-f="al.estado"><option value="">Todos</option>${Object.entries(EST_AL).map(([k, v]) => `<option value="${k}" ${f.estado === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
    <label class="field">Asesor<select data-f="al.asesor"><option value="">Todos</option><option value="sin" ${f.asesor === 'sin' ? 'selected' : ''}>Sin asesor</option><option value="con" ${f.asesor === 'con' ? 'selected' : ''}>Con asesor</option>${S.asesores.map((t) => `<option value="${t.id}" ${f.asesor === t.id ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select></label>
    <label class="field">Empresa<select data-f="al.empresa"><option value="">Todas</option><option value="sin" ${f.empresa === 'sin' ? 'selected' : ''}>Sin empresa</option>${[...S.empresas].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((e) => `<option value="${e.id}" ${f.empresa === e.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></label>
    <label class="field">Expediente<select data-f="al.exp"><option value="">Todos</option><option value="completo" ${f.exp === 'completo' ? 'selected' : ''}>Completo</option><option value="incompleto" ${f.exp === 'incompleto' ? 'selected' : ''}>Incompleto</option><option value="rechazado" ${f.exp === 'rechazado' ? 'selected' : ''}>Con rechazos</option></select></label>
  </div>` : ''}
  ${activosF.length ? `<div class="fchips">${activosF.map((k) => `<button class="chip fchip" data-act="quitarFiltro" data-k="${k}">${esc(nombres[k](f[k]))}${ic('x', 12)}</button>`).join('')}<button class="linkbtn" data-act="limpiarFiltros">Limpiar filtros</button></div>` : ''}
  ${f.sel.size ? `<div class="bulk"><b>${plural(f.sel.size, 'seleccionado')}</b>
    ${asignar ? `<select id="bulkAsesor" aria-label="Asesor para los seleccionados">${asesorOptions('', carreraComun(f.sel), activo().id, 'Elige un asesor')}</select><button class="btn sm" data-act="bulkAsignar">Asignar asesor</button>` : ''}
    <button class="btn sm out" data-act="csv" data-sel="1">${ic('download', 15)}Exportar</button><button class="linkbtn" data-act="limpiarSel">Quitar selección</button></div>` : ''}
  <div class="table" style="--cols:2.3fr 1.5fr 1.6fr 1.15fr .8fr 34px">
    <div class="trow head"><span class="who"><input type="checkbox" class="ck" data-act="selPagina" ${todosPag ? 'checked' : ''} aria-label="Seleccionar página">${th('nombre', 'Alumno')}</span><span>${th('empresa', 'Empresa')}</span><span>${th('asesor', 'Asesor')}</span><span>${th('exp', 'Expediente')}</span><span>Estado</span><span></span></div>
    ${slice.map((a) => { const t = asesorDe(a), e = em(a.empresa_id); return `<div class="trow click ${f.sel.has(a.id) ? 'sel' : ''}" data-act="alDetalle" data-id="${a.id}" tabindex="0">
      <div class="who"><input type="checkbox" class="ck" data-act="sel" data-id="${a.id}" ${f.sel.has(a.id) ? 'checked' : ''} aria-label="Seleccionar ${esc(a.nombre)}"><span class="avatar">${ini(a.nombre)}</span><div style="min-width:0"><b>${esc(a.nombre)}</b><span class="mono">${a.matricula} · ${a.carrera} ${a.grupo}</span></div></div>
      <div><span class="cell-l">Empresa</span>${e ? esc(e.nombre) : '<span class="muted">Sin empresa</span>'}</div>
      <div><span class="cell-l">Asesor</span>${t ? esc(t.nombre) : '<span class="chip warn">Sin asesor</span>'}</div>
      <div><span class="cell-l">Expediente</span><div style="display:flex;gap:8px;align-items:center">${dots(a)}<span class="mono">${aprob(a)}/${DOCS.length}</span></div></div>
      <div><span class="cell-l">Estado</span>${chip(EST_AL[a.estado])}</div>
      <div>${editar ? `<button class="ibtn" data-act="alForm" data-id="${a.id}" aria-label="Editar ${esc(a.nombre)}">${ic('edit', 15)}</button>` : ''}</div>
    </div>`; }).join('') || '<div class="empty">Ningún alumno coincide con la búsqueda o los filtros.<br><button class="linkbtn" data-act="limpiarFiltros">Limpiar filtros</button></div>'}
    ${pager(l.length, f.page, pages, 'al')}
  </div>
  <div class="legend" style="margin-top:12px"><span><i class="dots"><i class="aprobado"></i></i>Aprobado</span><span><i class="dots"><i class="cargado"></i></i>En revisión</span><span><i class="dots"><i class="rechazado"></i></i>Rechazado</span><span><i class="dots"><i></i></i>Pendiente</span><span class="mono">Aceptación · Seguro · Plan · Parcial · Liberación</span></div>`;
}
function carreraComun(sel) { const c = [...sel].map((id) => al(id)?.carrera); return c.length && c.every((x) => x === c[0]) ? c[0] : ''; }
function pager(total, page, pages, key) {
  if (pages <= 1) return `<div class="pager"><span>${plural(total, 'resultado')}</span></div>`;
  return `<div class="pager"><span>${plural(total, 'resultado')} · página ${page} de ${pages}</span><div style="display:flex;gap:6px"><button class="btn xs out" data-act="page" data-k="${key}" data-d="-1" ${page <= 1 ? 'disabled' : ''}>Anterior</button><button class="btn xs out" data-act="page" data-k="${key}" data-d="1" ${page >= pages ? 'disabled' : ''}>Siguiente</button></div></div>`;
}

/* =====================================================================
   VISTA: Asesores
   ===================================================================== */
function vAsesores() {
  const f = UI.as, q = f.q.toLowerCase();
  const l = S.asesores.filter((t) => (!q || (t.nombre + t.email).toLowerCase().includes(q)) && (!f.carrera || t.carrera === f.carrera) && (!f.estado || (f.estado === 'activo') === t.activo))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { ignorePunctuation: true }));
  const editar = can('asesores.editar');
  return `<div class="page-h"><div><h1>Asesores</h1><p class="sub">${plural(S.asesores.filter((t) => t.activo).length, 'asesor activo', 'asesores activos')} · carga del periodo ${esc(activo().nombre)}</p></div>
    ${editar ? `<button class="btn sm" data-act="asForm">${ic('plus', 16)}Registrar asesor</button>` : ''}</div>
  ${help('La capacidad es el máximo de alumnos que puede llevar un asesor por periodo. El sistema no permite rebasarla al asignar.')}
  <div class="toolbar">
    <div class="search">${ic('search', 16)}<input type="search" id="q-as" placeholder="Buscar asesor" value="${esc(f.q)}" aria-label="Buscar asesor"></div>
    <select data-f="as.carrera" aria-label="Carrera"><option value="">Todas las carreras</option>${Object.entries(CARRERAS).map(([k, v]) => `<option value="${k}" ${f.carrera === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <select data-f="as.estado" aria-label="Estado"><option value="">Activos e inactivos</option><option value="activo" ${f.estado === 'activo' ? 'selected' : ''}>Activos</option><option value="inactivo" ${f.estado === 'inactivo' ? 'selected' : ''}>Inactivos</option></select>
  </div>
  <div class="table" style="--cols:2.2fr 1.6fr 1.3fr .8fr 34px">
    <div class="trow head"><span>Asesor</span><span>Carrera / área</span><span>Carga del periodo</span><span>Estado</span><span></span></div>
    ${l.map((t) => { const n = carga(t.id); return `<div class="trow click" data-act="asDetalle" data-id="${t.id}" tabindex="0">
      <div class="who"><span class="avatar">${ini(t.nombre)}</span><div style="min-width:0"><b>${esc(t.nombre)}</b><span class="mono">${esc(t.email)}</span></div></div>
      <div><span class="cell-l">Área</span>${esc(t.area)}<div class="mono">${t.carrera}</div></div>
      <div><span class="cell-l">Carga</span><div style="display:flex;gap:8px;align-items:center"><div class="bar ${n >= t.capacidad ? 'full' : ''}" style="width:80px"><i style="width:${pct(n, t.capacidad)}%"></i></div><span class="mono">${n}/${t.capacidad}</span></div></div>
      <div><span class="cell-l">Estado</span>${t.activo ? chip(['Activo', 'ok']) : chip(['Inactivo', ''])}</div>
      <div>${editar ? `<button class="ibtn" data-act="asForm" data-id="${t.id}" aria-label="Editar ${esc(t.nombre)}">${ic('edit', 15)}</button>` : ''}</div></div>`; }).join('') || '<div class="empty">Ningún asesor coincide con la búsqueda.</div>'}
  </div>`;
}

/* =====================================================================
   VISTA: Asignaciones (individual, masiva y automática)
   ===================================================================== */
function vAsignaciones() {
  const f = UI.ag, p = activo(), editar = can('asignaciones.editar');
  const q = f.q.toLowerCase();
  const pend = sinAsesor().filter((a) => (!f.carrera || a.carrera === f.carrera) && (!q || (a.nombre + a.matricula).toLowerCase().includes(q))).sort((a, b) => a.nombre.localeCompare(b.nombre));
  [...f.sel].forEach((id) => { if (!sinAsesor().some((a) => a.id === id)) f.sel.delete(id); });
  const activos = S.asesores.filter((t) => t.activo && (!f.carrera || t.carrera === f.carrera)).sort((a, b) => carga(a.id) / a.capacidad - carga(b.id) / b.capacidad);
  const libres = S.asesores.filter((t) => t.activo).reduce((s, t) => s + Math.max(0, t.capacidad - carga(t.id)), 0);
  const lq = f.lq.toLowerCase();
  const lista = S.asignaciones_asesor.filter((g) => g.periodo_id === p.id).map((g) => ({ g, a: al(g.alumno_id), t: as(g.asesor_id) }))
    .filter((x) => x.a && x.t && (!lq || (x.a.nombre + x.a.matricula + x.t.nombre).toLowerCase().includes(lq)) && (!f.carrera || x.a.carrera === f.carrera))
    .sort((x, y) => (y.g.fecha || '').localeCompare(x.g.fecha || '') || x.a.nombre.localeCompare(y.a.nombre));
  const pages = Math.max(1, Math.ceil(lista.length / 12)); f.page = Math.min(f.page, pages);
  const todos = pend.length && pend.every((a) => f.sel.has(a.id));
  return `<div class="page-h"><div><h1>Asignaciones</h1><p class="sub">Periodo ${esc(p.nombre)} · ${plural(sinAsesor().length, 'alumno')} sin asesor · ${plural(libres, 'lugar disponible', 'lugares disponibles')}</p></div>
    <select data-f="ag.carrera" aria-label="Filtrar por carrera"><option value="">Todas las carreras</option>${Object.entries(CARRERAS).map(([k, v]) => `<option value="${k}" ${f.carrera === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
  ${help('Asigna asesores uno por uno, a varios alumnos seleccionados a la vez (masiva) o de forma automática. Ninguna opción rebasa la capacidad del asesor.')}
  <div class="stack">
  ${editar ? `<section class="card auto"><div><h2>${ic('zap', 18)}Asignación automática</h2><p class="muted small">Asigna a cada alumno sin asesor el asesor de su misma carrera con menor carga en proporción a su capacidad.</p></div>
    <div class="row-actions"><select id="autoCarrera" aria-label="Carrera para la asignación automática"><option value="">Todas las carreras</option>${Object.entries(CARRERAS).map(([k, v]) => `<option value="${k}" ${f.carrera === k ? 'selected' : ''}>${v} (${sinAsesor().filter((a) => a.carrera === k).length})</option>`).join('')}</select>
    <button class="btn sm" data-act="auto" ${sinAsesor().length ? '' : 'disabled'}>Distribuir alumnos</button></div></section>` : ''}
  <div class="cols">
    <section class="card"><div class="card-h"><h2>Alumnos sin asesor</h2><span class="chip ${pend.length ? 'warn' : 'ok'}">${pend.length}</span></div>
      <div class="search" style="margin-bottom:10px">${ic('search', 16)}<input type="search" id="q-ag" placeholder="Buscar alumno sin asesor" value="${esc(f.q)}" aria-label="Buscar alumno sin asesor"></div>
      ${pend.length ? `<label class="ckall"><input type="checkbox" class="ck" data-act="agTodos" ${todos ? 'checked' : ''}>Seleccionar todos (${pend.length})</label>` : ''}
      <div class="rows scrollbox">${pend.map((a) => `<label class="r pick"><input type="checkbox" class="ck" data-act="agSel" data-id="${a.id}" ${f.sel.has(a.id) ? 'checked' : ''} ${editar ? '' : 'disabled'}><div class="grow"><b>${esc(a.nombre)}</b><span class="muted">${a.matricula} · ${carreraDe(a.carrera)} · ${esc(em(a.empresa_id)?.nombre || 'Sin empresa')}</span></div></label>`).join('') || '<p class="muted small" style="padding:10px 0">Todos los alumnos activos tienen asesor.</p>'}</div>
      ${editar && pend.length ? `<div class="assign-bar"><select id="agAsesor" aria-label="Asesor">${asesorOptions(f.asesor, carreraComun(f.sel) || f.carrera, p.id, 'Elige un asesor')}</select>
        <button class="btn sm" data-act="agAsignar" ${f.sel.size ? '' : 'disabled'}>Asignar ${f.sel.size ? plural(f.sel.size, 'alumno') : 'seleccionados'}</button></div>` : ''}
    </section>
    <section class="card"><div class="card-h"><h2>Carga de asesores</h2><span class="mono">menor carga primero</span></div>
      <div class="rows scrollbox">${activos.map((t) => { const n = carga(t.id), lib = t.capacidad - n; return `<div class="r"><span class="avatar">${ini(t.nombre)}</span><div class="grow"><b>${esc(t.nombre)}</b><span class="muted">${esc(t.area)}</span></div><div class="end"><div class="bar ${lib <= 0 ? 'full' : ''}" style="width:64px"><i style="width:${pct(n, t.capacidad)}%"></i></div><span class="chip ${lib > 0 ? 'ok' : 'bad'}">${lib > 0 ? plural(lib, 'libre', 'libres') : 'Lleno'}</span></div></div>`; }).join('') || '<p class="muted small">No hay asesores activos para esta carrera.</p>'}</div>
    </section>
  </div>
  <section class="card"><div class="card-h"><h2>Asignaciones del periodo</h2><span class="mono">${lista.length}</span></div>
    <div class="search" style="margin-bottom:10px;max-width:380px">${ic('search', 16)}<input type="search" id="q-agl" placeholder="Buscar por alumno o asesor" value="${esc(f.lq)}" aria-label="Buscar asignación"></div>
    <div class="table flat" style="--cols:2fr 2fr .9fr .9fr 70px">
      <div class="trow head"><span>Alumno</span><span>Asesor</span><span>Tipo</span><span>Fecha</span><span></span></div>
      ${lista.slice((f.page - 1) * 12, f.page * 12).map(({ g, a, t }) => `<div class="trow"><div class="who"><div style="min-width:0"><b>${esc(a.nombre)}</b><span class="mono">${a.matricula} · ${a.carrera}</span></div></div><div><span class="cell-l">Asesor</span>${esc(t.nombre)}</div><div><span class="cell-l">Tipo</span><span class="chip">${TIPO_ASG[g.tipo] || g.tipo}</span></div><div><span class="cell-l">Fecha</span><span class="mono">${fmt(g.fecha)}</span></div><div>${editar ? `<button class="btn xs out danger" data-act="quitarAsg" data-id="${g.id}">Quitar</button>` : ''}</div></div>`).join('') || '<div class="empty">No hay asignaciones con esos criterios.</div>'}
      ${pager(lista.length, f.page, pages, 'ag')}
    </div>
  </section></div>`;
}

/* =====================================================================
   VISTA: Periodos
   ===================================================================== */
function vPeriodos() {
  const editar = can('periodos.editar');
  return `<div class="page-h"><div><h1>Periodos</h1><p class="sub">Solo un periodo puede estar activo; el panel y las asignaciones trabajan sobre él.</p></div>
    ${editar ? `<button class="btn sm" data-act="peForm">${ic('plus', 16)}Crear periodo</button>` : ''}</div>
  ${help('Al activar un periodo, el que estaba activo se cierra y sus datos se conservan como historial. Un periodo con alumnos no se puede eliminar.')}
  <div class="pcards">${[...S.periodos].reverse().map((p) => {
    const l = alumnosPer(p.id).filter((a) => a.estado !== 'baja'), sem = semanas(p), con = l.filter((a) => asgDe(a)).length;
    return `<article class="pcard ${p.estado}"><div class="card-h" style="margin-bottom:6px"><div><h2>${esc(p.nombre)}</h2><span class="mono">Clave ${esc(p.clave)}</span></div>${chip(EST_PER[p.estado])}</div>
      <p class="muted small">${fmt(p.inicio)} al ${fmt(p.fin)} · ${sem.total} semanas</p>
      ${p.estado === 'activo' ? `<div class="bar-row" style="margin:12px 0 4px"><div class="lbl">Avance del periodo<span>Semana ${sem.actual} de ${sem.total}</span></div><div class="bar"><i style="width:${pct(sem.actual, sem.total)}%"></i></div></div>` : ''}
      <dl class="pstats"><div><dt>Alumnos</dt><dd>${l.length}</dd></div><div><dt>Con asesor</dt><dd>${pct(con, l.length)}%</dd></div><div><dt>Expedientes completos</dt><dd>${pct(l.filter((a) => aprob(a) === DOCS.length).length, l.length)}%</dd></div></dl>
      ${editar ? `<div class="row-actions"><button class="btn xs out" data-act="peForm" data-id="${p.id}">${ic('edit', 14)}Editar</button>
        ${p.estado !== 'activo' ? `<button class="btn xs" data-act="peEstado" data-id="${p.id}" data-e="activo">Activar</button>` : `<button class="btn xs out" data-act="peEstado" data-id="${p.id}" data-e="cerrado">Cerrar periodo</button>`}
        ${p.estado === 'cerrado' ? `<button class="btn xs out" data-act="peEstado" data-id="${p.id}" data-e="planeado">Reabrir</button>` : ''}
        ${p.estado !== 'activo' && !alumnosPer(p.id).length ? `<button class="btn xs out danger" data-act="peBorrar" data-id="${p.id}">${ic('trash', 14)}Eliminar</button>` : ''}</div>` : ''}
    </article>`; }).join('')}</div>`;
}

/* =====================================================================
   VISTA: Empresas y contactos
   ===================================================================== */
function vEmpresas() {
  const f = UI.em, q = f.q.toLowerCase(), orden = { vencido: 0, pronto: 1, tramite: 2, vigente: 3 };
  const l = S.empresas.filter((e) => (!q || (e.nombre + e.giro + e.ciudad + e.rfc + contactos(e.id).map((c) => c.nombre).join(' ')).toLowerCase().includes(q)) && (!f.conv || convEst(e)[2] === f.conv))
    .sort((a, b) => orden[convEst(a)[2]] - orden[convEst(b)[2]] || a.nombre.localeCompare(b.nombre));
  const editar = can('empresas.editar');
  return `<div class="page-h"><div><h1>Empresas</h1><p class="sub">${plural(S.empresas.length, 'empresa')} · ${plural(S.contactos_empresa.length, 'contacto')}</p></div>
    ${editar ? `<button class="btn sm" data-act="emForm">${ic('plus', 16)}Registrar empresa</button>` : ''}</div>
  ${help('Solo las empresas con convenio vigente deberían recibir alumnos. Abre una empresa para ver y administrar sus contactos.')}
  <div class="toolbar">
    <div class="search">${ic('search', 16)}<input type="search" id="q-em" placeholder="Buscar empresa, giro, ciudad o contacto" value="${esc(f.q)}" aria-label="Buscar empresa"></div>
    <select data-f="em.conv" aria-label="Convenio"><option value="">Todos los convenios</option>${[['vigente', 'Vigentes'], ['pronto', 'Vencen pronto'], ['vencido', 'Vencidos'], ['tramite', 'En trámite']].map(([k, v]) => `<option value="${k}" ${f.conv === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
  </div>
  <div class="table" style="--cols:2.2fr 1.8fr 1.3fr .7fr 90px">
    <div class="trow head"><span>Empresa</span><span>Contacto principal</span><span>Convenio</span><span>Alumnos</span><span></span></div>
    ${l.map((e) => { const c = convEst(e), pc = principal(e.id); return `<div class="trow click" data-act="emDetalle" data-id="${e.id}" tabindex="0">
      <div class="who"><span class="ic-box">${ic('building', 16)}</span><div style="min-width:0"><b>${esc(e.nombre)}</b><span class="muted small">${esc(e.giro)} · ${esc(e.ciudad)}</span></div></div>
      <div><span class="cell-l">Contacto</span>${pc ? `${esc(pc.nombre)}<div class="mono">${esc(pc.telefono || pc.email)}</div>` : '<span class="muted">Sin contacto</span>'}</div>
      <div><span class="cell-l">Convenio</span>${chip(c)}<div class="mono">${e.vence ? (c[2] === 'vencido' ? 'Venció ' : 'Hasta ') + fmt(e.vence) : 'Sin fecha'}</div></div>
      <div><span class="cell-l">Alumnos</span>${IDX.alEmp.get(e.id) || 0}</div>
      <div>${editar && ['vencido', 'pronto'].includes(c[2]) ? `<button class="btn xs" data-act="renovar" data-id="${e.id}">Renovar</button>` : ''}</div></div>`; }).join('') || '<div class="empty">Ninguna empresa coincide con la búsqueda.</div>'}
  </div>`;
}

/* =====================================================================
   VISTA: Expedientes (consulta del estado general)
   ===================================================================== */
function vExpedientes() {
  const f = UI.ex, q = f.q.toLowerCase(), base = alumnosPer().filter((a) => a.estado !== 'baja');
  const l = base.filter((a) => (!q || (a.nombre + a.matricula).toLowerCase().includes(q)) && (!f.carrera || a.carrera === f.carrera) && (!f.doc || !f.est || a.expediente[f.doc] === f.est) && (f.doc || !f.est || estExp(a)[0] === f.est))
    .sort((a, b) => aprob(a) - aprob(b) || a.nombre.localeCompare(b.nombre));
  const tot = { Completo: 0, 'En revisión': 0, 'Con rechazos': 0, 'En proceso': 0 };
  base.forEach((a) => tot[estExp(a)[0]]++);
  return `<div class="page-h"><div><h1>Expedientes</h1><p class="sub">Estado general · periodo ${esc(activo().nombre)}</p></div></div>
  ${help('Consulta de solo lectura. La carga y revisión de los documentos se hace en el Módulo 1 (Expediente digital); aquí la coordinación ve el avance de todos.')}
  <div class="stack">
  <div class="stats">${[['Completo', 'checkCircle'], ['En revisión', 'clock'], ['Con rechazos', 'alert'], ['En proceso', 'file']].map(([k, i]) => `<button class="stat link ${f.est === k && !f.doc ? 'on' : ''}" data-act="exEstado" data-e="${k}"><span class="ic-box">${ic(i, 16)}</span><b>${tot[k]}</b><span>${k}</span><span class="mono">${pct(tot[k], base.length)}% de ${base.length}</span></button>`).join('')}</div>
  <section class="card"><div class="card-h"><h2>Avance por documento</h2></div>
    <div class="docgrid">${DOCS.map(([k, n]) => { const c = (e) => base.filter((a) => a.expediente[k] === e).length; return `<div><b class="small">${n}</b><div class="stack-bar"><i class="aprobado" style="width:${pct(c('aprobado'), base.length)}%"></i><i class="cargado" style="width:${pct(c('cargado'), base.length)}%"></i><i class="rechazado" style="width:${pct(c('rechazado'), base.length)}%"></i></div><span class="mono">${c('aprobado')} aprobados · ${c('cargado')} en revisión · ${c('rechazado')} rechazados</span></div>`; }).join('')}</div>
  </section>
  <div class="toolbar" style="margin:0">
    <div class="search">${ic('search', 16)}<input type="search" id="q-ex" placeholder="Buscar alumno" value="${esc(f.q)}" aria-label="Buscar alumno"></div>
    <select data-f="ex.carrera" aria-label="Carrera"><option value="">Todas las carreras</option>${Object.entries(CARRERAS).map(([k, v]) => `<option value="${k}" ${f.carrera === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <select data-f="ex.doc" aria-label="Documento"><option value="">Cualquier documento</option>${DOCS.map(([k, n]) => `<option value="${k}" ${f.doc === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <select data-f="ex.est" aria-label="Estado"><option value="">Cualquier estado</option>${(f.doc ? Object.entries(EST_DOC).map(([k, v]) => [k, v[0]]) : Object.keys(tot).map((k) => [k, k])).map(([k, v]) => `<option value="${k}" ${f.est === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
  </div>
  <div class="table" style="--cols:2.2fr 1.7fr 1.2fr 1fr .9fr">
    <div class="trow head"><span>Alumno</span><span>Asesor</span><span>Documentos</span><span>Avance</span><span>Estado</span></div>
    ${l.slice(0, 60).map((a) => `<div class="trow click" data-act="alDetalle" data-id="${a.id}" tabindex="0"><div class="who"><span class="avatar">${ini(a.nombre)}</span><div style="min-width:0"><b>${esc(a.nombre)}</b><span class="mono">${a.matricula} · ${a.carrera}</span></div></div>
      <div><span class="cell-l">Asesor</span>${esc(asesorDe(a)?.nombre || 'Sin asesor')}</div><div><span class="cell-l">Documentos</span>${dots(a)}</div>
      <div><span class="cell-l">Avance</span><div style="display:flex;gap:8px;align-items:center"><div class="bar" style="width:60px"><i style="width:${pct(aprob(a), DOCS.length)}%"></i></div><span class="mono">${pct(aprob(a), DOCS.length)}%</span></div></div><div><span class="cell-l">Estado</span>${chip(estExp(a))}</div></div>`).join('') || '<div class="empty">Ningún expediente coincide con los filtros.</div>'}
    <div class="pager"><span>${plural(l.length, 'expediente')}${l.length > 60 ? ' · se muestran los primeros 60; usa los filtros para acotar' : ''}</span></div>
  </div></div>`;
}

/* =====================================================================
   VISTA: Usuarios y permisos
   ===================================================================== */
function vUsuarios() {
  const editar = can('usuarios.editar'), tab = UI.us.tab;
  const tabs = `<div class="tabs" role="tablist"><button role="tab" aria-selected="${tab === 'usuarios'}" data-act="tab" data-t="usuarios">Usuarios (${S.usuarios.length})</button><button role="tab" aria-selected="${tab === 'roles'}" data-act="tab" data-t="roles">Roles y permisos (${S.roles.length})</button></div>`;
  if (tab === 'roles') {
    const mods = [...new Set(PERMISOS.map((p) => p[1]))];
    return `<div class="page-h"><div><h1>Usuarios y permisos</h1><p class="sub">Qué puede hacer cada rol en el módulo</p></div></div>${tabs}
    ${help(editar ? 'Marca o desmarca un permiso y se guarda al momento. Editar incluye consultar. Los permisos del Administrador no se pueden cambiar.' : 'Consulta qué puede hacer cada rol. Solo el administrador puede modificar permisos.')}
    <div class="role-cards">${S.roles.map((r) => `<article class="card"><div class="card-h" style="margin-bottom:6px"><h2>${esc(r.nombre)}</h2><span class="chip">${plural(S.usuarios.filter((u) => u.rol_id === r.id).length, 'usuario')}</span></div><p class="muted small">${esc(r.descripcion)}</p><p class="mono" style="margin-top:8px">${r.permisos.length} de ${PERMISOS.length} permisos</p></article>`).join('')}</div>
    <div class="table matrix" style="--cols:1fr 1.6fr ${S.roles.map(() => '.75fr').join(' ')}">
      <div class="trow head"><span>Módulo</span><span>Permiso</span>${S.roles.map((r) => `<span class="c">${esc(r.nombre.split(' ')[0])}</span>`).join('')}</div>
      ${mods.map((m) => PERMISOS.filter((p) => p[1] === m).map(([k, , accion], i) => `<div class="trow"><span class="${i ? 'muted' : ''}"><b>${i ? '' : m}</b></span><span>${accion}<span class="mono" style="display:block">${k}</span></span>${S.roles.map((r) => `<span class="c"><input type="checkbox" class="ck" data-act="perm" data-r="${r.id}" data-p="${k}" ${r.permisos.includes(k) ? 'checked' : ''} ${!editar || r.sistema ? 'disabled' : ''} aria-label="${esc(r.nombre)}: ${accion} ${m}"></span>`).join('')}</div>`).join('')).join('')}
    </div>`;
  }
  return `<div class="page-h"><div><h1>Usuarios y permisos</h1><p class="sub">Personas con acceso al panel administrativo</p></div>
    ${editar ? `<button class="btn sm" data-act="usForm">${ic('plus', 16)}Agregar usuario</button>` : ''}</div>${tabs}
  ${help('Cada usuario tiene un rol que define sus permisos. Un usuario inactivo no puede iniciar sesión. Siempre debe quedar al menos un administrador activo.')}
  <div class="table" style="--cols:2.2fr 1.3fr .8fr 1fr 110px">
    <div class="trow head"><span>Usuario</span><span>Rol</span><span>Estado</span><span>Último acceso</span><span></span></div>
    ${S.usuarios.map((u) => `<div class="trow"><div class="who"><span class="avatar ${u.id === SESION.id ? 'dark' : ''}">${ini(u.nombre)}</span><div style="min-width:0"><b>${esc(u.nombre)}${u.id === SESION.id ? ' <span class="muted small">(tú)</span>' : ''}</b><span class="mono">${esc(u.email)}</span></div></div>
      <div><span class="cell-l">Rol</span><span class="chip ${u.rol_id === 'admin' ? 'solid' : ''}">${esc(S.roles.find((r) => r.id === u.rol_id)?.nombre || u.rol_id)}</span></div>
      <div><span class="cell-l">Estado</span>${u.activo ? chip(['Activo', 'ok']) : chip(['Inactivo', ''])}</div>
      <div><span class="cell-l">Último acceso</span><span class="mono">${u.ultimo_acceso ? hace(u.ultimo_acceso) : 'Nunca'}</span></div>
      <div class="row-actions" style="justify-content:flex-end">${editar ? `<button class="ibtn" data-act="usForm" data-id="${u.id}" aria-label="Editar ${esc(u.nombre)}">${ic('edit', 15)}</button><button class="ibtn" data-act="usPass" data-id="${u.id}" aria-label="Restablecer contraseña de ${esc(u.nombre)}">${ic('key', 15)}</button>${u.id !== SESION.id ? `<button class="ibtn danger" data-act="usBorrar" data-id="${u.id}" aria-label="Eliminar ${esc(u.nombre)}">${ic('trash', 15)}</button>` : ''}` : ''}</div></div>`).join('')}
  </div>`;
}

/* =====================================================================
   VISTA: Mi perfil
   ===================================================================== */
function vPerfil() {
  const rol = S.roles.find((r) => r.id === SESION.rol_id);
  return `<div class="page-h"><div><h1>Mi perfil</h1></div></div>
  <div class="cols">
    <section class="card"><div style="display:flex;gap:14px;align-items:center;margin-bottom:16px"><span class="avatar dark" style="width:52px;height:52px;font-size:1rem">${ini(SESION.nombre)}</span><div><b style="font-size:1.05rem">${esc(SESION.nombre)}</b><div class="muted small">${esc(rol?.nombre || '')}</div></div></div>
      <dl class="kv"><dt>Correo</dt><dd>${esc(SESION.email)}</dd><dt>Rol</dt><dd>${esc(rol?.nombre || '')}</dd><dt>Permisos</dt><dd>${PERMS.length} de ${PERMISOS.length}</dd><dt>Periodo activo</dt><dd>${esc(activo().nombre)}</dd></dl></section>
    <form class="card stack" data-form="miPass" style="gap:12px"><h2 style="font-size:.98rem">Cambiar contraseña</h2>
      <label class="field">Contraseña actual<input type="password" name="actual" required autocomplete="current-password"></label>
      <label class="field">Nueva contraseña <span class="hint">Mínimo 8 caracteres</span><input type="password" name="nueva" minlength="8" required autocomplete="new-password"></label>
      <button class="btn sm" type="submit" style="justify-self:start">Guardar contraseña</button></form>
  </div>`;
}

/* =====================================================================
   VISTA: Caché sin conexión (métodos de la API Cache desde la página)
   ===================================================================== */
const CACHE_NOMBRES = { shell: 'sigep-m2-shell-v7', dinamica: 'sigep-m2-dinamica-v1', datos: M2.CACHE_DATOS };
const CACHE_INFO = {
  'sigep-m2-shell-v7': ['App Shell', 'Cache First', 'Archivos base del panel: HTML, CSS, JavaScript, manifiesto e íconos. Se guardan al instalar el Service Worker.'],
  'sigep-m2-dinamica-v1': ['Recursos dinámicos', 'Stale-While-Revalidate', 'Imágenes, video y tipografías. Responde con la copia guardada y la actualiza en segundo plano. Máximo 40 archivos.'],
  'sigep-m2-datos-v1': ['Datos del panel', 'Network First', 'Última copia de los datos leídos de Supabase (datos/estado.json) para consultar el panel sin conexión. Se borra al cerrar sesión.']
};
const RECURSOS_OFFLINE = ['./img/dashboard.jpg', './img/alumnos-filtros.jpg', './img/asignaciones.jpg', './img/permisos.jpg', './img/panel-movil.jpg', './media/recorrido-modulo2.mp4'];
const fechaHora = (iso) => new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(/\./g, '');
const tam = (b) => (b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB');
const ruta = (u) => { try { const x = new URL(u, location.href); return x.origin === location.origin ? x.pathname + x.search : x.host + x.pathname; } catch (e) { return u; } };

// Ejecuta un método de la API Cache, mide cuánto tarda y lo anota en el registro
async function op(metodo, fn) {
  const t = performance.now();
  const anotar = (ok, res) => { UI.ca.log.unshift({ metodo, ok, res, ms: Math.max(0, Math.round(performance.now() - t)), hora: new Date().toLocaleTimeString('es-MX') }); UI.ca.log.length = Math.min(UI.ca.log.length, 40); };
  try { const r = await fn(); anotar(true, describir(r)); return r; }
  catch (e) { anotar(false, e.message); throw e; }
}
function describir(r) {
  if (r === undefined) return 'undefined (correcto)';
  if (typeof r === 'boolean') return String(r);
  if (Array.isArray(r)) return `${r.length} elemento${r.length === 1 ? '' : 's'}`;
  if (r instanceof Response) return `Response ${r.status || '(opaca)'} ${r.headers.get('content-type') || ''}`;
  if (typeof Cache !== 'undefined' && r instanceof Cache) return 'objeto Cache';
  return String(r);
}
async function leerFechaDatos() {
  try { const r = await caches.match(M2.URL_DATOS); UI.ca.fechaDatos = r ? r.headers.get('sw-fecha') : null; } catch (e) {}
}
function versionSW() {
  return new Promise((ok) => {
    const sw = navigator.serviceWorker?.controller;
    if (!sw) return ok(null);
    const canal = new MessageChannel();
    canal.port1.onmessage = (e) => ok(e.data);
    sw.postMessage({ tipo: 'version' }, [canal.port2]);
    setTimeout(() => ok(null), 800);
  });
}

function vCache() {
  return `<div class="page-h"><div><h1>Caché sin conexión</h1><p class="sub">Cache Storage de este dispositivo</p></div>${chip(navigator.onLine ? ['En línea', 'ok'] : ['Sin conexión', 'warn'])}</div>
  ${help('El Service Worker guarda la app y los datos en tres cachés, cada una con su estrategia. Aquí puedes ver qué hay guardado y probar los métodos de la API Cache; cada llamada queda en el registro de operaciones.')}
  <div id="cache-zona"><p class="muted">Leyendo la caché…</p></div>`;
}

// Lee todas las cachés con caches.keys(), cache.keys() y cache.matchAll() y dibuja la vista
async function cargarCache() {
  const zona = $('#cache-zona'); if (!zona) return;
  if (!('caches' in window)) {
    zona.innerHTML = '<div class="note warn">La API Cache solo está disponible en sitios seguros: abre el panel desde <b>http://localhost</b> o una dirección <b>https</b>.</div>';
    return;
  }
  try {
    const nombres = await caches.keys();
    const lista = [];
    for (const n of nombres) {
      const cache = await caches.open(n);
      const [llaves, resps] = await Promise.all([cache.keys(), cache.matchAll()]);   // mismas posiciones: petición ↔ respuesta
      const filas = [];
      for (let i = 0; i < llaves.length; i++) {
        const r = resps[i];
        const bytes = r.type === 'opaque' ? 0 : Number(r.headers.get('content-length')) || (await r.clone().blob()).size;
        filas.push({ url: llaves[i].url, tipo: (r.headers.get('content-type') || (r.type === 'opaque' ? 'opaca (otro dominio)' : '—')).split(';')[0], bytes, fecha: r.headers.get('sw-fecha') || r.headers.get('date') });
      }
      lista.push({ n, filas, bytes: filas.reduce((s, f) => s + f.bytes, 0) });
    }
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const sw = await versionSW();
    await leerFechaDatos();
    if (!$('#cache-zona')) return;
    const total = lista.reduce((s, c) => s + c.filas.length, 0);
    const res = UI.ca.resultado;
    $('#cache-zona').innerHTML = `
    <div class="stats">
      <div class="stat"><span class="ic-box">${ic('database', 16)}</span><b>${lista.length}</b><span>Cachés en este dispositivo</span><span class="mono">caches.keys()</span></div>
      <div class="stat"><span class="ic-box">${ic('file', 16)}</span><b>${total}</b><span>Archivos guardados</span><span class="mono">${tam(lista.reduce((s, c) => s + c.bytes, 0))}</span></div>
      <div class="stat"><span class="ic-box">${ic('layers', 16)}</span><b>${est ? tam(est.usage) : '—'}</b><span>Espacio usado por el sitio</span><span class="mono">${est ? 'de ' + tam(est.quota) + ' disponibles' : 'storage.estimate() no disponible'}</span></div>
      <div class="stat"><span class="ic-box ${sw ? '' : 'warn'}">${ic('zap', 16)}</span><b>${sw ? 'Activo' : 'Inactivo'}</b><span>Service Worker</span><span class="mono">${sw ? 'versión ' + sw.version : 'Recarga la página para activarlo'}</span></div>
    </div>
    <div class="cache-grid">
      <section class="card"><div class="card-h"><h2>Cachés de la aplicación</h2><button class="linkbtn" data-act="caVer" data-n="__refrescar">Actualizar</button></div>
        <div class="stack" style="gap:12px">${lista.length ? lista.map((c) => { const [t, est_, d] = CACHE_INFO[c.n] || ['Otra caché', '—', 'Caché que no pertenece a la versión actual.']; const abierto = UI.ca.abiertos.has(c.n); return `
          <article class="cache-item">
            <div class="card-h" style="margin:0"><div><b>${t}</b> <span class="chip info">${est_}</span><div class="mono">${esc(c.n)}</div></div><span class="mono">${plural(c.filas.length, 'archivo')} · ${tam(c.bytes)}</span></div>
            <p class="muted small">${d}</p>
            <div class="row-actions"><button class="btn xs out" data-act="caVer" data-n="${esc(c.n)}">${abierto ? 'Ocultar contenido' : 'Ver contenido'}</button><button class="btn xs out danger" data-act="caVaciar" data-n="${esc(c.n)}">${ic('trash', 13)}Eliminar caché</button></div>
            ${abierto ? `<div class="table flat cache-tabla" style="--cols:2.4fr 1.2fr .8fr 1fr 34px"><div class="trow head"><span>Archivo</span><span>Tipo</span><span>Tamaño</span><span>Guardado</span><span></span></div>
              ${c.filas.map((f) => `<div class="trow"><span class="mono url" title="${esc(f.url)}">${esc(ruta(f.url))}</span><span class="small">${esc(f.tipo)}</span><span class="mono">${f.bytes ? tam(f.bytes) : '—'}</span><span class="mono">${f.fecha ? fechaHora(f.fecha) : '—'}</span><span><button class="ibtn danger" data-act="caBorrarEntrada" data-n="${esc(c.n)}" data-u="${esc(f.url)}" aria-label="Eliminar ${esc(ruta(f.url))} de la caché">${ic('x', 14)}</button></span></div>`).join('') || '<div class="empty">Caché vacía.</div>'}</div>` : ''}
          </article>`; }).join('') : '<p class="muted small">No hay cachés guardadas. Recarga la página con conexión para que el Service Worker las cree.</p>'}</div>
      </section>
      <div class="stack" style="gap:16px">
        <section class="card"><div class="card-h"><h2>Probar métodos</h2></div>
          <form class="stack" data-form="caBuscar" style="gap:8px"><label class="field">Buscar una dirección en la caché <span class="hint">caches.match()</span>
            <div class="row-actions"><input type="text" name="url" value="${esc(UI.ca.url)}" placeholder="/img/dashboard.jpg" style="flex:1;min-width:160px"><button class="btn sm" type="submit">${ic('search', 14)}Buscar</button></div></label></form>
          ${res ? `<div class="note ${res.no ? 'warn' : 'ok'} small found">${res.no ? `<b>${esc(res.url)}</b> no está en ninguna caché. Sin conexión no se podría cargar.` : `<b>${esc(res.url)}</b> está en <span class="mono">${esc(res.en)}</span><br>Estado ${res.status} · ${esc(res.tipo)} · ${res.bytes ? tam(res.bytes) : '—'}${res.fecha ? ' · guardado ' + fechaHora(res.fecha) : ''}`}</div>` : ''}
          <div class="metodos">
            <button class="metodo" data-act="caDescargar"><b>Guardar imágenes y video para uso sin conexión</b><span class="mono">caches.open() + cache.addAll()</span></button>
            <button class="metodo" data-act="caActualizar"><b>Actualizar ahora los datos guardados</b><span class="mono">fetch() + cache.put()</span></button>
            <button class="metodo" data-act="caExiste"><b>Comprobar si existe la caché de datos</b><span class="mono">caches.has()</span></button>
          </div>
          ${UI.ca.fechaDatos ? `<p class="mono" style="margin-top:10px">Datos del panel guardados: ${fechaHora(UI.ca.fechaDatos)}</p>` : ''}
        </section>
        <section class="card"><div class="card-h"><h2>Registro de operaciones</h2>${UI.ca.log.length ? '<button class="linkbtn" data-act="caLimpiarLog">Limpiar</button>' : ''}</div>
          <ol class="oplog">${UI.ca.log.map((l) => `<li class="${l.ok ? '' : 'err'}"><code>${esc(l.metodo)}</code><span>→ ${esc(l.res)}</span><em>${l.hora} · ${l.ms} ms</em></li>`).join('') || '<li class="muted small">Aún no hay operaciones. Usa los botones de “Probar métodos” o los de cada caché.</li>'}</ol>
        </section>
      </div>
    </div>`;
  } catch (e) {
    if ($('#cache-zona')) $('#cache-zona').innerHTML = `<div class="note">No se pudo leer la caché: ${esc(e.message)}</div>`;
  }
}

async function cacheBuscar(url) {
  if (!url) return;
  try {
    const r = await op(`caches.match('${url}')`, () => caches.match(url, { ignoreSearch: true }));
    if (!r) { UI.ca.resultado = { url, no: true }; }
    else {
      let en = '—';
      for (const n of await caches.keys()) { if (await (await caches.open(n)).match(url, { ignoreSearch: true })) { en = n; break; } }
      UI.ca.resultado = { url, en, status: r.status || 'opaca', tipo: (r.headers.get('content-type') || '—').split(';')[0], bytes: r.type === 'opaque' ? 0 : (await r.blob()).size, fecha: r.headers.get('sw-fecha') };
    }
  } catch (e) { toast(e.message); }
  cargarCache();
}
async function cacheBorrarEntrada(nombre, url) {
  try {
    const cache = await op(`caches.open('${nombre}')`, () => caches.open(nombre));
    const ok = await op(`cache.delete('${ruta(url)}')`, () => cache.delete(url));
    toast(ok ? `${ruta(url)} se eliminó de la caché` : 'Ese archivo ya no estaba en la caché');
  } catch (e) { toast(e.message); }
  cargarCache();
}
async function cacheVaciar(nombre) {
  try {
    const ok = await op(`caches.delete('${nombre}')`, () => caches.delete(nombre));
    UI.ca.abiertos.delete(nombre);
    if (nombre === CACHE_NOMBRES.datos) UI.ca.fechaDatos = null;
    toast(ok ? `Caché ${nombre} eliminada` : 'La caché ya no existía');
  } catch (e) { toast(e.message); }
  cargarCache();
}
async function cacheDescargar() {
  toast('Guardando imágenes y video…');
  try {
    const cache = await op(`caches.open('${CACHE_NOMBRES.dinamica}')`, () => caches.open(CACHE_NOMBRES.dinamica));
    await op(`cache.addAll([${RECURSOS_OFFLINE.length} recursos])`, () => cache.addAll(RECURSOS_OFFLINE));
    UI.ca.abiertos.add(CACHE_NOMBRES.dinamica);
    toast(`${RECURSOS_OFFLINE.length} recursos guardados: ya se pueden ver sin conexión`);
  } catch (e) { toast('No se pudieron guardar: ' + e.message); }
  cargarCache();
}
async function cacheActualizarDatos() {
  try {
    const r = await op('Supabase: leer los datos del panel', () => M2.pedir('GET', '/estado'));
    if (r.sinConexion) throw new Error('Sin conexión: no se pueden descargar datos nuevos');
    const cache = await op(`caches.open('${CACHE_NOMBRES.datos}')`, () => caches.open(CACHE_NOMBRES.datos));
    const copia = new Response(JSON.stringify(r), { headers: { 'Content-Type': 'application/json', 'sw-fecha': new Date().toISOString() } });
    await op("cache.put('datos/estado.json', respuesta)", () => cache.put(M2.URL_DATOS, copia));
    setEstado(r);
    toast('Datos actualizados y guardados en la caché');
  } catch (e) { toast(navigator.onLine ? e.message : 'Sin conexión: no se pueden descargar datos nuevos'); }
  await leerFechaDatos();
  rerender();
}
async function cacheExiste() {
  try {
    const existe = await op(`caches.has('${CACHE_NOMBRES.datos}')`, () => caches.has(CACHE_NOMBRES.datos));
    toast(existe ? 'Sí: la caché de datos existe en este dispositivo' : 'No existe la caché de datos (se crea al consultar el panel con conexión)');
  } catch (e) { toast(e.message); }
  cargarCache();
}

/* =====================================================================
   VENTANAS (formularios y detalles)
   ===================================================================== */
function modal(html, ancho) {
  closeModal();
  const d = document.createElement('div');
  d.className = 'modal-bg'; d.id = 'mbg';
  d.innerHTML = `<div class="modal" role="dialog" aria-modal="true" ${ancho ? `style="width:min(${ancho}px,100%)"` : ''}>${html}</div>`;
  document.body.appendChild(d);
  (d.querySelector('input:not([type=hidden]),select,textarea') || d.querySelector('button'))?.focus();
}
function closeModal() { $('#mbg')?.remove(); }
const mHead = (t, sub) => `<div class="modal-h"><div><h2>${t}</h2>${sub ? `<p class="mono" style="margin-top:4px">${sub}</p>` : ''}</div><button type="button" data-act="closeModal" aria-label="Cerrar">${ic('x')}</button></div>`;
let CONFIRMAR = null;
function confirmar(titulo, texto, boton, fn) {
  CONFIRMAR = fn;
  modal(`${mHead(titulo)}<p class="muted">${texto}</p><div class="modal-f"><button class="btn out" data-act="closeModal">Cancelar</button><button class="btn danger-fill" data-act="confirmarOk">${boton}</button></div>`, 460);
}
const opts = (obj, sel) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${Array.isArray(v) ? v[0] : v}</option>`).join('');

function alForm(id) {
  const a = id ? al(id) : { matricula: '', nombre: '', email: '', nivel: 'Ingeniería', telefono: '', carrera: 'ISC', grupo: 'A', periodo_id: activo().id, empresa_id: '', proyecto: '', estado: 'activo' };
  const t = id ? asesorDe(a) : null;
  modal(`${mHead(id ? 'Editar alumno' : 'Registrar alumno', id ? a.matricula : '')}
  <form class="stack" data-form="alumno" data-id="${id || ''}" style="gap:12px" novalidate>
    <div class="form-grid">
      <label class="field">Matrícula <span class="hint">10 dígitos</span><input name="matricula" value="${esc(a.matricula)}" required maxlength="10" inputmode="numeric" placeholder="2311081277"></label>
      <label class="field">Nombre completo<input name="nombre" value="${esc(a.nombre)}" required maxlength="90"></label>
      <label class="field">Correo ${id ? '<span class="hint">Es su cuenta de SIGEP</span>' : ''}<input type="email" name="email" value="${esc(a.email)}" required maxlength="90" ${id ? 'readonly' : ''}></label>
      <label class="field">Nivel<select name="nivel">${opts(NIVELES, a.nivel)}</select></label>
      <label class="field">Teléfono<input type="tel" name="telefono" value="${esc(a.telefono)}" maxlength="20"></label>
      <label class="field">Carrera<select name="carrera" id="fCarrera">${opts(CARRERAS, a.carrera)}</select></label>
      <label class="field">Grupo<input name="grupo" value="${esc(a.grupo)}" required maxlength="3"></label>
      <label class="field">Periodo<select name="periodo_id">${S.periodos.map((p) => `<option value="${p.id}" ${p.id === a.periodo_id ? 'selected' : ''}>${esc(p.nombre)}${p.estado === 'activo' ? ' (activo)' : ''}</option>`).join('')}</select></label>
      <label class="field">Estado<select name="estado">${opts(EST_AL, a.estado)}</select></label>
      ${id ? '' : '<label class="field">Contraseña inicial <span class="hint">Mínimo 8 caracteres; el alumno la cambia después</span><input type="password" name="password" minlength="8" required autocomplete="new-password"></label>'}
    </div>
    <label class="field">Empresa<select name="empresa_id"><option value="">Sin empresa por ahora</option>${[...S.empresas].sort((x, y) => x.nombre.localeCompare(y.nombre)).map((e) => `<option value="${e.id}" ${e.id === a.empresa_id ? 'selected' : ''}>${esc(e.nombre)} · ${convEst(e)[0].toLowerCase()}</option>`).join('')}</select></label>
    <label class="field">Proyecto<input name="proyecto" value="${esc(a.proyecto)}" maxlength="140" placeholder="Nombre del proyecto de estadía"></label>
    ${can('asignaciones.editar') ? `<label class="field">Asesor interno <span class="hint">Se muestran primero los de la misma carrera</span><select name="asesor_id" id="fAsesor">${asesorOptions(t?.id || '', a.carrera, a.periodo_id)}</select></label>` : ''}
    <div class="modal-f">${id ? `<button type="button" class="btn out danger" data-act="alBorrar" data-id="${id}" style="margin-right:auto">${ic('trash', 15)}Eliminar</button>` : ''}<button type="button" class="btn out" data-act="closeModal">Cancelar</button><button class="btn" type="submit">${id ? 'Guardar cambios' : 'Registrar alumno'}</button></div>
  </form>`, 640);
}
function alDetalle(id) {
  const a = al(id), t = asesorDe(a), e = em(a.empresa_id), pc = e && principal(e.id), g = asgDe(a);
  modal(`${mHead(esc(a.nombre), `${a.matricula} · ${carreraDe(a.carrera)} · Grupo ${a.grupo}`)}
  <div class="detail-grid">
    <div><h3>Datos</h3><dl class="kv"><dt>Periodo</dt><dd>${esc(per(a.periodo_id)?.nombre)}</dd><dt>Estado</dt><dd>${chip(EST_AL[a.estado])}</dd><dt>Correo</dt><dd>${esc(a.email)}</dd><dt>Teléfono</dt><dd>${esc(a.telefono || '—')}</dd><dt>Proyecto</dt><dd>${esc(a.proyecto || '—')}</dd></dl></div>
    <div><h3>Asesor y empresa</h3><dl class="kv"><dt>Asesor</dt><dd>${t ? `${esc(t.nombre)}<span class="mono" style="display:block">${TIPO_ASG[g.tipo]} · ${fmt(g.fecha)}</span>` : '<span class="chip warn">Sin asesor</span>'}</dd><dt>Empresa</dt><dd>${e ? `${esc(e.nombre)} ${chip(convEst(e))}` : '<span class="muted">Sin empresa</span>'}</dd>${pc ? `<dt>Contacto</dt><dd>${esc(pc.nombre)}<span class="mono" style="display:block">${esc(pc.telefono)} · ${esc(pc.email)}</span></dd>` : ''}</dl></div>
  </div>
  <div><h3 style="margin-bottom:8px">Expediente <span class="mono">${aprob(a)}/${DOCS.length} aprobados</span></h3><div class="rows">${DOCS.map(([k, n]) => `<div class="r"><div class="grow"><b>${n}</b></div>${chip(EST_DOC[a.expediente[k]])}</div>`).join('')}</div>
  <p class="mono" style="margin-top:8px">Los documentos se suben y revisan en el Módulo 1.</p></div>
  <div class="modal-f">${can('alumnos.editar') ? `<button class="btn out" data-act="alForm" data-id="${a.id}">${ic('edit', 15)}Editar</button>` : ''}<button class="btn" data-act="closeModal">Cerrar</button></div>`, 720);
}
function asForm(id) {
  const t = id ? as(id) : { nombre: '', email: '', telefono: '', carrera: 'ISC', capacidad: 10, activo: true };
  modal(`${mHead(id ? 'Editar asesor' : 'Registrar asesor')}
  <form class="stack" data-form="asesor" data-id="${id || ''}" style="gap:12px" novalidate>
    <div class="form-grid">
      <label class="field">Nombre completo<input name="nombre" value="${esc(t.nombre)}" required maxlength="90" placeholder="Mtra. Ana Pérez López"></label>
      <label class="field">Correo ${id ? '<span class="hint">Es su cuenta de SIGEP</span>' : ''}<input type="email" name="email" value="${esc(t.email)}" required maxlength="90" ${id ? 'readonly' : ''}></label>
      <label class="field">Teléfono<input type="tel" name="telefono" value="${esc(t.telefono)}" maxlength="20"></label>
      <label class="field">Carrera que atiende<select name="carrera">${opts(CARRERAS, t.carrera)}</select></label>
      <label class="field">Capacidad <span class="hint">Máximo de alumnos por periodo</span><input type="number" name="capacidad" min="1" max="30" value="${t.capacidad}" required></label>
      <label class="field">Estado<select name="activo"><option value="true" ${t.activo ? 'selected' : ''}>Activo</option><option value="false" ${t.activo ? '' : 'selected'}>Inactivo</option></select></label>
      ${id ? '' : '<label class="field">Contraseña inicial <span class="hint">Mínimo 8 caracteres</span><input type="password" name="password" minlength="8" required autocomplete="new-password"></label>'}
    </div>
    ${id ? `<p class="mono">Carga actual en el periodo activo: ${carga(id)} alumnos</p>` : ''}
    <div class="modal-f">${id ? `<button type="button" class="btn out danger" data-act="asBorrar" data-id="${id}" style="margin-right:auto">${ic('trash', 15)}Eliminar</button>` : ''}<button type="button" class="btn out" data-act="closeModal">Cancelar</button><button class="btn" type="submit">${id ? 'Guardar cambios' : 'Registrar asesor'}</button></div>
  </form>`, 620);
}
function asDetalle(id) {
  const t = as(id), l = S.asignaciones_asesor.filter((g) => g.asesor_id === id && g.periodo_id === activo().id).map((g) => ({ g, a: al(g.alumno_id) })).filter((x) => x.a);
  const editar = can('asignaciones.editar');
  modal(`${mHead(esc(t.nombre), `${esc(t.area)} · ${esc(t.email)}`)}
  <div class="bar-row"><div class="lbl">Carga en ${esc(activo().nombre)}<span>${l.length} de ${t.capacidad}</span></div><div class="bar ${l.length >= t.capacidad ? 'full' : ''}"><i style="width:${pct(l.length, t.capacidad)}%"></i></div></div>
  <div class="rows">${l.map(({ g, a }) => `<div class="r"><span class="avatar">${ini(a.nombre)}</span><div class="grow"><b>${esc(a.nombre)}</b><span class="muted">${a.matricula} · ${esc(em(a.empresa_id)?.nombre || 'Sin empresa')}</span></div>${dots(a)}${editar ? `<button class="btn xs out danger" data-act="quitarAsg" data-id="${g.id}" data-back="${id}">Quitar</button>` : ''}</div>`).join('') || '<p class="muted small">No tiene alumnos asignados en el periodo activo.</p>'}</div>
  <div class="modal-f">${can('asesores.editar') ? `<button class="btn out" data-act="asForm" data-id="${id}">${ic('edit', 15)}Editar</button>` : ''}${editar && t.activo && l.length < t.capacidad ? `<button class="btn out" data-act="irAsignar" data-c="${t.carrera}" data-id="${id}">${ic('shuffle', 15)}Asignar alumnos</button>` : ''}<button class="btn" data-act="closeModal">Cerrar</button></div>`, 640);
}
function peForm(id) {
  const p = id ? per(id) : { nombre: '', clave: '', inicio: '', fin: '' };
  modal(`${mHead(id ? 'Editar periodo' : 'Crear periodo')}
  <form class="stack" data-form="periodo" data-id="${id || ''}" style="gap:12px" novalidate>
    <div class="form-grid">
      <label class="field">Nombre<input name="nombre" value="${esc(p.nombre)}" required maxlength="60" placeholder="Enero – Junio 2026"></label>
      <label class="field">Clave<input name="clave" value="${esc(p.clave)}" required maxlength="12" placeholder="2026-1"></label>
      <label class="field">Inicio<input type="date" name="inicio" value="${p.inicio}" required></label>
      <label class="field">Fin<input type="date" name="fin" value="${p.fin}" required></label>
    </div>
    ${id ? '' : '<p class="mono">Se crea como planeado. Actívalo cuando inicie.</p>'}
    <div class="modal-f"><button type="button" class="btn out" data-act="closeModal">Cancelar</button><button class="btn" type="submit">${id ? 'Guardar cambios' : 'Crear periodo'}</button></div>
  </form>`, 560);
}
function emForm(id) {
  const e = id ? em(id) : { nombre: '', rfc: '', giro: '', ciudad: 'Puebla', direccion: '', convenio: 'vigente', vence: '' };
  modal(`${mHead(id ? 'Editar empresa' : 'Registrar empresa')}
  <form class="stack" data-form="empresa" data-id="${id || ''}" style="gap:12px" novalidate>
    <div class="form-grid">
      <label class="field">Nombre<input name="nombre" value="${esc(e.nombre)}" required maxlength="90"></label>
      <label class="field">RFC <span class="hint">Opcional</span><input name="rfc" value="${esc(e.rfc)}" maxlength="13" autocapitalize="characters"></label>
      <label class="field">Giro<input name="giro" value="${esc(e.giro)}" required maxlength="60"></label>
      <label class="field">Ciudad<input name="ciudad" value="${esc(e.ciudad)}" maxlength="60"></label>
    </div>
    <label class="field">Dirección<input name="direccion" value="${esc(e.direccion)}" maxlength="120"></label>
    <div class="form-grid">
      <label class="field">Convenio<select name="convenio"><option value="vigente" ${e.convenio === 'vigente' ? 'selected' : ''}>Firmado</option><option value="tramite" ${e.convenio === 'tramite' ? 'selected' : ''}>En trámite</option></select></label>
      <label class="field">Vigente hasta<input type="date" name="vence" value="${e.vence}"></label>
    </div>
    ${id ? '' : '<p class="mono">Después de registrarla podrás agregar sus contactos.</p>'}
    <div class="modal-f">${id ? `<button type="button" class="btn out danger" data-act="emBorrar" data-id="${id}" style="margin-right:auto">${ic('trash', 15)}Eliminar</button>` : ''}<button type="button" class="btn out" data-act="closeModal">Cancelar</button><button class="btn" type="submit">${id ? 'Guardar cambios' : 'Registrar empresa'}</button></div>
  </form>`, 620);
}
function emDetalle(id) {
  const e = em(id), c = convEst(e), editar = can('empresas.editar');
  const alumnosE = S.alumnos.filter((a) => a.empresa_id === id && a.periodo_id === activo().id);
  modal(`${mHead(esc(e.nombre), `${esc(e.giro)} · ${esc(e.ciudad)}${e.rfc ? ' · RFC ' + esc(e.rfc) : ''}`)}
  <div class="detail-grid">
    <div><h3>Convenio</h3><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${chip(c)}<span class="mono">${e.vence ? (c[2] === 'vencido' ? 'Venció el ' : 'Vigente hasta el ') + fmt(e.vence) : 'Sin fecha'}</span></div>
      ${editar && c[2] !== 'vigente' ? `<button class="btn xs" data-act="renovar" data-id="${id}" style="margin-top:10px">${c[2] === 'tramite' ? 'Marcar como firmado' : 'Renovar convenio'}</button>` : ''}
      <dl class="kv" style="margin-top:14px"><dt>Dirección</dt><dd>${esc(e.direccion || '—')}</dd><dt>Alumnos</dt><dd>${alumnosE.length} en el periodo activo</dd></dl></div>
    <div><h3>Alumnos en el periodo activo</h3><div class="rows">${alumnosE.slice(0, 6).map((a) => `<div class="r"><div class="grow"><b>${esc(a.nombre)}</b><span class="muted">${a.matricula} · ${a.carrera}</span></div></div>`).join('') || '<p class="muted small">Sin alumnos en este periodo.</p>'}${alumnosE.length > 6 ? `<p class="mono">y ${alumnosE.length - 6} más</p>` : ''}</div></div>
  </div>
  <div><div class="card-h" style="margin:4px 0 8px"><h3>Contactos (${contactos(id).length})</h3>${editar ? `<button class="btn xs out" data-act="coForm" data-e="${id}">${ic('plus', 14)}Agregar contacto</button>` : ''}</div>
    <div class="rows">${contactos(id).map((k) => `<div class="r"><span class="avatar ${k.principal ? 'dark' : ''}">${ini(k.nombre)}</span><div class="grow"><b>${esc(k.nombre)} ${k.principal ? '<span class="chip solid">Principal</span>' : ''}</b><span class="muted">${esc(k.puesto || '')}</span><span class="mono" style="display:block">${[k.email, k.telefono].filter(Boolean).map(esc).join(' · ')}</span></div>
      ${editar ? `<div class="end">${k.principal ? '' : `<button class="ibtn" data-act="coPrincipal" data-id="${k.id}" title="Hacer principal" aria-label="Hacer principal a ${esc(k.nombre)}">${ic('star', 15)}</button>`}<button class="ibtn" data-act="coForm" data-id="${k.id}" aria-label="Editar ${esc(k.nombre)}">${ic('edit', 15)}</button><button class="ibtn danger" data-act="coBorrar" data-id="${k.id}" aria-label="Eliminar ${esc(k.nombre)}">${ic('trash', 15)}</button></div>` : ''}</div>`).join('') || '<p class="muted small">Esta empresa aún no tiene contactos.</p>'}</div></div>
  <div class="modal-f">${editar ? `<button class="btn out" data-act="emForm" data-id="${id}">${ic('edit', 15)}Editar empresa</button>` : ''}<button class="btn" data-act="closeModal">Cerrar</button></div>`, 760);
}
function coForm(empresaId, id) {
  const k = id ? S.contactos_empresa.find((x) => x.id === id) : { nombre: '', puesto: '', email: '', telefono: '', principal: !contactos(empresaId).length };
  const eid = id ? k.empresa_id : empresaId;
  modal(`${mHead(id ? 'Editar contacto' : 'Agregar contacto', esc(em(eid).nombre))}
  <form class="stack" data-form="contacto" data-id="${id || ''}" data-e="${eid}" style="gap:12px" novalidate>
    <div class="form-grid">
      <label class="field">Nombre<input name="nombre" value="${esc(k.nombre)}" required maxlength="90" placeholder="Lic. Rosa Méndez"></label>
      <label class="field">Puesto<input name="puesto" value="${esc(k.puesto)}" maxlength="60"></label>
      <label class="field">Correo<input type="email" name="email" value="${esc(k.email)}" maxlength="90"></label>
      <label class="field">Teléfono<input type="tel" name="telefono" value="${esc(k.telefono)}" maxlength="20"></label>
    </div>
    <label class="check"><input type="checkbox" class="ck" name="principal" ${k.principal ? 'checked' : ''}>Contacto principal de la empresa</label>
    <div class="modal-f"><button type="button" class="btn out" data-act="emVolver" data-id="${eid}">Cancelar</button><button class="btn" type="submit">${id ? 'Guardar cambios' : 'Agregar contacto'}</button></div>
  </form>`, 600);
}
function renovarForm(id) {
  const e = em(id);
  const unAnio = new Date(HOY + 'T12:00:00'); unAnio.setFullYear(unAnio.getFullYear() + 1);
  const sug = unAnio.toISOString().slice(0, 10), manana = new Date(new Date(HOY + 'T12:00:00').getTime() + 864e5).toISOString().slice(0, 10);
  modal(`${mHead(e.convenio === 'tramite' ? 'Marcar convenio como firmado' : 'Renovar convenio', esc(e.nombre))}
  <form class="stack" data-form="renovar" data-id="${id}" style="gap:12px"><label class="field">Vigente hasta<input type="date" name="vence" value="${sug}" min="${manana}" required></label>
  <div class="modal-f"><button type="button" class="btn out" data-act="closeModal">Cancelar</button><button class="btn" type="submit">Guardar</button></div></form>`, 460);
}
function usForm(id) {
  const u = id ? S.usuarios.find((x) => x.id === id) : { nombre: '', email: '', rol_id: 'coordinador', activo: true };
  modal(`${mHead(id ? 'Editar usuario' : 'Agregar usuario')}
  <form class="stack" data-form="usuario" data-id="${id || ''}" style="gap:12px" novalidate>
    <div class="form-grid">
      <label class="field">Nombre<input name="nombre" value="${esc(u.nombre)}" required maxlength="90"></label>
      <label class="field">Correo institucional<input type="email" name="email" value="${esc(u.email)}" required maxlength="90" ${id ? 'readonly' : ''}></label>
      <label class="field">Rol<select name="rol_id">${S.roles.map((r) => `<option value="${r.id}" ${r.id === u.rol_id ? 'selected' : ''}>${esc(r.nombre)}</option>`).join('')}</select></label>
      <label class="field">Estado<select name="activo"><option value="true" ${u.activo ? 'selected' : ''}>Activo</option><option value="false" ${u.activo ? '' : 'selected'}>Inactivo</option></select></label>
      ${id ? '' : '<label class="field">Contraseña inicial <span class="hint">Mínimo 8 caracteres</span><input type="password" name="password" minlength="8" required autocomplete="new-password"></label>'}
    </div>
    <div class="modal-f"><button type="button" class="btn out" data-act="closeModal">Cancelar</button><button class="btn" type="submit">${id ? 'Guardar cambios' : 'Crear usuario'}</button></div>
  </form>`, 600);
}
function usPass(id) {
  const u = S.usuarios.find((x) => x.id === id);
  modal(`${mHead('Restablecer contraseña', esc(u.nombre))}
  <form class="stack" data-form="usPass" data-id="${id}" style="gap:12px"><label class="field">Nueva contraseña <span class="hint">Mínimo 8 caracteres.</span><input type="password" name="password" minlength="8" required autocomplete="new-password"></label>
  <div class="modal-f"><button type="button" class="btn out" data-act="closeModal">Cancelar</button><button class="btn" type="submit">Restablecer</button></div></form>`, 480);
}

/* ============ Exportar a CSV ============ */
function exportarCSV(soloSel) {
  const l = soloSel ? filtrarAlumnos().filter((a) => UI.al.sel.has(a.id)) : filtrarAlumnos();
  const cols = ['Matrícula', 'Nombre', 'Correo', 'Teléfono', 'Carrera', 'Grupo', 'Periodo', 'Estado', 'Empresa', 'Asesor', 'Documentos aprobados'];
  const fila = (a) => [a.matricula, a.nombre, a.email, a.telefono, carreraDe(a.carrera), a.grupo, per(a.periodo_id)?.nombre, EST_AL[a.estado][0], em(a.empresa_id)?.nombre || '', asesorDe(a)?.nombre || '', `${aprob(a)}/${DOCS.length}`];
  const csv = [cols, ...l.map(fila)].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `alumnos-${activo().clave}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${plural(l.length, 'alumno')} exportado${l.length === 1 ? '' : 's'} a CSV`);
}

/* =====================================================================
   EVENTOS
   ===================================================================== */
function setFiltro(path, valor) { const [g, k] = path.split('.'); UI[g][k] = valor; if ('page' in UI[g]) UI[g].page = 1; }
document.addEventListener('click', (e) => {
  const z = e.target.closest('[data-zoom]');
  if (z) { modal(`${mHead(esc(z.dataset.alt))}<img src="${z.dataset.zoom}" alt="${esc(z.dataset.alt)}" style="width:100%;height:auto;border-radius:10px;border:1px solid var(--line)">`, 1100); return; }
  if (e.target.id === 'mbg') { closeModal(); return; }
  const b = e.target.closest('[data-act]');
  if (!b) { if (UI.pop && !e.target.closest('.pop')) { UI.pop = null; rerender(); } return; }
  const a = b.dataset.act, d = b.dataset;
  // Las casillas dentro de filas clicables no deben abrir el detalle
  if (['sel', 'selPagina', 'agSel', 'agTodos', 'perm'].includes(a)) { e.stopPropagation(); }
  switch (a) {
    case 'openMenu': UI.menu = true; $('#side').classList.add('open'); document.querySelector('.scrim').classList.add('show'); break;
    case 'closeMenu': UI.menu = false; $('#side').classList.remove('open'); document.querySelector('.scrim').classList.remove('show'); break;
    case 'pop': UI.pop = UI.pop === d.pop ? null : d.pop; rerender(); break;
    case 'logout': M2.salir().catch(() => {}); cerrarSesion(); go('#/'); break;
    case 'closeModal': closeModal(); break;
    case 'confirmarOk': { const fn = CONFIRMAR; CONFIRMAR = null; fn && fn(); break; }
    case 'ir': e.preventDefault(); UI.pop = null; if (d.f) { const [path, v] = d.f.split(':'); if (path.startsWith('al.')) { limpiarAl(); UI.al.estado = 'activo'; UI.al.filtros = true; } setFiltro(path, v); } closeModal(); if (location.hash === d.to) rerender(); else go(d.to); break;
    case 'page': UI[d.k].page += +d.d; rerender(); break;
    // Alumnos
    case 'toggleFiltros': UI.al.filtros = !UI.al.filtros; rerender(); break;
    case 'quitarFiltro': UI.al[d.k] = ''; UI.al.page = 1; rerender(); break;
    case 'limpiarFiltros': limpiarAl(); rerender(); break;
    case 'sort': e.stopPropagation(); UI.al.dir = UI.al.sort === d.k ? -UI.al.dir : 1; UI.al.sort = d.k; rerender(); break;
    case 'sel': UI.al.sel.has(d.id) ? UI.al.sel.delete(d.id) : UI.al.sel.add(d.id); rerender(); break;
    case 'selPagina': { const f = UI.al, l = filtrarAlumnos().slice((f.page - 1) * 15, f.page * 15); const todos = l.every((x) => f.sel.has(x.id)); l.forEach((x) => (todos ? f.sel.delete(x.id) : f.sel.add(x.id))); rerender(); break; }
    case 'limpiarSel': UI.al.sel.clear(); rerender(); break;
    case 'bulkAsignar': { const asesor = $('#bulkAsesor').value; if (!asesor) { toast('Elige un asesor'); return; } accion('POST', '/asignaciones', { alumno_ids: [...UI.al.sel], asesor_id: asesor }, null, () => { UI.al.sel.clear(); rerender(); }); break; }
    case 'csv': exportarCSV(!!d.sel); break;
    case 'alForm': e.stopPropagation(); alForm(d.id); break;
    case 'alDetalle': if (e.target.closest('.ck,.ibtn')) return; alDetalle(d.id); break;
    case 'alBorrar': { const x = al(d.id); confirmar('Eliminar alumno', `Se eliminará a <b>${esc(x.nombre)}</b> (${x.matricula}) y sus asignaciones. Si solo dejó la estadía, mejor cambia su estado a Baja.`, 'Eliminar alumno', () => accion('DELETE', `/alumnos/${d.id}`, undefined, null, () => UI.al.sel.delete(d.id))); break; }
    // Asesores
    case 'asForm': e.stopPropagation(); asForm(d.id); break;
    case 'asDetalle': if (e.target.closest('.ibtn')) return; asDetalle(d.id); break;
    case 'asBorrar': { const x = as(d.id); confirmar('Eliminar asesor', `Se eliminará a <b>${esc(x.nombre)}</b>. Si tiene asignaciones registradas, el sistema no lo permitirá; en ese caso desactívalo.`, 'Eliminar asesor', () => accion('DELETE', `/asesores/${d.id}`)); break; }
    case 'irAsignar': closeModal(); UI.ag.carrera = d.c; UI.ag.asesor = d.id; UI.ag.sel.clear(); go('#/app/asignaciones'); break;
    // Asignaciones
    case 'agSel': UI.ag.sel.has(d.id) ? UI.ag.sel.delete(d.id) : UI.ag.sel.add(d.id); rerender(); break;
    case 'agTodos': { const q = UI.ag.q.toLowerCase(); const l = sinAsesor().filter((x) => (!UI.ag.carrera || x.carrera === UI.ag.carrera) && (!q || (x.nombre + x.matricula).toLowerCase().includes(q))); const todos = l.every((x) => UI.ag.sel.has(x.id)); l.forEach((x) => (todos ? UI.ag.sel.delete(x.id) : UI.ag.sel.add(x.id))); rerender(); break; }
    case 'agAsignar': { const asesor = $('#agAsesor').value; if (!asesor) { toast('Elige un asesor'); return; } UI.ag.asesor = asesor; accion('POST', '/asignaciones', { alumno_ids: [...UI.ag.sel], asesor_id: asesor }, null, () => { UI.ag.sel.clear(); rerender(); }); break; }
    case 'auto': { const c = $('#autoCarrera').value; const n = sinAsesor().filter((x) => !c || x.carrera === c).length; confirmar('Asignación automática', `Se repartirán <b>${plural(n, 'alumno')}</b> sin asesor${c ? ' de ' + CARRERAS[c] : ''} entre los asesores de su carrera con menor carga. Podrás cambiar cualquier asignación después.`, 'Distribuir alumnos', () => accion('POST', '/asignaciones/automatica', { carrera: c })); break; }
    case 'quitarAsg': { const g = S.asignaciones_asesor.find((x) => x.id === d.id), x = al(g.alumno_id), t = as(g.asesor_id); const back = d.back; confirmar('Quitar asignación', `${esc(x.nombre)} quedará sin asesor (actualmente ${esc(t.nombre)}).`, 'Quitar asignación', () => accion('DELETE', `/asignaciones/${d.id}`, undefined, null, back ? () => asDetalle(back) : null)); break; }
    // Periodos
    case 'peForm': peForm(d.id); break;
    case 'peEstado': { const p = per(d.id); const txt = { activo: `<b>${esc(p.nombre)}</b> será el periodo activo${activo().id !== p.id ? ` y <b>${esc(activo().nombre)}</b> se cerrará` : ''}. El panel y las asignaciones trabajarán sobre él.`, cerrado: `Se cerrará <b>${esc(p.nombre)}</b>. Quedará sin periodo activo hasta que actives otro.`, planeado: `<b>${esc(p.nombre)}</b> volverá a estado planeado.` }[d.e]; confirmar({ activo: 'Activar periodo', cerrado: 'Cerrar periodo', planeado: 'Reabrir periodo' }[d.e], txt, { activo: 'Activar', cerrado: 'Cerrar periodo', planeado: 'Reabrir' }[d.e], () => accion('PUT', `/periodos/${d.id}/estado`, { estado: d.e }, null, () => { UI.al.periodo = ''; })); break; }
    case 'peBorrar': confirmar('Eliminar periodo', `Se eliminará <b>${esc(per(d.id).nombre)}</b>. Esta acción no se puede deshacer.`, 'Eliminar periodo', () => accion('DELETE', `/periodos/${d.id}`)); break;
    // Empresas y contactos
    case 'emForm': e.stopPropagation(); emForm(d.id); break;
    case 'emDetalle': emDetalle(d.id); break;
    case 'emVolver': emDetalle(d.id); break;
    case 'emBorrar': confirmar('Eliminar empresa', `Se eliminará <b>${esc(em(d.id).nombre)}</b> con todos sus contactos. Si tiene alumnos, el sistema no lo permitirá.`, 'Eliminar empresa', () => accion('DELETE', `/empresas/${d.id}`)); break;
    case 'renovar': e.stopPropagation(); UI._emBack = !!b.closest('.modal'); renovarForm(d.id); break;
    case 'coForm': coForm(d.e, d.id); break;
    case 'coPrincipal': { const k = S.contactos_empresa.find((x) => x.id === d.id); accion('PUT', `/contactos/${d.id}`, { ...k, principal: true }, `${k.nombre} es ahora el contacto principal`, () => emDetalle(k.empresa_id)); break; }
    case 'coBorrar': { const k = S.contactos_empresa.find((x) => x.id === d.id); confirmar('Eliminar contacto', `Se eliminará a <b>${esc(k.nombre)}</b> de ${esc(em(k.empresa_id).nombre)}.`, 'Eliminar contacto', () => accion('DELETE', `/contactos/${d.id}`, undefined, null, () => emDetalle(k.empresa_id))); break; }
    // Expedientes
    case 'exEstado': UI.ex.doc = ''; UI.ex.est = UI.ex.est === d.e ? '' : d.e; rerender(); break;
    // Usuarios y permisos
    case 'tab': UI.us.tab = d.t; rerender(); break;
    case 'usForm': usForm(d.id); break;
    case 'usPass': usPass(d.id); break;
    case 'usBorrar': { const u = S.usuarios.find((x) => x.id === d.id); confirmar('Eliminar usuario', `Se eliminará el acceso de <b>${esc(u.nombre)}</b> (${esc(u.email)}). Si solo quieres suspenderlo, márcalo como inactivo.`, 'Eliminar usuario', () => accion('DELETE', `/usuarios/${d.id}`)); break; }
    case 'caVer': if (d.n !== '__refrescar') { UI.ca.abiertos.has(d.n) ? UI.ca.abiertos.delete(d.n) : UI.ca.abiertos.add(d.n); } cargarCache(); break;
    case 'caBorrarEntrada': cacheBorrarEntrada(d.n, d.u); break;
    case 'caVaciar': confirmar('Eliminar caché', `Se eliminará la caché <b>${esc(d.n)}</b> de este dispositivo con todo su contenido. ${d.n === CACHE_NOMBRES.shell ? 'La app volverá a descargar sus archivos base la próxima vez que la abras con conexión.' : ''}`, 'Eliminar caché', () => { closeModal(); cacheVaciar(d.n); }); break;
    case 'caDescargar': cacheDescargar(); break;
    case 'caActualizar': cacheActualizarDatos(); break;
    case 'caExiste': cacheExiste(); break;
    case 'caLimpiarLog': UI.ca.log = []; cargarCache(); break;
    case 'perm': { const r = S.roles.find((x) => x.id === d.r); const set = new Set(r.permisos); b.checked ? set.add(d.p) : set.delete(d.p); accion('PUT', `/roles/${d.r}`, { permisos: [...set] }); break; }
  }
});
function limpiarAl() { Object.assign(UI.al, { q: '', carrera: '', grupo: '', periodo: '', estado: '', asesor: '', empresa: '', exp: '', page: 1 }); }
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if ($('#mbg')) closeModal(); else if (UI.pop) { UI.pop = null; rerender(); } else if (UI.menu) { UI.menu = false; rerender(); } }
  if (e.key === 'Enter' && e.target.matches('.trow.click')) e.target.click();
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.f) { setFiltro(t.dataset.f, t.value); if (t.dataset.f === 'ex.doc') UI.ex.est = ''; rerender(); return; }
  if (t.id === 'fCarrera') { const s = $('#fAsesor'); if (s) s.innerHTML = asesorOptions(s.value, t.value, document.querySelector('[name=periodo_id]').value); }
  if (t.id === 'agAsesor') UI.ag.asesor = t.value;
});
const BUSCADORES = { 'q-al': ['al', 'q'], 'q-as': ['as', 'q'], 'q-ag': ['ag', 'q'], 'q-agl': ['ag', 'lq'], 'q-em': ['em', 'q'], 'q-ex': ['ex', 'q'] };
document.addEventListener('input', (e) => {
  const k = BUSCADORES[e.target.id]; if (!k) return;
  UI[k[0]][k[1]] = e.target.value; if ('page' in UI[k[0]]) UI[k[0]].page = 1;
  const id = e.target.id; rerender();
  const i = document.getElementById(id); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
});
// Formularios de las ventanas
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(f)), id = f.dataset.id;
  switch (f.dataset.form) {
    case 'alumno': accion(id ? 'PUT' : 'POST', id ? `/alumnos/${id}` : '/alumnos', v); break;
    case 'asesor': accion(id ? 'PUT' : 'POST', id ? `/asesores/${id}` : '/asesores', { ...v, activo: v.activo === 'true' }); break;
    case 'periodo': accion(id ? 'PUT' : 'POST', id ? `/periodos/${id}` : '/periodos', v); break;
    case 'empresa': accion(id ? 'PUT' : 'POST', id ? `/empresas/${id}` : '/empresas', v, null, (d) => { if (!id) { const n = d.datos.empresas[0]; if (n) emDetalle(n.id); } }); break;
    case 'contacto': accion(id ? 'PUT' : 'POST', id ? `/contactos/${id}` : `/empresas/${f.dataset.e}/contactos`, { ...v, principal: !!v.principal }, null, () => emDetalle(f.dataset.e)); break;
    case 'renovar': accion('PUT', `/empresas/${id}/convenio`, v, null, () => { if (UI._emBack) emDetalle(id); }); break;
    case 'usuario': accion(id ? 'PUT' : 'POST', id ? `/usuarios/${id}` : '/usuarios', { ...v, activo: v.activo === 'true' }); break;
    case 'usPass': accion('PUT', `/usuarios/${id}/password`, v); break;
    case 'caBuscar': UI.ca.url = v.url.trim(); cacheBuscar(UI.ca.url); break;
    case 'miPass': accion('PUT', '/perfil/password', v).then((r) => r && f.reset()); break;
  }
});

/* =====================================================================
   VISTA: Radar de Estadías (propuesta de mejora)
   Semáforo de riesgo por alumno, alertas push, número en el ícono
   y acciones que se guardan sin conexión para enviarse después.
   ===================================================================== */
const NIVEL = { alto: ['Riesgo alto', 'bad', 'var(--red)'], medio: ['Seguimiento', 'warn', '#F59E0B'], bajo: ['En tiempo', 'ok', 'var(--green)'] };
let _radar = { v: -1, r: null };
function RADAR() {
  if (_radar.v !== VERSION || !_radar.r) _radar = { v: VERSION, r: Radar.calcular(S, HOY) };
  return _radar.r;
}
UI.ra = { filtro: 'atencion', sel: null, cola: [], push: { soporte: false, permiso: 'default', suscrito: false, ios: false } };

// Número de alumnos en riesgo alto sobre el ícono de la app instalada (Badging API)
function ponerBadge() {
  if (!('setAppBadge' in navigator) || !S) return;
  const n = RADAR().conteo.alto;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}

// ---------- Cola de acciones sin conexión (IndexedDB) ----------
function abrirBD() {
  return new Promise((ok, mal) => {
    if (!('indexedDB' in window)) return mal(new Error('Este navegador no tiene IndexedDB.'));
    const r = indexedDB.open('sigep-m2', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('cola', { keyPath: 'id', autoIncrement: true }); r.result.createObjectStore('sesion'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
  });
}
const pedirBD = (req) => new Promise((ok, mal) => { req.onsuccess = () => ok(req.result); req.onerror = () => mal(req.error); });
// Guarda (o borra) lo que necesita el Service Worker para enviar la cola: token de la sesión, URL y clave publicable
async function guardarTokenBD(activa) {
  try {
    const datos = activa ? await M2.credenciales() : null;
    const bd = await abrirBD(); const st = bd.transaction('sesion', 'readwrite').objectStore('sesion');
    await pedirBD(datos ? st.put(datos, 'credenciales') : st.delete('credenciales'));
  } catch (e) {}
}
async function leerCola() {
  try { const bd = await abrirBD(); UI.ra.cola = await pedirBD(bd.transaction('cola').objectStore('cola').getAll()); } catch (e) { UI.ra.cola = []; }
  return UI.ra.cola;
}
async function encolar(accionCola) {
  const bd = await abrirBD();
  await pedirBD(bd.transaction('cola', 'readwrite').objectStore('cola').add({ ...accionCola, creada: new Date().toISOString() }));
  await leerCola();
  // Background Sync: el Service Worker la enviará cuando vuelva la conexión, aunque cierres el panel
  try { const reg = await navigator.serviceWorker.ready; if ('sync' in reg) await reg.sync.register('sigep-cola'); } catch (e) {}
}
async function enviarCola() {
  await leerCola();
  if (!UI.ra.cola.length || !navigator.onLine) return;
  const sw = navigator.serviceWorker?.controller;
  if (sw) { sw.postMessage({ tipo: 'enviarCola' }); return; }
  // Sin Service Worker: la página envía la cola directamente
  const bd = await abrirBD(); let n = 0;
  for (const a of UI.ra.cola) {
    try { await api(a.metodo, a.ruta, a.cuerpo); n++; } catch (e) { toast(`${a.descripcion}: ${e.message}`); }
    await pedirBD(bd.transaction('cola', 'readwrite').objectStore('cola').delete(a.id));
  }
  await leerCola(); await cargarEstado(); rerender(); if (n) toast(`${plural(n, 'acción guardada', 'acciones guardadas')} se enviaron`);
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', async (e) => {
    const m = e.data || {};
    if (m.tipo === 'colaEnviada') {
      await leerCola();
      if (SESION) { await cargarEstado().catch(() => {}); rerender(); }
      if (m.enviadas) toast(`Conexión restablecida: ${plural(m.enviadas, 'acción guardada', 'acciones guardadas')} se enviaron`);
      m.rechazadas?.forEach((x) => toast(`${x.descripcion}: ${x.error}`));
    }
    if (m.tipo === 'ir' && m.url) location.href = m.url;
  });
}

// ---------- Notificaciones push ----------
const b64ABytes = (b) => { const s = atob((b + '='.repeat((4 - (b.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
async function revisarPush() {
  const p = UI.ra.push;
  p.ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  p.instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  p.soporte = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  p.permiso = 'Notification' in window ? Notification.permission : 'no';
  p.suscrito = false;
  if (p.soporte) { try { const reg = await navigator.serviceWorker.ready; p.suscrito = !!(await reg.pushManager.getSubscription()); } catch (e) {} }
}
async function activarPush() {
  const p = UI.ra.push;
  if (!p.soporte) { toast(p.ios && !p.instalada ? 'En iPhone primero instala la app: Compartir → Agregar a inicio' : 'Este navegador no admite notificaciones push'); return; }
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') { toast('No diste permiso para mostrar notificaciones'); await revisarPush(); rerender(); return; }
  try {
    const { clave } = await api('GET', '/push/clave');
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ABytes(clave) });
    await M2.suscribirPush(sub);
    toast('Alertas activadas en este dispositivo');
  } catch (e) {
    toast('No se pudo activar: ' + (e.name === 'NotAllowedError' ? 'el navegador no lo permite aquí (en modo incógnito Chrome no admite notificaciones push)'
      : /push service|AbortError/i.test(e.name + e.message) ? 'el navegador no pudo conectarse con su servicio de notificaciones; revisa tu internet' : e.message));
  }
  await revisarPush(); rerender();
}
async function desactivarPush() {
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { await M2.quitarPush(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
    toast('Alertas desactivadas en este dispositivo');
  } catch (e) { toast(e.message); }
  await revisarPush(); rerender();
}
async function probarPush() {
  try {
    const r = await api('POST', '/push/prueba');
    if (r.enviadas) { toast(`Alerta enviada a ${plural(r.enviadas, 'dispositivo')}`); return; }
    // Sin suscripción (o sin internet hacia el servicio de push): se muestra una notificación local para la demostración
    if (Notification.permission === 'granted') {
      const reg = await navigator.serviceWorker.ready, R = RADAR();
      await reg.showNotification('Alerta de prueba · Radar de Estadías', { body: `${R.conteo.alto} alumnos en riesgo alto y ${R.conteo.medio} en seguimiento.`, icon: './icons/icon-192.png', tag: 'sigep-radar', data: { url: 'index.html#/app/radar' } });
      toast(r.dispositivos ? 'El servicio de push no respondió; se mostró una notificación local' : 'Este dispositivo no está suscrito; se mostró una notificación local');
    } else toast('Primero activa las alertas en este dispositivo');
  } catch (e) { toast(e.message); }
}

function vRadar() {
  const R = RADAR(), f = UI.ra.filtro, enCola = new Set(UI.ra.cola.map((c) => c.alumno_id));
  const lista = R.alumnos.filter((a) => f === 'todos' || (f === 'atencion' ? a.nivel !== 'bajo' : a.nivel === f));
  const sel = R.alumnos.find((a) => a.id === UI.ra.sel) || lista[0] || R.alumnos[0];
  const pu = UI.ra.push;
  const boton = (a) => {
    const x = a.accion;
    if (enCola.has(a.id)) return `<span class="chip warn">${ic('clock', 12)}En cola</span>`;
    if (!x) return `<button class="btn xs out" data-ra="ver" data-id="${a.id}">Ver</button>`;
    if (x.tipo === 'asignar' && can('asignaciones.editar')) return `<button class="btn xs" data-ra="asignar" data-id="${a.id}">Asignar</button>`;
    if (x.tipo === 'convenio' && can('empresas.editar')) return `<button class="btn xs out" data-ra="convenio" data-id="${x.empresa_id}">Renovar</button>`;
    if (x.tipo === 'empresa' && can('alumnos.editar')) return `<button class="btn xs out" data-ra="empresa" data-id="${a.id}">Vincular</button>`;
    return `<button class="btn xs out" data-ra="ver" data-id="${a.id}">Ver</button>`;
  };
  const sugerencia = (a) => {
    const x = a.accion;
    if (!x) return '<p class="muted small">Va en tiempo. No requiere ninguna acción por ahora.</p>';
    if (x.tipo === 'asignar') return `<p class="small">Asignar a <b>${esc(x.asesor)}</b> (${x.carga} de ${x.capacidad} alumnos). Es quien tiene menor carga en su carrera.</p>`;
    if (x.tipo === 'sinLugar') return '<p class="small">No hay asesores de su carrera con lugar disponible. Revisa la capacidad de los asesores.</p>';
    if (x.tipo === 'convenio') return `<p class="small">Renovar el convenio de <b>${esc(x.empresa)}</b> para que la estadía tenga respaldo.</p>`;
    if (x.tipo === 'empresa') return '<p class="small">Vincular al alumno con una empresa que tenga convenio vigente.</p>';
    return '<p class="small">Revisar su expediente y pedirle los documentos pendientes.</p>';
  };
  return `<div class="page-h"><div><h1>Radar de estadías</h1><p class="sub">Periodo ${esc(R.periodo?.nombre || '')} · Semana ${R.semana} · se recalcula con cada cambio</p></div>
    <div class="row-actions">${pu.suscrito ? `<button class="btn sm out" data-ra="prueba">${ic('bell', 15)}Enviar alerta de prueba</button>` : `<button class="btn sm" data-ra="activar">${ic('bell', 15)}Activar alertas</button>`}</div></div>
  ${help('Califica de 0 a 100 a cada alumno activo según sus documentos, su asesor, su empresa y la carga de su asesor. Rojo: 50 o más. Amarillo: de 25 a 49. Verde: menos de 25.')}
  <div class="stack">
  <div class="stats">
    <button class="stat link radar-k" data-ra="filtro" data-f="alto" style="--k:var(--red)"><span class="ic-box">${ic('alert', 16)}</span><b>${R.conteo.alto}</b><span>Riesgo alto</span><span class="mono">50 puntos o más</span></button>
    <button class="stat link radar-k" data-ra="filtro" data-f="medio" style="--k:#F59E0B"><span class="ic-box">${ic('clock', 16)}</span><b>${R.conteo.medio}</b><span>Requieren seguimiento</span><span class="mono">25 a 49 puntos</span></button>
    <button class="stat link radar-k" data-ra="filtro" data-f="bajo" style="--k:var(--green)"><span class="ic-box">${ic('checkCircle', 16)}</span><b>${R.conteo.bajo}</b><span>En tiempo</span><span class="mono">${pct(R.conteo.bajo, R.total)}% del periodo</span></button>
    <div class="stat"><span class="ic-box">${ic('calendar', 16)}</span><b>${R.diasCierre}</b><span>Días para el cierre</span><span class="mono">${fmt(R.periodo?.fin)}</span></div>
  </div>
  <div class="radar-grid">
    <section class="table">
      <div class="radar-tabs">${[['atencion', 'Requieren atención', R.conteo.alto + R.conteo.medio], ['alto', 'Riesgo alto', R.conteo.alto], ['medio', 'Seguimiento', R.conteo.medio], ['todos', 'Todos', R.total]].map(([k, n, c]) => `<button data-ra="filtro" data-f="${k}" aria-pressed="${f === k}">${n}<span>${c}</span></button>`).join('')}</div>
      ${lista.length ? lista.slice(0, 40).map((a) => `<div class="radar-row ${sel && a.id === sel.id ? 'sel' : ''}" data-ra="sel" data-id="${a.id}">
        <div class="who"><span class="avatar">${ini(a.nombre)}</span><div style="min-width:0"><b>${esc(a.nombre)}</b><span class="mono">${a.matricula} · ${a.carrera} ${a.grupo}</span></div></div>
        <div class="score"><b style="color:${NIVEL[a.nivel][2]}">${a.puntos}</b><span class="bar"><i style="width:${a.puntos}%;background:${NIVEL[a.nivel][2]}"></i></span></div>
        <div class="motivos">${a.motivos.length ? a.motivos.map((m) => `<span class="chip ${m.n === 'alto' ? 'bad' : 'warn'}">${esc(m.t)}</span>`).join('') : '<span class="chip ok">Sin pendientes</span>'}</div>
        <div class="end">${boton(a)}</div></div>`).join('') : `<div class="empty">No hay alumnos en este grupo. ${f === 'alto' ? 'Nadie está en riesgo alto.' : ''}</div>`}
      ${lista.length > 40 ? `<div class="pager"><span>Mostrando 40 de ${lista.length}</span></div>` : ''}
    </section>
    <div class="stack">
      ${sel ? `<section class="card"><div class="card-h"><h2>¿Por qué ${sel.nivel === 'alto' ? 'está en rojo' : sel.nivel === 'medio' ? 'está en amarillo' : 'va en tiempo'}?</h2><span class="chip ${NIVEL[sel.nivel][1]}">${sel.puntos} / 100</span></div>
        <b style="display:block;margin-bottom:12px">${esc(sel.nombre)}</b>
        ${Radar.FACTORES.map(([k, n]) => `<div class="bar-row"><div class="lbl">${n}<span>${sel.factores[k]} / ${Radar.PESOS[k]}</span></div><div class="bar"><i style="width:${pct(sel.factores[k], Radar.PESOS[k])}%"></i></div></div>`).join('')}
        <div class="sugerida"><b>Acción sugerida</b>${sugerencia(sel)}<div class="row-actions">${enCola.has(sel.id) ? `<span class="chip warn">${ic('clock', 12)}En cola: se enviará al reconectar</span>` : boton(sel)}<button class="btn xs out" data-ra="ver" data-id="${sel.id}">Ver expediente</button></div></div>
      </section>` : ''}
      <section class="card"><div class="card-h"><h2>Alertas en este dispositivo</h2><span class="chip ${pu.suscrito ? 'ok' : ''}">${pu.suscrito ? 'Activas' : 'Inactivas'}</span></div>
        <p class="muted small">Recibe un aviso cuando un alumno pase a riesgo alto, aunque el panel esté cerrado. El número de alumnos en rojo aparece sobre el ícono de la app instalada.</p>
        ${!pu.soporte ? `<p class="small" style="margin-top:10px">${pu.ios && !pu.instalada ? 'En iPhone las notificaciones funcionan con la app instalada: <b>Compartir → Agregar a inicio</b>.' : 'Este navegador no admite notificaciones push.'}</p>` : ''}
        ${pu.permiso === 'denied' ? '<p class="small" style="margin-top:10px;color:var(--red)">Bloqueaste las notificaciones para este sitio. Actívalas desde el candado de la barra de direcciones.</p>' : ''}
        <div class="row-actions" style="margin-top:12px">${pu.suscrito ? `<button class="btn sm" data-ra="prueba">Enviar alerta de prueba</button><button class="btn sm out" data-ra="desactivar">Desactivar</button>` : `<button class="btn sm" data-ra="activar" ${pu.soporte ? '' : 'disabled'}>Activar alertas</button>`}</div>
      </section>
      <section class="card"><div class="card-h"><h2>Acciones sin conexión</h2><span class="chip ${UI.ra.cola.length ? 'warn' : ''}">${UI.ra.cola.length ? UI.ra.cola.length + ' en cola' : 'Cola vacía'}</span></div>
        <p class="muted small">Si no hay internet, las asignaciones hechas desde el radar se guardan en este dispositivo y se envían solas al volver la conexión.</p>
        ${UI.ra.cola.length ? `<div class="rows" style="margin-top:8px">${UI.ra.cola.map((c) => `<div class="r"><span class="ic-box warn">${ic('clock', 15)}</span><div class="grow"><b>${esc(c.descripcion)}</b><span class="muted">Guardada ${fechaHora(c.creada)}</span></div></div>`).join('')}</div>
          ${navigator.onLine ? '<button class="btn sm" data-ra="enviarCola" style="margin-top:10px">Enviar ahora</button>' : ''}` : ''}
      </section>
    </div>
  </div>
  </div>`;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ra]');
  if (!b || !S) return;
  const d = b.dataset;
  if (d.ra !== 'sel') e.stopPropagation();
  switch (d.ra) {
    case 'sel': if (e.target.closest('button')) return; UI.ra.sel = d.id; rerender(); break;
    case 'filtro': UI.ra.filtro = d.f; UI.ra.sel = null; rerender(); break;
    case 'ver': alDetalle(d.id); break;
    case 'empresa': alForm(d.id); break;
    case 'convenio': if (!navigator.onLine) { toast('Renovar un convenio necesita internet'); return; } renovarForm(d.id); break;
    case 'asignar': {
      const a = RADAR().alumnos.find((x) => x.id === d.id), x = a.accion;
      const cuerpo = { alumno_ids: [a.id], asesor_id: x.asesor_id };
      if (navigator.onLine) { accion('POST', '/asignaciones', cuerpo, `${a.nombre} asignado a ${x.asesor}`); return; }
      encolar({ metodo: 'POST', ruta: '/asignaciones', cuerpo, alumno_id: a.id, descripcion: `Asignar a ${x.asesor} → ${a.nombre}` })
        .then(() => { toast('Sin conexión: la asignación se enviará al reconectar'); rerender(); })
        .catch((err) => toast(err.message));
      break;
    }
    case 'activar': activarPush(); break;
    case 'desactivar': desactivarPush(); break;
    case 'prueba': probarPush(); break;
    case 'enviarCola': enviarCola(); break;
  }
});
window.addEventListener('online', () => setTimeout(enviarCola, 800));
leerCola();
revisarPush();
M2.alCambiarSesion(() => { if (SESION) guardarTokenBD(true); });

/* ============ PWA: Service Worker, instalación y conexión ============ */
let installPrompt = null;
function showInstall() { const b = document.getElementById('installBtn'); if (b) b.hidden = !installPrompt; }
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; showInstall(); });
window.addEventListener('appinstalled', () => { installPrompt = null; showInstall(); toast('SIGEP se instaló en tu dispositivo'); });
document.addEventListener('click', async (e) => { if (e.target.closest('#installBtn') && installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; showInstall(); } });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((r) => console.log('[SIGEP] SW registrado. Alcance:', r.scope))
      .catch((err) => console.error('[SIGEP] Error al registrar el SW:', err));
  });
}
window.addEventListener('offline', async () => { await leerFechaDatos(); rerender(); toast('Sin conexión: estás viendo la información guardada'); });
window.addEventListener('online', () => { rerender(); toast('Conexión restablecida'); sincronizar(); });
leerFechaDatos();

// Si ya hay sesión de SIGEP (de este o de otro módulo), entra directo al panel
M2.sesion()
  .then((p) => {
    SESION = p && !p.sinAcceso ? p : null;
    if (SESION) guardarTokenBD(true);
    else if (p && p.sinAcceso && location.hash.startsWith('#/app')) { go('#/login'); setTimeout(() => toast('Esta cuenta no pertenece al personal de coordinación.'), 300); }
  })
  .catch(() => { SESION = null; })
  .finally(() => { route(); setInterval(sincronizar, 8000); });
