/* =====================================================================
   SIGEP UTP · Módulo 2 · Datos iniciales de ejemplo
   Cada colección corresponde a una tabla del módulo:
   usuarios, roles, alumnos, asesores, periodos,
   asignaciones_asesor, empresas y contactos_empresa.
   ===================================================================== */
const crypto = require('crypto');

const CARRERAS = {
  ISC: 'Ing. en Sistemas Computacionales',
  IMT: 'Ing. en Mecatrónica',
  IIN: 'Ing. Industrial',
  LNM: 'Lic. en Negocios y Mercadotecnia',
  IER: 'Ing. en Energías Renovables'
};
const AREAS = {
  ISC: 'Sistemas y Computación', IMT: 'Mecatrónica', IIN: 'Procesos Industriales',
  LNM: 'Negocios', IER: 'Energías Renovables'
};
const DOCUMENTOS = ['aceptacion', 'seguro', 'plan', 'parcial', 'liberacion'];

// Catálogo de permisos del módulo (clave → descripción)
const PERMISOS = [
  { clave: 'alumnos.ver', modulo: 'Alumnos', accion: 'Consultar' },
  { clave: 'alumnos.editar', modulo: 'Alumnos', accion: 'Registrar, editar y eliminar' },
  { clave: 'asesores.ver', modulo: 'Asesores', accion: 'Consultar' },
  { clave: 'asesores.editar', modulo: 'Asesores', accion: 'Registrar, editar y eliminar' },
  { clave: 'asignaciones.editar', modulo: 'Asignaciones', accion: 'Asignar y quitar asesores' },
  { clave: 'periodos.ver', modulo: 'Periodos', accion: 'Consultar' },
  { clave: 'periodos.editar', modulo: 'Periodos', accion: 'Crear, activar y cerrar' },
  { clave: 'empresas.ver', modulo: 'Empresas', accion: 'Consultar empresas y contactos' },
  { clave: 'empresas.editar', modulo: 'Empresas', accion: 'Registrar, editar y renovar convenios' },
  { clave: 'expedientes.ver', modulo: 'Expedientes', accion: 'Consultar estado general' },
  { clave: 'usuarios.ver', modulo: 'Usuarios', accion: 'Consultar usuarios y roles' },
  { clave: 'usuarios.editar', modulo: 'Usuarios', accion: 'Gestionar usuarios y permisos' }
];
const TODOS = PERMISOS.map((p) => p.clave);

// Contraseñas cifradas con scrypt + sal aleatoria (nunca se guardan en texto plano)
function cifrar(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 32).toString('hex') };
}

