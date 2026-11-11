/* =====================================================================
   SIGEP UTP · Radar de Estadías (cálculo de riesgo)
   El mismo archivo lo usan el servidor (Node.js) y el panel (navegador),
   así el semáforo es idéntico en los dos lados y funciona sin conexión.

   Cada alumno activo del periodo recibe de 0 a 100 puntos:
     Documentos atrasados según la semana .... 30
     Sin asesor asignado ..................... 30
     Empresa y convenio ...................... 20
     Documentos rechazados (correcciones) .... 10
     Carga del asesor ........................ 10
   Rojo (alto) >= 50 · Amarillo (medio) 25–49 · Verde (bajo) < 25
   ===================================================================== */
(function (raiz, crear) {
  if (typeof module === 'object' && module.exports) module.exports = crear();
  else raiz.Radar = crear();
})(typeof self !== 'undefined' ? self : this, function () {
  const PESOS = { documentos: 30, asesor: 30, empresa: 20, correcciones: 10, carga: 10 };
  const FACTORES = [
    ['documentos', 'Documentos atrasados según la semana'],
    ['asesor', 'Sin asesor asignado'],
    ['empresa', 'Empresa y convenio'],
    ['correcciones', 'Documentos rechazados'],
    ['carga', 'Carga del asesor']
  ];
  // Semana del periodo en la que cada documento ya debería estar aprobado
  const LIMITE_DOC = { aceptacion: 2, seguro: 3, plan: 5, parcial: 12, liberacion: 21 };
  const NOMBRE_DOC = { aceptacion: 'Carta de aceptación', seguro: 'Seguro social', plan: 'Plan de trabajo', parcial: 'Reporte parcial', liberacion: 'Carta de liberación' };

  const dias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
  const UMBRAL = { alto: 50, medio: 25 };
  const nivelDe = (p) => (p >= UMBRAL.alto ? 'alto' : p >= UMBRAL.medio ? 'medio' : 'bajo');

  function calcular(d, hoy) {
    const periodo = d.periodos.find((p) => p.estado === 'activo');
    if (!periodo) return { periodo: null, semana: 0, total: 0, conteo: { alto: 0, medio: 0, bajo: 0 }, alumnos: [] };
    const semana = Math.max(1, Math.ceil((dias(periodo.inicio, hoy) + 1) / 7));
    const asg = new Map(), carga = new Map();
    d.asignaciones_asesor.filter((g) => g.periodo_id === periodo.id).forEach((g) => {
      asg.set(g.alumno_id, g);
      carga.set(g.asesor_id, (carga.get(g.asesor_id) || 0) + 1);
    });
    const asesores = new Map(d.asesores.map((t) => [t.id, t]));
    const empresas = new Map(d.empresas.map((e) => [e.id, e]));

    // Asesor sugerido: activo, de la misma carrera, con lugar y la menor carga
    const sugerir = (alumno, excluir) => d.asesores
      .filter((t) => t.activo && t.carrera === alumno.carrera && t.id !== excluir && (carga.get(t.id) || 0) < t.capacidad)
      .sort((a, b) => (carga.get(a.id) || 0) / a.capacidad - (carga.get(b.id) || 0) / b.capacidad)[0] || null;

    const lista = d.alumnos.filter((a) => a.periodo_id === periodo.id && a.estado === 'activo').map((a) => {
      const f = { documentos: 0, asesor: 0, empresa: 0, correcciones: 0, carga: 0 };
      const motivos = [];
      // 1. Documentos que ya debían estar aprobados
      const exp = a.expediente || {};
      const vencidos = Object.keys(LIMITE_DOC).filter((k) => semana > LIMITE_DOC[k]);
      const faltan = vencidos.filter((k) => exp[k] !== 'aprobado');
      if (vencidos.length) {
        const peso = faltan.reduce((s, k) => s + (exp[k] === 'cargado' ? 0.4 : 1), 0);
        f.documentos = Math.round(PESOS.documentos * Math.min(1, peso / Math.min(vencidos.length, 4)));
      }
      if (faltan.length) motivos.push({ t: faltan.length === 1 ? `${NOMBRE_DOC[faltan[0]]} atrasado` : `${faltan.length} documentos atrasados`, n: f.documentos >= 15 ? 'alto' : 'medio' });
      // 2. Asesor
      const g = asg.get(a.id), t = g && asesores.get(g.asesor_id);
      if (!g) {
        f.asesor = semana >= 2 ? PESOS.asesor : 15;
        motivos.push({ t: 'Sin asesor', n: 'alto' });
      } else if (t && !t.activo) {
        f.asesor = 25; motivos.push({ t: 'Asesor inactivo', n: 'alto' });
      }
      // 3. Empresa y convenio
      const e = a.empresa_id && empresas.get(a.empresa_id);
      if (!e) { f.empresa = PESOS.empresa; motivos.push({ t: 'Sin empresa', n: 'medio' }); }
      else if (e.convenio === 'tramite') { f.empresa = 8; motivos.push({ t: 'Convenio en trámite', n: 'medio' }); }
      else if (!e.vence || e.vence < hoy) { f.empresa = PESOS.empresa; motivos.push({ t: 'Convenio vencido', n: 'alto' }); }
      else if (dias(hoy, e.vence) <= 45) { f.empresa = 12; motivos.push({ t: `Convenio vence en ${dias(hoy, e.vence)} días`, n: 'medio' }); }
      // 4. Correcciones pendientes
      const rech = Object.values(exp).filter((v) => v === 'rechazado').length;
      if (rech) { f.correcciones = Math.min(PESOS.correcciones, rech * 6); motivos.push({ t: rech === 1 ? 'Documento rechazado' : `${rech} documentos rechazados`, n: 'alto' }); }
      // 5. Carga del asesor
      if (t && t.activo) {
        const uso = (carga.get(t.id) || 0) / t.capacidad;
        if (uso >= 1) { f.carga = PESOS.carga; motivos.push({ t: 'Asesor al 100 %', n: 'medio' }); }
        else if (uso >= 0.9) f.carga = 6;
      }
      const puntos = Math.min(100, Object.values(f).reduce((s, x) => s + x, 0));
      // Acción sugerida
      let accion = null;
      if (!g || (t && !t.activo)) {
        const s = sugerir(a, g?.asesor_id);
        accion = s ? { tipo: 'asignar', asesor_id: s.id, asesor: s.nombre, carga: carga.get(s.id) || 0, capacidad: s.capacidad }
                   : { tipo: 'sinLugar' };
      } else if (e && (e.convenio === 'tramite' || !e.vence || e.vence < hoy || dias(hoy, e.vence) <= 45)) {
        accion = { tipo: 'convenio', empresa_id: e.id, empresa: e.nombre };
      } else if (!e) {
        accion = { tipo: 'empresa' };
      } else if (f.documentos || f.correcciones) {
        accion = { tipo: 'expediente' };
      }
      return { id: a.id, nombre: a.nombre, matricula: a.matricula, carrera: a.carrera, grupo: a.grupo,
        puntos, nivel: nivelDe(puntos), factores: f, motivos, accion, asesor: t ? t.nombre : '' };
    }).sort((x, y) => y.puntos - x.puntos || x.nombre.localeCompare(y.nombre));

    const conteo = { alto: 0, medio: 0, bajo: 0 };
    lista.forEach((x) => conteo[x.nivel]++);
    return { periodo: { id: periodo.id, nombre: periodo.nombre, fin: periodo.fin }, semana, total: lista.length,
      diasCierre: Math.max(0, dias(hoy, periodo.fin)), conteo, alumnos: lista };
  }
  return { calcular, PESOS, FACTORES, UMBRAL, nivelDe };
});
