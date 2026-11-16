/* ==========================================================================
   estadia.js — La estadía completa en un solo lugar (inicio integrado)
   --------------------------------------------------------------------------
   Junta lo que el alumno hace en toda la plataforma y lo muestra en su
   inicio y en el del asesor:
     · Resumen: expediente (documentos subidos y aprobados), tesina (última
       versión), pre-auditoría (último dictamen) y próxima cita.
     · Trazabilidad: una sola línea de tiempo con cada paso, su fecha y quién
       lo hizo (asignación de asesor, documentos del expediente, versiones de
       la tesina, observaciones, dictámenes y citas).
     · Asesor: pendientes de hoy en todas las áreas y la línea de tiempo de
       cada alumno en su detalle (#alumno/<id>).
   Los datos salen de Supabase con las reglas RLS de siempre (cada quien solo
   ve lo suyo) y se guardan en la caché para consultarlos sin conexión.
   Depende de auth.js, cache-api.js, panel.js (App.ui) y ../js/rutas.js.
   ========================================================================== */
App.estadia = (() => {
  'use strict';

  const { auth, cacheApi, ui } = App;
  const esc = ui.esc;
  const ir = (ruta) => SIGEP.url(ruta);
  const DOC_ESTADO = { 'En revisión': 'warn', 'Aprobado': 'ok', 'Requiere corrección': 'bad' };
  const chipDoc = (estado) => `<span class="chip ${DOC_ESTADO[estado] || ''}">${esc(estado)}</span>`;
  const normalizar = (e) => ({ Pendiente: 'En revisión', 'Requiere Correcciones': 'Requiere corrección' }[e] || e);
  const datos = (r) => (r && !r.error && r.data) || [];

  /* ---------- Lectura de todo lo del alumno ---------- */
  async function leer(alumnoId) {
    const c = auth.cliente;
    const exp = await c.from('expedientes').select('id, estado_general').eq('alumno_id', alumnoId).maybeSingle();
    const expediente = exp.data || null;
    const [tipos, docs, versiones, dictamenes, citas, asignacion] = await Promise.all([
      c.from('tipos_documento').select('id, nombre').order('id'),
      expediente ? c.from('documentos').select('id, tipo_documento_id, estado, version, fecha_subida').eq('expediente_id', expediente.id) : null,
      c.from('tesina_versiones').select('id, numero, estado, subida_en, tesina_observaciones (creado_en, estado_asignado)').eq('alumno_id', alumnoId).order('numero'),
      c.from('dictamenes').select('version_numero, estado, actualizado').eq('alumno_id', alumnoId).order('actualizado', { ascending: false }),
      c.from('citas').select('fecha, motivo, estado').eq('alumno_id', alumnoId).order('fecha'),
      c.from('asignaciones_asesor').select('asignado_en, asesores (nombre)').eq('alumno_id', alumnoId).maybeSingle(),
    ]);
    const documentos = datos(docs);
    const historial = documentos.length
      ? datos(await c.from('historial_documentos').select('documento_id, accion, usuario, fecha').in('documento_id', documentos.map((d) => d.id)).order('fecha'))
      : [];
    return {
      expediente,
      tipos: datos(tipos),
      documentos,
      historial,
      versiones: datos(versiones),
      dictamenes: datos(dictamenes).map((d) => ({ ...d, estado: normalizar(d.estado) })),
      citas: datos(citas),
      asignacion: asignacion && asignacion.data,
    };
  }

  // Con conexión se lee y se guarda; sin conexión, la última copia guardada
  async function obtener(alumnoId) {
    const clave = `estadia-${alumnoId}`;
    try {
      const d = await leer(alumnoId);
      await cacheApi.guardar(clave, d).catch(() => {});
      return d;
    } catch (e) {
      const copia = await cacheApi.leer(clave).catch(() => null);
      if (copia) return copia.datos;
      throw e;
    }
  }

  /* ---------- Línea de tiempo (trazabilidad) ---------- */
  function eventos(d, rol, alumnoId) {
    const nombreTipo = new Map(d.tipos.map((t) => [t.id, t.nombre]));
    const tipoDe = new Map(d.documentos.map((x) => [x.id, nombreTipo.get(x.tipo_documento_id) || 'Documento']));
    const esAlumno = rol === 'alumno';
    const enlaces = esAlumno
      ? { doc: ir('modulo-1/modulo-1.html#historial'), tesina: '#tesina', pre: ir('modulo-3/Frontend/alumno.html'), cita: ir('modulo-3/Frontend/alumno.html#citas') }
      : { doc: ir('modulo-1/modulo-1.html#historial'), tesina: `#alumno/${alumnoId}`, pre: ir(`modulo-3/Frontend/modulo-3.html?alumno=${encodeURIComponent(alumnoId)}#preauditoria`), cita: ir('modulo-3/Frontend/modulo-3.html#citas') };
    const lista = [];
    if (d.asignacion) {
      lista.push({ fecha: d.asignacion.asignado_en, icono: 'userCheck', area: 'Asignación',
        titulo: `Asesor asignado: ${d.asignacion.asesores?.nombre || 'asesor'}`, detalle: 'Coordinación de estadías', enlace: esAlumno ? '#asesor' : null });
    }
    d.historial.forEach((h) => lista.push({
      fecha: h.fecha, icono: /Revisión/.test(h.accion) ? 'checkCircle' : 'upload', area: 'Expediente',
      titulo: `${tipoDe.get(h.documento_id) || 'Documento'}: ${h.accion.replace('Revisión: ', '')}`, detalle: h.usuario, enlace: enlaces.doc,
    }));
    d.versiones.forEach((v) => {
      lista.push({ fecha: v.subida_en, icono: 'file', area: 'Tesina', titulo: `Versión ${v.numero} de la tesina subida`, detalle: esAlumno ? 'Tú' : 'Alumno', enlace: enlaces.tesina });
      (v.tesina_observaciones || []).forEach((o) => lista.push({
        fecha: o.creado_en, icono: 'message', area: 'Tesina',
        titulo: `Observación en la versión ${v.numero}${o.estado_asignado ? ` · ${o.estado_asignado}` : ''}`, detalle: 'Asesor', enlace: enlaces.tesina,
      }));
    });
    d.dictamenes.filter((x) => x.estado !== 'En revisión').forEach((x) => lista.push({
      fecha: x.actualizado, icono: 'clipboard', area: 'Pre-auditoría',
      titulo: `Dictamen de pre-auditoría (versión ${x.version_numero || '—'}): ${x.estado}`, detalle: 'Asesor', enlace: enlaces.pre,
    }));
    d.citas.forEach((c) => lista.push({
      fecha: c.fecha, icono: 'calendar', area: 'Citas',
      titulo: `${c.estado === 'Completada' ? 'Cita realizada' : 'Cita programada'}: ${c.motivo}`, detalle: c.estado, enlace: enlaces.cita, futura: new Date(c.fecha) > new Date(),
    }));
    return lista.filter((e) => e.fecha).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }

  function pintarTraza(contenedor, lista, limite = 12) {
    if (!lista.length) {
      ui.pintar(contenedor, '<p class="empty">Todavía no hay movimientos en la estadía.</p>');
      return;
    }
    const fila = (e) => `
      <li class="traza-item${e.futura ? ' futura' : ''}">
        <span class="ic-box"><i data-ic="${e.icono}" data-s="16"></i></span>
        <div class="grow"><b>${esc(e.titulo)}</b>
          <small><span class="chip">${esc(e.area)}</span> ${esc(ui.fechaHora(e.fecha))}${e.detalle ? ` · ${esc(e.detalle)}` : ''}</small></div>
        ${e.enlace ? `<a class="btn out xs" href="${esc(e.enlace)}">Ver</a>` : ''}
      </li>`;
    ui.pintar(contenedor, `<ol class="traza">${lista.slice(0, limite).map(fila).join('')}</ol>
      ${lista.length > limite ? `<button class="btn out sm" type="button" data-traza-todo>Ver los ${lista.length} movimientos</button>` : ''}`);
    contenedor.querySelector('[data-traza-todo]')?.addEventListener('click', () => pintarTraza(contenedor, lista, lista.length));
  }

  /* ---------- Resumen de la estadía ---------- */
  function resumen(d) {
    const total = d.tipos.length || 4;
    const subidos = d.documentos.length;
    const aprobados = d.documentos.filter((x) => x.estado === 'Aprobado').length;
    const correccion = d.documentos.filter((x) => x.estado === 'Requiere corrección').length;
    const ultima = d.versiones[d.versiones.length - 1];
    const dictamen = d.dictamenes[0];
    const proxima = d.citas.find((c) => c.estado === 'Programada' && new Date(c.fecha) > new Date());
    return { total, subidos, aprobados, correccion, ultima, dictamen, proxima };
  }

  // Inicio del alumno: tarjetas que llevan a cada parte de su estadía
  async function alumno({ resumen: zonaResumen, traza: zonaTraza, pendientes }) {
    const id = (await auth.cliente.auth.getSession()).data.session?.user.id;
    if (!id) return;
    let d;
    try { d = await obtener(id); } catch { return; }
    const r = resumen(d);
    const pct = Math.round((r.subidos / r.total) * 100);
    const pctOk = Math.round((r.aprobados / r.total) * 100);
    ui.pintar(zonaResumen, `
      <a class="estadia-paso" href="${ir('modulo-1/modulo-1.html#documentos')}">
        <span class="ic-box"><i data-ic="folder"></i></span>
        <span class="grow"><b>Mi expediente</b><small>${r.subidos} de ${r.total} documentos subidos · ${r.aprobados} aprobados</small>
          <span class="estadia-barra" role="img" aria-label="${pct}% subido, ${pctOk}% aprobado"><i style="width:${pct}%"></i><i class="ok" style="width:${pctOk}%"></i></span></span>
        ${r.correccion ? '<span class="chip bad">Corregir</span>' : d.expediente?.estado_general === 'Completo' ? '<span class="chip ok">Completo</span>' : `<span class="chip">${pct}%</span>`}
      </a>
      <a class="estadia-paso" href="#tesina">
        <span class="ic-box"><i data-ic="file"></i></span>
        <span class="grow"><b>Mi tesina</b><small>${r.ultima ? `Versión ${r.ultima.numero} · subida el ${esc(ui.fecha(r.ultima.subida_en))}` : 'Aún no subes ninguna versión'}</small></span>
        ${r.ultima ? ui.chipEstado(r.ultima.estado) : '<span class="chip">Pendiente</span>'}
      </a>
      <a class="estadia-paso" href="${ir('modulo-3/Frontend/alumno.html')}">
        <span class="ic-box"><i data-ic="clipboard"></i></span>
        <span class="grow"><b>Pre-auditoría</b><small>${r.dictamen && r.dictamen.estado !== 'En revisión' ? `Dictamen de la versión ${r.dictamen.version_numero || '—'}` : 'Tu asesor aún no emite el dictamen'}</small></span>
        ${r.dictamen && r.dictamen.estado !== 'En revisión' ? ui.chipEstado(r.dictamen.estado) : '<span class="chip">En espera</span>'}
      </a>
      <a class="estadia-paso" href="${ir('modulo-3/Frontend/alumno.html#citas')}">
        <span class="ic-box"><i data-ic="calendar"></i></span>
        <span class="grow"><b>Próxima cita</b><small>${r.proxima ? `${esc(ui.fechaHora(r.proxima.fecha))} · ${esc(r.proxima.motivo)}` : 'Sin citas programadas'}</small></span>
        <span class="chip ${r.proxima ? 'info' : ''}">${r.proxima ? 'Programada' : '—'}</span>
      </a>`);
    pintarTraza(zonaTraza, eventos(d, 'alumno', id));
    if (pendientes) pendientes(r);
  }

  /* ---------- Asesor ---------- */
  async function asesor(zona) {
    const c = auth.cliente;
    const semana = new Date(Date.now() + 7 * 864e5).toISOString();
    const [docs, versiones, citas, expedientes] = await Promise.all([
      c.from('documentos').select('id', { count: 'exact', head: true }).eq('estado', 'En revisión'),
      c.from('tesina_versiones').select('id', { count: 'exact', head: true }).eq('estado', 'En revisión'),
      c.from('citas').select('id', { count: 'exact', head: true }).eq('estado', 'Programada').gte('fecha', new Date().toISOString()).lte('fecha', semana),
      c.from('expedientes').select('estado_general'),
    ]).catch(() => []);
    if (!docs) return;
    const completos = datos(expedientes).filter((x) => x.estado_general === 'Completo').length;
    const tarjeta = (href, icono, n, texto, alerta) => `
      <a class="stat estadia-stat${alerta && n ? ' alerta' : ''}" href="${href}">
        <span class="ic-box"><i data-ic="${icono}"></i></span><b class="num">${n ?? '—'}</b><span>${texto}</span></a>`;
    ui.pintar(zona, `
      ${tarjeta(ir('modulo-1/modulo-1.html#revisar'), 'folder', docs.count, 'Documentos del expediente por revisar', true)}
      ${tarjeta('#revisar', 'file', versiones.count, 'Versiones de tesina por revisar', true)}
      ${tarjeta(ir('modulo-3/Frontend/modulo-3.html#citas'), 'calendar', citas.count, 'Citas en los próximos 7 días')}
      ${tarjeta(ir('modulo-1/modulo-1.html#revisar'), 'checkCircle', completos, 'Expedientes completos')}`);
  }

  // Línea de tiempo de un alumno en el detalle que ve su asesor
  async function trazaAlumno(alumnoId, zona) {
    ui.pintar(zona, '<p class="empty">Cargando la trazabilidad…</p>');
    try {
      const d = await obtener(alumnoId);
      pintarTraza(zona, eventos(d, 'asesor', alumnoId), 8);
    } catch {
      ui.pintar(zona, '<p class="empty">No se pudo cargar la trazabilidad. Revisa tu conexión.</p>');
    }
  }

  return { alumno, asesor, trazaAlumno, obtener };
})();
