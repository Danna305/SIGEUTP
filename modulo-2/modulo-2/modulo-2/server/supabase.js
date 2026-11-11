/* =====================================================================
   SIGEP UTP · Conexión con Supabase (PostgreSQL)
   Usa la API REST de Supabase con fetch(), sin paquetes adicionales.
   - cargarTodo():      lee las 8 tablas
   - guardarCambios():  envía solo lo que cambió (insertar, actualizar, borrar)
   - reemplazarTodo():  borra todo y vuelve a insertar (datos de ejemplo)
   ===================================================================== */

// Orden de las tablas: primero las que no dependen de otras
const TABLAS = ['roles', 'periodos', 'empresas', 'asesores', 'usuarios', 'alumnos', 'contactos_empresa', 'asignaciones_asesor'];
const HIJAS = ['asignaciones_asesor', 'contactos_empresa'];   // se borran antes de insertar
const COLUMNAS = {
  roles: ['id', 'nombre', 'descripcion', 'permisos', 'sistema'],
  usuarios: ['id', 'nombre', 'email', 'password_hash', 'password_salt', 'rol_id', 'activo', 'ultimo_acceso'],
  periodos: ['id', 'clave', 'nombre', 'inicio', 'fin', 'estado'],
  empresas: ['id', 'nombre', 'rfc', 'giro', 'ciudad', 'direccion', 'convenio', 'vence'],
  contactos_empresa: ['id', 'empresa_id', 'nombre', 'puesto', 'email', 'telefono', 'principal'],
  asesores: ['id', 'nombre', 'email', 'telefono', 'carrera', 'area', 'capacidad', 'activo'],
  alumnos: ['id', 'matricula', 'nombre', 'email', 'telefono', 'carrera', 'grupo', 'periodo_id', 'empresa_id', 'proyecto', 'estado', 'expediente'],
  asignaciones_asesor: ['id', 'alumno_id', 'asesor_id', 'periodo_id', 'tipo', 'fecha']
};

let URL_BASE = '', LLAVE = '';
// Acepta la URL aunque venga con /rest/v1, con / al final o copiada del panel (supabase.com/dashboard/project/<ref>)
function configurar(url, llave) {
  let u = String(url).trim();
  const panel = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (panel) u = `https://${panel[1]}.supabase.co`;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  URL_BASE = new URL(u).origin + '/rest/v1';
  LLAVE = String(llave).trim();
}

// Petición a la API REST de Supabase con mensajes de error claros
async function rest(metodo, ruta, cuerpo, prefer) {
  // Llaves antiguas (JWT "eyJ...") van también en Authorization; las nuevas (sb_secret_...) solo en apikey
  const headers = { apikey: LLAVE, 'Content-Type': 'application/json' };
  if (LLAVE.startsWith('eyJ')) headers.Authorization = `Bearer ${LLAVE}`;
  if (prefer) headers.Prefer = prefer;
  let r;
  try { r = await fetch(`${URL_BASE}/${ruta}`, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined }); }
  catch (e) { throw new Error(`No se pudo conectar con Supabase (${e.cause?.code || e.message}). Revisa SUPABASE_URL y tu internet.`); }
  if (!r.ok) {
    const det = await r.json().catch(() => ({}));
    const msg = det.message || r.statusText;
    if (r.status === 401 || /JWT|apikey/i.test(msg)) throw new Error('Supabase rechazó la llave. En SUPABASE_KEY usa la llave secreta (service_role o sb_secret_...), no la pública.');
    if (det.code === '42P01' || /does not exist|schema cache/i.test(msg)) throw new Error(`Falta crear las tablas en Supabase: ejecuta database/supabase.sql en el SQL Editor (${msg}).`);
    if (det.code === '23503') throw new Error('No se puede: hay registros relacionados en Supabase (llave foránea).');
    if (det.code === '23505') throw new Error('Ya existe un registro con ese valor único en Supabase.');
    throw new Error(`Supabase: ${msg}`);
  }
  return r.status === 204 ? null : r.json().catch(() => null);
}

