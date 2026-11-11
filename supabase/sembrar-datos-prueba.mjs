// ==========================================================================
// sembrar-datos-prueba.mjs — Datos de prueba de todos los módulos de SIGEP
// --------------------------------------------------------------------------
// PASO 2 de 3 (antes ejecuta supabase/datos-prueba.sql en el SQL Editor;
// después, supabase/fechas-datos-prueba.sql).
// Uso, desde la carpeta del repositorio:   node supabase/sembrar-datos-prueba.mjs
//
// · Usa la URL y la clave publicable de js/config.js (no necesita la secreta).
// · Entra como cada alumno y cada asesor de prueba, igual que en la app, así
//   que también comprueba que las reglas de seguridad (RLS) funcionan.
//   1. Módulo 4: el alumno sube su tesina (PDF de supabase/datos-prueba/)
//      y el asesor deja observaciones.
//   2. Módulo 1: el alumno sube los documentos de su expediente (PDF que
//      genera este script) y el asesor los aprueba o pide corrección.
//   3. Módulo 3: el asesor evalúa el checklist de pre-auditoría, guarda el
//      dictamen, agenda citas y deja avisos al alumno.
// · Lo que ya existe se omite o se actualiza: se puede ejecutar de nuevo.
// · No necesita instalar nada: solo Node 18 o superior.
// ==========================================================================
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const CARPETA_PDF = new URL('./datos-prueba/', import.meta.url);

const config = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
const URL_SB = process.env.SUPABASE_URL || config.match(/supabaseUrl:\s*'([^']+)'/)?.[1];
const CLAVE = process.env.SUPABASE_KEY || config.match(/supabaseKey:\s*'([^']+)'/)?.[1];
const CONTRASENA = 'Prueba2026';
const ASESOR1 = 'prueba.asesor1@sigep-pruebas.mx';
const ASESOR2 = 'prueba.asesor2@sigep-pruebas.mx';
const REQ = 'Requiere corrección';
const APR = 'Aprobada';

// --------------------------------------------------------------------------
// Plan: qué versiones sube cada alumno y qué responde su asesor
// --------------------------------------------------------------------------
const PLAN = [
  {
    correo: 'prueba.alumno01@sigep-pruebas.mx', asesor: ASESOR1, apellido: 'Ramirez',
    titulo: 'Sistema de inventarios para una PyME de alimentos',
    versiones: [
      { comentario: 'Primer borrador: introducción y planteamiento del problema.',
        obs: ['El planteamiento es claro, pero faltan los objetivos específicos y la justificación.', REQ] },
      { comentario: 'Agregué los objetivos específicos y la justificación.',
        obs: ['Bien. Ahora corrige las citas: deben ir en formato APA 7.', REQ] },
      { comentario: 'Corregí todas las citas a APA 7 y agregué las conclusiones.',
        obs: ['Excelente trabajo. La tesina queda aprobada.', APR] },
    ],
  },
  {
    correo: 'prueba.alumno02@sigep-pruebas.mx', asesor: ASESOR1, apellido: 'Hernandez',
    titulo: 'Aplicación móvil para el control de mantenimiento industrial',
    versiones: [
      { comentario: 'Capítulos 1 y 2.', obs: ['El marco teórico necesita al menos cinco fuentes recientes.', REQ] },
      { comentario: 'Amplié el marco teórico con seis fuentes de 2022 a 2026.' },
    ],
  },
  {
    correo: 'prueba.alumno03@sigep-pruebas.mx', asesor: ASESOR1, apellido: 'Flores',
    titulo: 'Tablero de indicadores de calidad en una línea de producción',
    versiones: [{ comentario: 'Primera entrega completa de la tesina.' }],
  },
  // prueba.alumno04: con asesor, pero todavía sin entregas
  {
    correo: 'prueba.alumno05@sigep-pruebas.mx', asesor: ASESOR2, apellido: 'Castillo',
    titulo: 'Plataforma web de reservaciones para un hotel boutique',
    versiones: [
      { comentario: 'Borrador con la metodología.', obs: ['Describe mejor la población y la muestra del estudio.', REQ] },
      { comentario: 'Detallé la muestra y agregué el cuestionario en los anexos.',
        obs: ['Aprobada. Muy buen análisis de resultados.', APR] },
    ],
  },
  {
    correo: 'prueba.alumno06@sigep-pruebas.mx', asesor: ASESOR2, apellido: 'Ruiz',
    titulo: 'Monitoreo de consumo energético con IoT',
    versiones: [
      { comentario: 'Introducción y diagrama de la arquitectura.', obs: ['Falta el diagrama eléctrico de los sensores.', REQ] },
      { comentario: 'Agregué el diagrama eléctrico.', obs: ['Las gráficas de consumo no tienen unidades.', REQ] },
      { comentario: 'Corregí las gráficas y agregué la tabla de costos.',
        obs: ['Recibido. La reviso esta semana.', null] },
    ],
  },
  {
    correo: 'prueba.alumno07@sigep-pruebas.mx', asesor: ASESOR2, apellido: 'Morales',
    titulo: 'Rediseño del proceso de compras de una empresa automotriz',
    versiones: [{ comentario: 'Versión final revisada con mi asesor de la empresa.', obs: ['Aprobada sin cambios.', APR] }],
  },
  // prueba.alumno08: sin asesor asignado y sin entregas
];