// Generador pseudoaleatorio con semilla: siempre produce los mismos datos
function rng(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sinAcentos = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function seed() {
  const r = rng(20250113);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const N = ['Ana', 'Luis', 'María', 'José', 'Fernanda', 'Diego', 'Valeria', 'Jorge', 'Daniela', 'Miguel', 'Sofía', 'Carlos', 'Paola', 'Ricardo', 'Andrea', 'Emilio', 'Karla', 'Óscar', 'Mariana', 'Iván', 'Lucía', 'Héctor', 'Ximena', 'Raúl', 'Gabriela', 'Alan', 'Itzel', 'Sergio', 'Renata', 'Uriel', 'Alejandra', 'Brenda', 'Kevin', 'Montserrat', 'Érick', 'Natalia'];
  const A = ['García', 'Hernández', 'López', 'Martínez', 'Pérez', 'González', 'Rodríguez', 'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Morales', 'Vázquez', 'Reyes', 'Jiménez', 'Torres', 'Díaz', 'Mendoza', 'Ruiz', 'Aguilar', 'Ortiz', 'Castillo', 'Romero', 'Medina', 'Juárez', 'Rivera', 'Domínguez', 'Luna', 'Vega', 'Cabrera', 'Núñez'];
  const MUJERES = new Set(['Ana', 'María', 'Fernanda', 'Valeria', 'Daniela', 'Sofía', 'Paola', 'Andrea', 'Karla', 'Mariana', 'Lucía', 'Ximena', 'Gabriela', 'Itzel', 'Renata', 'Alejandra', 'Brenda', 'Montserrat', 'Natalia']);
  // Título acorde al nombre (Mtra./Dra. para mujeres, Mtro./Dr. para hombres)
  const titulo = (n, opciones) => { const t = pick(opciones); return MUJERES.has(n) ? ({ 'Mtro.': 'Mtra.', 'Dr.': 'Dra.' }[t] || t) : ({ 'Mtra.': 'Mtro.', 'Dra.': 'Dr.' }[t] || t); };
  const tel = () => `222 ${100 + Math.floor(r() * 900)} ${1000 + Math.floor(r() * 9000)}`;
  const hace = (min) => new Date(Date.now() - min * 60000).toISOString();

  /* ---------- roles ---------- */
  const roles = [
    { id: 'admin', nombre: 'Administrador', sistema: true,
      descripcion: 'Control total del módulo, incluidos periodos, usuarios y permisos.', permisos: [...TODOS] },
    { id: 'coordinador', nombre: 'Coordinador de carrera', sistema: false,
      descripcion: 'Gestiona alumnos, asesores, asignaciones y empresas. Consulta periodos.',
      permisos: TODOS.filter((p) => !['usuarios.ver', 'usuarios.editar', 'periodos.editar'].includes(p)) },
    { id: 'consulta', nombre: 'Consulta', sistema: false,
      descripcion: 'Solo consulta información y estadísticas; no modifica datos.',
      permisos: TODOS.filter((p) => p.endsWith('.ver') && p !== 'usuarios.ver') }
  ];

  /* ---------- usuarios (contraseña de demostración: demo1234) ---------- */
  const usuarios = [
    ['u1', 'Mtro. Carlos Reyes', 'admin@utpuebla.edu.mx', 'admin', true, hace(35)],
    ['u2', 'Ing. Laura Medina Ortiz', 'coordinacion@utpuebla.edu.mx', 'coordinador', true, hace(60 * 26)],
    ['u3', 'Lic. Sofía Herrera Luna', 'consulta@utpuebla.edu.mx', 'consulta', true, hace(60 * 72)],
    ['u4', 'Ing. Pablo Morales Díaz', 'pmorales@utpuebla.edu.mx', 'coordinador', false, null]
  ].map(([id, nombre, email, rol_id, activo, ultimo_acceso]) =>
    ({ id, nombre, email, rol_id, activo, ultimo_acceso, ...cifrar('demo1234') }));

  /* ---------- periodos ---------- */
  const periodos = [
    { id: 'p1', clave: '2024-3', nombre: 'Septiembre – Diciembre 2024', inicio: '2024-09-02', fin: '2024-12-13', estado: 'cerrado' },
    { id: 'p2', clave: '2025-1', nombre: 'Enero – Junio 2025', inicio: '2025-01-13', fin: '2025-06-16', estado: 'activo' },
    { id: 'p3', clave: '2025-3', nombre: 'Septiembre – Diciembre 2025', inicio: '2025-09-01', fin: '2025-12-12', estado: 'planeado' }
  ];

  /* ---------- empresas y contactos_empresa ---------- */
  const nombresEmp = ['TECDATA Solutions', 'Autopartes del Centro', 'Nube Norte Software', 'Logística Azteca', 'Grupo Textil Angelópolis', 'Hospital San Ángel', 'Solar Puebla Energía', 'Mecatrónica Atlixco', 'Alimentos La Poblana', 'Consultores Cholula', 'Digital Maíz Studio', 'Plásticos del Valle', 'Farmacéutica Zaragoza', 'Automatiza MX', 'Talavera Cloud', 'Metalmecánica Tehuacán', 'Distribuidora Popocatépetl', 'Innova Retail', 'Red Eléctrica Poniente', 'Ensambles Cuautlancingo'];
  const pref = ['Grupo', 'Servicios', 'Industrias', 'Soluciones', 'Corporativo', 'Tecnologías', 'Manufacturas', 'Consultoría', 'Comercial', 'Ingeniería'];
  const suf = ['Xonaca', 'La Paz', 'Huexotitla', 'San Manuel', 'Amalucan', 'Texmelucan', 'Momoxpan', 'Chipilo', 'Serdán', 'Analco', 'Xanenetla', 'Tonantzintla', 'San Baltazar', 'Resurgimiento', 'Atoyac', 'Malintzi', 'Iztaccíhuatl', 'Cuexcomate', 'Tlaxcalancingo', 'Zavaleta', 'Chulavista'];
  const giros = ['Tecnologías de la información', 'Manufactura automotriz', 'Logística y transporte', 'Salud', 'Energía', 'Alimentos', 'Consultoría', 'Comercio', 'Textil', 'Metalmecánica'];
  const calles = ['Av. Juárez', 'Blvd. Atlixco', 'Calle 5 de Mayo', 'Av. Reforma', 'Blvd. Hermanos Serdán', 'Vía Atlixcáyotl', 'Av. Las Torres', 'Calle 14 Sur'];
  const empresas = [], contactos_empresa = [];
  for (let i = 0; i < 41; i++) {
    const nombre = i < nombresEmp.length ? nombresEmp[i] : `${pref[i % pref.length]} ${suf[(i * 3) % suf.length]}`;
    let convenio = 'vigente';
    let vence = `${2026 + Math.floor(r() * 2)}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-28`;
    if (i >= 38) { convenio = 'vigente'; vence = ['2025-01-31', '2025-03-15', '2024-12-20'][i - 38]; }
    if (i === 7 || i === 23) { convenio = 'tramite'; vence = ''; }
    if (i === 2) vence = '2025-05-30';
    const rfc = sinAcentos(nombre).replace(/[^a-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X') + `${String(10 + Math.floor(r() * 15)).padStart(2, '0')}0${1 + Math.floor(r() * 9)}1${Math.floor(r() * 9)}`;
    empresas.push({
      id: 'e' + (i + 1), nombre, rfc, giro: i === 0 ? giros[0] : pick(giros),
      ciudad: pick(['Puebla', 'Puebla', 'San Andrés Cholula', 'San Pedro Cholula', 'Cuautlancingo', 'Atlixco', 'Huejotzingo']),
      direccion: `${pick(calles)} ${100 + Math.floor(r() * 4800)}`, convenio, vence
    });
    const nc = 1 + (r() < 0.55 ? 1 : 0) + (r() < 0.15 ? 1 : 0);
    const puestos = ['Responsable de Recursos Humanos', 'Jefe de Proyectos', 'Gerente de Planta', 'Coordinador de Talento', 'Director General'];
    for (let c = 0; c < nc; c++) {
      const n = pick(N), a = pick(A);
      contactos_empresa.push({
        id: `c${contactos_empresa.length + 1}`, empresa_id: 'e' + (i + 1),
        nombre: `${titulo(n, ['Lic.', 'Ing.', 'Mtra.', 'C.P.', 'Mtro.'])} ${n} ${a}`, puesto: c === 0 ? puestos[i % 2] : pick(puestos.slice(1)),
        email: `${sinAcentos(n)}.${sinAcentos(a)}@${sinAcentos(nombre).replace(/[^a-z]/g, '').slice(0, 14)}.com.mx`,
        telefono: tel(), principal: c === 0
      });
    }
  }

  /* ---------- asesores ---------- */
  const asesores = [{ id: 't1', nombre: 'Dr. Miguel Ángel Flores', carrera: 'ISC', area: AREAS.ISC, email: 'mflores@utpuebla.edu.mx', telefono: tel(), capacidad: 10, activo: true }];
  ['ISC', 'ISC', 'ISC', 'ISC', 'ISC', 'IMT', 'IMT', 'IMT', 'IMT', 'IIN', 'IIN', 'IIN', 'IIN', 'IIN', 'LNM', 'LNM', 'LNM', 'LNM', 'IER', 'IER', 'IER', 'IER', 'ISC'].forEach((c, i) => {
    const n = pick(N), a = pick(A);
    asesores.push({
      id: 't' + (i + 2), nombre: `${titulo(n, ['Mtro.', 'Mtra.', 'Dr.', 'Dra.', 'Ing.'])} ${n} ${a}`, carrera: c, area: AREAS[c],
      email: `${sinAcentos(n)[0]}${sinAcentos(a)}@utpuebla.edu.mx`, telefono: tel(),
      capacidad: [8, 10, 10, 12][Math.floor(r() * 4)], activo: i !== 21
    });
  });

  /* ---------- alumnos ---------- */
  const PROY = {
    ISC: ['Sistema de control de inventarios', 'App móvil de seguimiento de pedidos', 'Portal de autoservicio para empleados', 'Tablero de indicadores en tiempo real', 'Migración de servidores a la nube', 'Sistema de tickets de soporte'],
    IMT: ['Automatización de estación de pruebas', 'Brazo robótico para empaque', 'Monitoreo de vibraciones con IoT', 'Control PLC de banda transportadora'],
    IIN: ['Reducción de tiempos muertos en línea 3', 'Implementación de 5S en almacén', 'Balanceo de línea de ensamble', 'Estudio de tiempos y movimientos'],
    LNM: ['Plan de mercadotecnia digital', 'Estudio de mercado para nueva línea', 'Estrategia de ventas B2B', 'Programa de lealtad de clientes'],
    IER: ['Diagnóstico energético de planta', 'Dimensionamiento de sistema fotovoltaico', 'Eficiencia en iluminación industrial', 'Monitoreo de consumo eléctrico']
  };
  const exp = (q) => {
    const e = {};
    [['aceptacion', 0.965], ['seguro', 0.85], ['plan', 0.8], ['parcial', 0.62]].forEach(([k, th]) => {
      e[k] = q < th ? (['plan', 'parcial'].includes(k) && r() < 0.06 ? 'rechazado' : (r() < 0.07 ? 'cargado' : 'aprobado')) : 'pendiente';
    });
    e.liberacion = 'pendiente';
    return e;
  };
  const alumnos = [];
  const fijos = [
    ['Ana Gabriela Torres Medina', '21ISC001', 'A', 'e1', 'Sistema de inventario web para TECDATA Solutions'],
    ['Carlos Eduardo Ramírez Vega', '21ISC014', 'A', 'e3', 'App móvil de seguimiento de pedidos'],
    ['Rodrigo Iván Paredes Núñez', '21ISC022', 'B', 'e15', 'Migración de servidores a la nube'],
    ['Luis Fernando Ortega Cruz', '21ISC031', 'B', 'e11', 'Portal de autoservicio para empleados'],
    ['Mariana López Castillo', '21ISC037', 'A', 'e14', 'Tablero de indicadores en tiempo real'],
    ['Diego Alejandro Reyes Luna', '21ISC045', 'B', 'e1', 'Sistema de tickets de soporte'],
    ['Paola Jiménez Aguilar', '21ISC052', 'A', 'e19', 'Sistema de control de inventarios'],
    ['Emilio Sánchez Romero', '21ISC060', 'B', 'e18', 'Tablero de ventas por sucursal']
  ];
  const correo = (nombre, mat) => `${sinAcentos(nombre.split(' ')[0])}.${mat.toLowerCase()}@alumno.utpuebla.edu.mx`;
  fijos.forEach(([nombre, matricula, grupo, empresa_id, proyecto], i) => {
    alumnos.push({ id: 'a' + (i + 1), matricula, nombre, email: correo(nombre, matricula), telefono: tel(), carrera: 'ISC', grupo,
      periodo_id: 'p2', empresa_id, proyecto, estado: 'activo',
      expediente: { aceptacion: 'aprobado', seguro: 'aprobado', plan: 'aprobado', parcial: i === 0 ? 'rechazado' : (i < 3 ? 'cargado' : 'aprobado'), liberacion: 'pendiente' } });
  });
  const cnt = { ISC: 61, IMT: 1, IIN: 1, LNM: 1, IER: 1 };
  const nuevoAlumno = (periodo_id, idx) => {
    const u = r(), car = u < 0.36 ? 'ISC' : u < 0.56 ? 'IMT' : u < 0.76 ? 'IIN' : u < 0.9 ? 'LNM' : 'IER';
    const gen = periodo_id === 'p1' ? '20' : '21';
    const matricula = `${gen}${car}${String(cnt[car]++).padStart(3, '0')}`;
    const nombre = `${pick(N)} ${pick(A)} ${pick(A)}`;
    const sinEmpresa = periodo_id === 'p2' && r() < 0.05;
    return {
      id: 'a' + idx, matricula, nombre, email: correo(nombre, matricula), telefono: tel(), carrera: car,
      grupo: r() < 0.5 ? 'A' : 'B', periodo_id, empresa_id: sinEmpresa ? '' : empresas[Math.floor(r() * 38)].id,
      proyecto: sinEmpresa ? '' : pick(PROY[car]),
      estado: periodo_id === 'p1' ? 'concluido' : (r() < 0.025 ? 'baja' : 'activo'),
      expediente: periodo_id === 'p1' ? Object.fromEntries(DOCUMENTOS.map((d) => [d, 'aprobado'])) : exp(r())
    };
  };
  for (let i = 0; i < 134; i++) alumnos.push(nuevoAlumno('p2', alumnos.length + 1));
  for (let i = 0; i < 38; i++) alumnos.push(nuevoAlumno('p1', alumnos.length + 1));

  /* ---------- asignaciones_asesor ---------- */
  const asignaciones_asesor = [];
  const carga = {};
  const asignar = (al, as, tipo, fecha) => {
    asignaciones_asesor.push({ id: 'g' + (asignaciones_asesor.length + 1), alumno_id: al.id, asesor_id: as.id, periodo_id: al.periodo_id, tipo, fecha });
    carga[as.id + al.periodo_id] = (carga[as.id + al.periodo_id] || 0) + 1;
  };
  alumnos.slice(0, 8).forEach((al) => asignar(al, asesores[0], 'individual', '2025-01-15'));
  let sinAsignar = 0;
  alumnos.slice(8).forEach((al) => {
    if (al.periodo_id === 'p2' && al.estado === 'activo' && sinAsignar < 13 && r() < 0.13) { sinAsignar++; return; }
    if (al.estado === 'baja') return;
    const cands = asesores.filter((t) => t.carrera === al.carrera && (t.activo || al.periodo_id === 'p1') && (carga[t.id + al.periodo_id] || 0) < t.capacidad);
    if (!cands.length) return;
    cands.sort((x, y) => (carga[x.id + al.periodo_id] || 0) - (carga[y.id + al.periodo_id] || 0));
    asignar(al, cands[0], r() < 0.7 ? 'masiva' : 'individual', al.periodo_id === 'p1' ? '2024-09-04' : '2025-01-' + (15 + Math.floor(r() * 10)));
  });

  /* ---------- bitácora de actividad (para el panel) ---------- */
  const actividad = [
    { fecha: hace(12), usuario: 'Mtro. Carlos Reyes', accion: 'Renovó el convenio de Nube Norte Software' },
    { fecha: hace(48), usuario: 'Ing. Laura Medina Ortiz', accion: 'Asignó 6 alumnos a Dr. Miguel Ángel Flores' },
    { fecha: hace(60 * 5), usuario: 'Ing. Laura Medina Ortiz', accion: 'Registró al alumno Emilio Sánchez Romero' },
    { fecha: hace(60 * 26), usuario: 'Mtro. Carlos Reyes', accion: 'Activó el periodo Enero – Junio 2025' },
    { fecha: hace(60 * 50), usuario: 'Mtro. Carlos Reyes', accion: 'Agregó el contacto Lic. Rosa Méndez a Autopartes del Centro' }
  ];

  return { roles, usuarios, periodos, alumnos, asesores, asignaciones_asesor, empresas, contactos_empresa, actividad };
}

module.exports = { seed, cifrar, CARRERAS, AREAS, PERMISOS, DOCUMENTOS };