// Conversión entre los objetos de la app y las filas de la base
function aFila(tabla, obj) {
  const o = { ...obj };
  if (tabla === 'usuarios') { o.password_hash = o.hash; o.password_salt = o.salt; }
  const fila = {};
  for (const c of COLUMNAS[tabla]) { const v = o[c]; fila[c] = v === '' || v === undefined ? null : v; }
  return fila;
}
function deFila(tabla, fila) {
  const o = {};
  for (const [c, v] of Object.entries(fila)) o[c] = v === null ? '' : v;
  if (tabla === 'usuarios') {
    o.hash = fila.password_hash; o.salt = fila.password_salt;
    delete o.password_hash; delete o.password_salt;
    o.ultimo_acceso = fila.ultimo_acceso ? new Date(fila.ultimo_acceso).toISOString() : null;
  }
  return o;
}
// Texto estable de una fila (mismas llaves en el mismo orden) para comparar
function huella(tabla, obj) {
  const ordenar = (v) => (Array.isArray(v) ? v.map(ordenar) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenar(v[k])])) : v);
  const f = aFila(tabla, obj);
  if (f.ultimo_acceso) f.ultimo_acceso = new Date(f.ultimo_acceso).toISOString();
  return JSON.stringify(ordenar(f));
}

async function cargarTodo() {
  const datos = {};
  for (const t of TABLAS) {
    const filas = await rest('GET', `${t}?select=*&order=id`);
    datos[t] = filas.map((f) => deFila(t, f));
  }
  datos.periodos.sort((a, b) => a.inicio.localeCompare(b.inicio));
  return datos;
}

// Compara dos versiones de los datos y devuelve qué filas insertar/actualizar y cuáles borrar
function diferencias(antes, ahora) {
  const out = {};
  for (const t of TABLAS) {
    const a = new Map((antes[t] || []).map((x) => [x.id, huella(t, x)]));
    const n = new Map((ahora[t] || []).map((x) => [x.id, x]));
    out[t] = {
      guardar: [...n.values()].filter((x) => a.get(x.id) !== huella(t, x)),
      borrar: [...a.keys()].filter((id) => !n.has(id))
    };
  }
  return out;
}
const hayCambios = (d) => TABLAS.some((t) => d[t].guardar.length || d[t].borrar.length);
const lista = (ids) => `(${ids.map((i) => `"${String(i).replace(/"/g, '')}"`).join(',')})`;

async function borrar(t, ids) {
  for (let i = 0; i < ids.length; i += 100) await rest('DELETE', `${t}?id=in.${lista(ids.slice(i, i + 100))}`);
}
async function guardar(t, filas) {
  for (let i = 0; i < filas.length; i += 500) {
    await rest('POST', t, filas.slice(i, i + 500).map((x) => aFila(t, x)), 'resolution=merge-duplicates,return=minimal');
  }
}

// Envía a Supabase solo los cambios entre "antes" y "ahora"
async function guardarCambios(antes, ahora) {
  const d = diferencias(antes, ahora);
  if (!hayCambios(d)) return 0;
  for (const t of HIJAS) if (d[t].borrar.length) await borrar(t, d[t].borrar);             // 1. hijas borradas
  for (const t of TABLAS) if (d[t].guardar.length) await guardar(t, d[t].guardar);         // 2. altas y cambios
  for (const t of [...TABLAS].reverse()) if (!HIJAS.includes(t) && d[t].borrar.length) await borrar(t, d[t].borrar); // 3. demás bajas
  return TABLAS.reduce((s, t) => s + d[t].guardar.length + d[t].borrar.length, 0);
}

async function reemplazarTodo(datos) {
  for (const t of [...TABLAS].reverse()) await rest('DELETE', `${t}?id=not.is.null`);
  for (const t of TABLAS) if (datos[t].length) await guardar(t, datos[t]);
}
const estaVacia = (datos) => TABLAS.every((t) => !datos[t].length);

module.exports = { TABLAS, configurar, cargarTodo, guardarCambios, reemplazarTodo, diferencias, hayCambios, estaVacia };