// --------------------------------------------------------------------------
// Peticiones a Supabase (Auth, Storage y REST)
// --------------------------------------------------------------------------
async function pedir(ruta, { metodo = 'GET', token, cuerpo, tipo = 'application/json', extra = {} } = {}) {
  const r = await fetch(`${URL_SB}${ruta}`, {
    method: metodo,
    headers: { apikey: CLAVE, Authorization: `Bearer ${token || CLAVE}`, 'Content-Type': tipo, ...extra },
    body: cuerpo === undefined ? undefined : (tipo === 'application/json' ? JSON.stringify(cuerpo) : cuerpo),
  });
  const texto = await r.text();
  let datos; try { datos = JSON.parse(texto); } catch { datos = texto; }
  if (!r.ok) throw new Error(`${metodo} ${ruta.split('?')[0]} → ${r.status} ${datos?.message || datos?.msg || datos?.error_description || texto}`);
  return datos;
}

async function entrar(correo) {
  const s = await pedir('/auth/v1/token?grant_type=password', { metodo: 'POST', cuerpo: { email: correo, password: CONTRASENA } });
  return { token: s.access_token, id: s.user.id };
}

// --------------------------------------------------------------------------
// Siembra
// --------------------------------------------------------------------------
if (!URL_SB || !CLAVE) {
  console.error('No se encontraron la URL y la clave de Supabase en js/config.js.');
  process.exit(1);
}
console.log(`\nSembrando datos de prueba en ${URL_SB}\n`);

const asesores = {};
let versiones = 0;
let observaciones = 0;

for (const alumno of PLAN) {
  const sesion = await entrar(alumno.correo);
  const yaTiene = await pedir(`/rest/v1/tesina_versiones?alumno_id=eq.${sesion.id}&select=id`, { token: sesion.token });
  if (yaTiene.length) {
    console.log(`  · ${alumno.correo}: ya tiene ${yaTiene.length} ${yaTiene.length === 1 ? 'versión' : 'versiones'}, se omite.`);
    continue;
  }
  const [perfil] = await pedir(`/rest/v1/alumnos?id=eq.${sesion.id}&select=nombre,matricula`, { token: sesion.token });
  asesores[alumno.asesor] ||= await entrar(alumno.asesor);

  for (const [i, v] of alumno.versiones.entries()) {
    const numero = i + 1;
    const nombreArchivo = `Tesina_${alumno.apellido}_v${numero}.pdf`;
    const archivo = readFileSync(new URL(nombreArchivo, CARPETA_PDF));

    // 1) El alumno sube el archivo a su carpeta y lo registra como versión
    const ruta = `${sesion.id}/${randomUUID()}.pdf`;
    await pedir(`/storage/v1/object/tesinas/${ruta}`, { metodo: 'POST', token: sesion.token, cuerpo: archivo, tipo: 'application/pdf' });
    const [version] = await pedir('/rest/v1/tesina_versiones', {
      metodo: 'POST', token: sesion.token, extra: { Prefer: 'return=representation' },
      cuerpo: {
        alumno_id: sesion.id, numero: 1, archivo_path: ruta, nombre_archivo: nombreArchivo,
        tipo: 'application/pdf', tamano_bytes: archivo.length, comentario: v.comentario,
      },
    });
    versiones++;

    // 2) El asesor deja su observación (y cambia el estado si corresponde)
    let detalle = 'En revisión';
    if (v.obs) {
      const [texto, estado] = v.obs;
      await pedir('/rest/v1/rpc/observar_version', {
        metodo: 'POST', token: asesores[alumno.asesor].token,
        cuerpo: { p_version: version.id, p_texto: texto, p_estado: estado },
      });
      observaciones++;
      detalle = estado || 'En revisión (con observación)';
    }
    console.log(`  ✔ ${perfil.nombre} · versión ${version.numero} · ${detalle}`);
  }
}

console.log(`\nMódulo 4 listo: ${versiones} versiones y ${observaciones} observaciones nuevas.`);

// ==========================================================================
// MÓDULO 1 · Expediente digital
// ==========================================================================
// PDF sencillo de una página (texto en Helvetica), sin librerías
function pdfSimple(titulo, lineas) {
  const esc = (t) => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const texto = [
    'BT /F2 16 Tf 72 720 Td 22 TL', `(${esc(titulo)}) Tj T*`, '/F1 11 Tf 16 TL T*',
    ...lineas.map((l) => `(${esc(l)}) Tj T*`), 'ET',
  ].join('\n');
  const contenido = Buffer.from(texto, 'latin1');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  const partes = [];
  let largo = 0;
  const agregar = (buf) => { partes.push(buf); largo += buf.length; };
  agregar(Buffer.from('%PDF-1.4\n', 'latin1'));
  const posiciones = [];
  objetos.forEach((o, i) => { posiciones.push(largo); agregar(Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1')); });
  posiciones.push(largo);
  agregar(Buffer.concat([
    Buffer.from(`6 0 obj\n<< /Length ${contenido.length} >>\nstream\n`, 'latin1'),
    contenido,
    Buffer.from('\nendstream\nendobj\n', 'latin1'),
  ]));
  const xref = largo;
  const filas = posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('');
  agregar(Buffer.from(`xref\n0 7\n0000000000 65535 f \n${filas}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(partes);
}

const TIPOS_DOC = {
  1: { nombre: 'Carta de presentación', archivo: 'Carta_presentacion',
       texto: (a) => ['Universidad Tecnológica de Puebla', 'Dirección de Vinculación', '', 'A quien corresponda:', '',
         `Por medio de la presente presentamos a ${a.nombre}, con matrícula ${a.matricula},`,
         `alumno(a) del nivel ${a.nivel}, quien realizará su estadía profesional en su empresa.`, '',
         'Agradecemos de antemano las facilidades otorgadas.', '', 'Atentamente,', 'Coordinación de Estadías'] },
  2: { nombre: 'Carta de aceptación', archivo: 'Carta_aceptacion',
       texto: (a) => ['Empresa receptora', '', 'Universidad Tecnológica de Puebla', 'Presente', '',
         `Informamos que ${a.nombre} (matrícula ${a.matricula}) fue aceptado(a) para realizar`,
         'su estadía profesional del 8 de septiembre al 18 de diciembre de 2026,',
         'en un horario de 9:00 a 17:00 horas, de lunes a viernes.', '', 'Atentamente,', 'Recursos Humanos'] },
  3: { nombre: 'Seguro facultativo (IMSS)', archivo: 'Seguro_IMSS',
       texto: (a) => ['Instituto Mexicano del Seguro Social', 'Constancia de vigencia de derechos (documento de prueba)', '',
         `Nombre: ${a.nombre}`, `Matrícula escolar: ${a.matricula}`, 'Tipo de seguro: Facultativo para estudiantes',
         'Vigencia: periodo escolar septiembre - diciembre 2026', '', 'Documento generado para pruebas de SIGEP.'] },
  4: { nombre: 'Identificación oficial (INE)', archivo: 'Identificacion_INE',
       texto: (a) => ['Identificación oficial (documento de prueba)', '', `Nombre: ${a.nombre}`,
         'Este archivo sustituye a la credencial de elector en los datos de prueba.', 'No contiene datos personales reales.'] },
};
const APROBADO = 'Aprobado';
const CORREGIR = 'Requiere corrección';

// Qué documentos sube cada alumno y qué decide su asesor.
// Cada documento: [tipo, revisión de v1, revisión de v2…]; revisión:
// [estado, comentario] o null si sigue en revisión
const PLAN_M1 = [
  { correo: 'prueba.alumno01@sigep-pruebas.mx', asesor: ASESOR1, docs: [
    [1, [APROBADO]], [2, [APROBADO]], [3, [APROBADO]], [4, [APROBADO, 'Todo en orden.']]] },
  { correo: 'prueba.alumno02@sigep-pruebas.mx', asesor: ASESOR1, docs: [
    [1, [APROBADO]], [2, [CORREGIR, 'La carta no tiene la firma del responsable de la empresa.'], null], [3, [APROBADO]]] },
  { correo: 'prueba.alumno03@sigep-pruebas.mx', asesor: ASESOR1, docs: [[1, null], [2, null]] },
  { correo: 'prueba.alumno04@sigep-pruebas.mx', asesor: ASESOR1, docs: [
    [1, [CORREGIR, 'El nombre de la empresa está incompleto. Pide una carta nueva.']]] },
  { correo: 'prueba.alumno05@sigep-pruebas.mx', asesor: ASESOR2, docs: [
    [1, [APROBADO]], [2, [APROBADO]], [3, [APROBADO]], [4, null]] },
  { correo: 'prueba.alumno06@sigep-pruebas.mx', asesor: ASESOR2, docs: [
    [1, [APROBADO]], [3, [CORREGIR, 'La constancia del IMSS está vencida.'], [APROBADO, 'Ahora sí está vigente.']]] },
  { correo: 'prueba.alumno07@sigep-pruebas.mx', asesor: ASESOR2, docs: [
    [1, [APROBADO]], [2, [APROBADO]], [3, [APROBADO]], [4, [APROBADO]]] },
  { correo: 'prueba.alumno08@sigep-pruebas.mx', asesor: null, docs: [[1, null]] }, // sin asesor: queda en revisión
  { correo: 'prueba.alumno09@sigep-pruebas.mx', asesor: ASESOR2, docs: [[1, [APROBADO]], [4, null]] },
  { correo: 'prueba.alumno10@sigep-pruebas.mx', asesor: ASESOR1, docs: [
    [1, [APROBADO]], [2, [APROBADO]], [3, [CORREGIR, 'Sube la constancia completa, no solo la primera hoja.']]] },
];

let documentosM1 = 0;
let revisionesM1 = 0;
console.log('\nMódulo 1 · expedientes');
for (const plan of PLAN_M1) {
  const sesion = await entrar(plan.correo);
  const [alumno] = await pedir(`/rest/v1/alumnos?id=eq.${sesion.id}&select=nombre,matricula,nivel`, { token: sesion.token });
  const expediente = await pedir('/rest/v1/rpc/mi_expediente', { metodo: 'POST', token: sesion.token, cuerpo: {} });
  const expedienteId = Array.isArray(expediente) ? expediente[0]?.id : expediente?.id;
  const yaTiene = await pedir(`/rest/v1/documentos?expediente_id=eq.${expedienteId}&select=id`, { token: sesion.token });
  if (yaTiene.length) {
    console.log(`  · ${alumno.nombre}: ya tiene ${yaTiene.length} documento(s), se omite.`);
    continue;
  }
  const asesor = plan.asesor ? (asesores[plan.asesor] ||= await entrar(plan.asesor)) : null;

  for (const [tipo, ...revisiones] of plan.docs) {
    const info = TIPOS_DOC[tipo];
    for (let v = 0; v < revisiones.length; v++) {
      const nombreArchivo = `${info.archivo}_${alumno.matricula}${v ? `_v${v + 1}` : ''}.pdf`;
      const ruta = `${sesion.id}/${randomUUID()}.pdf`;
      await pedir(`/storage/v1/object/expedientes/${ruta}`, {
        metodo: 'POST', token: sesion.token, cuerpo: pdfSimple(info.nombre, info.texto(alumno)), tipo: 'application/pdf',
      });
      const doc = await pedir('/rest/v1/rpc/subir_documento', {
        metodo: 'POST', token: sesion.token, cuerpo: { p_tipo: tipo, p_path: ruta, p_nombre: nombreArchivo },
      });
      documentosM1++;
      const revision = revisiones[v];
      const documentoId = Array.isArray(doc) ? doc[0]?.id : doc?.id;
      if (revision && asesor) {
        await pedir('/rest/v1/rpc/revisar_documento', {
          metodo: 'POST', token: asesor.token,
          cuerpo: { p_documento: documentoId, p_estado: revision[0], p_comentario: revision[1] || null },
        });
        revisionesM1++;
      }
      console.log(`  ✔ ${alumno.nombre} · ${info.nombre} v${v + 1} · ${revision && asesor ? revision[0] : 'En revisión'}`);
    }
  }
}
console.log(`Módulo 1 listo: ${documentosM1} documentos y ${revisionesM1} revisiones nuevas.`);

// ==========================================================================
// MÓDULO 3 · Pre-auditoría (checklist, dictamen, citas y avisos)
// ==========================================================================
const CRITERIOS = [
  ['portada', 'Título y datos generales', 1], ['planteamiento', 'Planteamiento del problema', 1],
  ['objetivos', 'Objetivos general y específicos', 2], ['justificacion', 'Justificación', 2],
  ['marco', 'Marco teórico y antecedentes', 2], ['metodologia', 'Metodología', 3],
  ['cronograma', 'Cronograma de actividades', 3], ['referencias', 'Referencias en formato APA', 3],
  ['conclusiones', 'Conclusiones', 3], ['formato', 'Formato, ortografía y citas', 1],
];
// Criterios que no cumple una versión con correcciones (según su número)
const FALTAN = { 1: ['marco', 'cronograma', 'referencias', 'conclusiones'], 2: ['referencias', 'conclusiones'], 3: ['formato'] };
const ESTADO_M3 = { 'Aprobada': 'Aprobada', 'Requiere corrección': 'Requiere Correcciones', 'En revisión': 'Pendiente' };
const DIA = 86400000;
let filasM3 = 0;

console.log('\nMódulo 3 · pre-auditoría');
for (const correoAsesor of [ASESOR1, ASESOR2]) {
  const asesor = (asesores[correoAsesor] ||= await entrar(correoAsesor));
  const alumnos = await pedir('/rest/v1/alumnos?select=id,nombre,matricula&order=matricula', { token: asesor.token });
  const obs = await pedir('/rest/v1/tesina_observaciones?select=version_id,texto,creado_en&order=creado_en', { token: asesor.token });
  const dictamenes = [];
  const evaluaciones = [];
  const notificaciones = [];
  const citas = [];

  for (const alumno of alumnos) {
    const versionesAlumno = await pedir(`/rest/v1/tesina_versiones?alumno_id=eq.${alumno.id}&select=id,numero,estado&order=numero`, { token: asesor.token });
    const n = Number(alumno.matricula.slice(-2));

    for (const v of versionesAlumno) {
      // La última versión «En revisión» queda sin evaluar: es la que el asesor tiene por revisar
      const ultima = v.numero === versionesAlumno.length;
      if (v.estado === 'En revisión' && ultima) continue;
      const faltan = v.estado === 'Aprobada' ? [] : (FALTAN[v.numero] || ['formato']);
      CRITERIOS.forEach(([id, criterio, pagina]) => evaluaciones.push({
        id: `${v.id}__${id}`, alumno_id: alumno.id, version_id: v.id, version_numero: v.numero,
        criterio_id: id, criterio, cumple: !faltan.includes(id), pagina,
        nota: faltan.includes(id) ? 'Pendiente de corregir en la siguiente versión.' : 'Cumple con el criterio.',
      }));
      const texto = obs.filter((o) => o.version_id === v.id).map((o) => o.texto).pop() || '';
      dictamenes.push({ id: v.id, alumno_id: alumno.id, version_id: v.id, version_numero: v.numero,
        estado: ESTADO_M3[v.estado] || 'Pendiente', observacion: texto });
      if (v.estado !== 'En revisión') notificaciones.push({
        id: Number(alumno.matricula) * 100 + v.numero, alumno_id: alumno.id, version_id: v.id,
        titulo: v.estado === 'Aprobada' ? `Tu versión ${v.numero} ha sido aprobada` : `Nueva observación disponible en V${v.numero}`,
        cuerpo: texto || 'Revisa el dictamen de tu asesor.', leida: !ultima,
      });
    }

    // Citas: una ya realizada y (casi siempre) otra programada para los próximos días
    citas.push({ id: `cita-prueba-${alumno.matricula}-1`, alumno_id: alumno.id, asesor_id: asesor.id,
      fecha: new Date(Date.now() - (10 + n) * DIA).toISOString(), motivo: 'Revisión del plan de trabajo', estado: 'Completada' });
    if (n % 3 !== 0) citas.push({ id: `cita-prueba-${alumno.matricula}-2`, alumno_id: alumno.id, asesor_id: asesor.id,
      fecha: new Date(Date.now() + (n % 6 + 1) * DIA + 3600000 * (n % 4)).toISOString(),
      motivo: versionesAlumno.length ? 'Revisión de la tesina' : 'Seguimiento: aún no hay entregas', estado: 'Programada' });
  }

  for (const [tabla, filas] of [['dictamenes', dictamenes], ['evaluaciones_checklist', evaluaciones], ['notificaciones', notificaciones], ['citas', citas]]) {
    if (!filas.length) continue;
    await pedir(`/rest/v1/${tabla}?on_conflict=id`, {
      metodo: 'POST', token: asesor.token, cuerpo: filas, extra: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
    filasM3 += filas.length;
  }
  console.log(`  ✔ ${correoAsesor}: ${alumnos.length} alumnos · ${dictamenes.length} dictámenes · ${evaluaciones.length} criterios · ${citas.length} citas · ${notificaciones.length} avisos`);
}
console.log(`Módulo 3 listo: ${filasM3} renglones guardados o actualizados.`);

console.log('\nÚltimo paso: ejecuta supabase/fechas-datos-prueba.sql en el SQL Editor para repartir las fechas.');
console.log('Cuentas: prueba.alumno01…10@sigep-pruebas.mx y prueba.asesor1…2@sigep-pruebas.mx · contraseña Prueba2026');
