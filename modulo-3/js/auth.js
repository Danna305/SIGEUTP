/* =====================================================================
   SIGEP UTP · Módulo 3 · Sesión con Supabase Auth
   ---------------------------------------------------------------------
   Usa el mismo Supabase y la misma sesión que los módulos 1 y 4
   (storageKey compartido): si ya entraste en otro módulo, aquí entras
   directo. Antes el módulo tenía una tabla «usuarios» con contraseñas.

   Expone window.SIGEPAuth:
     cliente           cliente de Supabase con la sesión del usuario
     sesionActual()    { rol, nombre, correo, userId } (síncrono, de la copia local)
     verificar(rol?)   confirma la sesión y el rol; si no hay, manda al login
     rolDe(userId)     'asesor' | 'alumno' | null (consulta Supabase)
     cerrarSesion()
   Depende de ../../js/vendor/supabase.js y ../../js/config.js (raíz del repo).
   ===================================================================== */
(() => {
  'use strict';

  const CLAVE = 'sigep_sesion'; // copia local del perfil (para trabajar sin conexión)
  const config = (window.App && window.App.config) || {};
  const storageKey = config.storageKey || 'estadias-sesion';

  let cliente = null;
  if (window.supabase && config.supabaseUrl && config.supabaseKey) {
    cliente = window.supabase.createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey }
    });
    window.supabaseClient = cliente;
  } else {
    console.warn('[SIGEP] Falta js/config.js o la librería de Supabase.');
  }

  // Lee el usuario de la sesión guardada por Supabase (sin red)
  function usuarioGuardado() {
    try {
      const datos = JSON.parse(localStorage.getItem(storageKey) || 'null');
      return (datos && (datos.user || (datos.currentSession && datos.currentSession.user))) || null;
    } catch (error) {
      return null;
    }
  }

  function perfilGuardado() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE) || 'null');
    } catch (error) {
      return null;
    }
  }

  function sesionActual() {
    const usuario = usuarioGuardado();
    const perfil = perfilGuardado();
    if (!usuario || !perfil || perfil.userId !== usuario.id) return null;
    return perfil;
  }

  async function rolDe(userId) {
    if (!cliente) return null;
    const [asesor, alumno] = await Promise.all([
      cliente.from('asesores').select('id, nombre, correo').eq('id', userId).maybeSingle(),
      cliente.from('alumnos').select('id, nombre, correo').eq('id', userId).maybeSingle()
    ]);
    if (asesor.error && alumno.error) throw asesor.error;
    if (asesor.data) return { rol: 'asesor', ...asesor.data };
    if (alumno.data) return { rol: 'alumno', ...alumno.data };
    return null;
  }

  function raiz() {
    const manifest = document.querySelector('link[rel="manifest"]');
    return manifest ? new URL('./', manifest.href) : new URL('../', document.baseURI);
  }

  function irAlLogin(motivo) {
    const destino = new URL('Frontend/login.html', raiz());
    if (motivo) destino.searchParams.set('motivo', motivo);
    location.replace(destino.href);
  }

  function irA(rol) {
    location.replace(new URL(rol === 'asesor' ? 'Frontend/modulo-3.html' : 'Frontend/alumno.html', raiz()).href);
  }

  // Confirma la sesión. Sin conexión se confía en la copia local.
  async function verificar(rolEsperado) {
    if (!cliente) { irAlLogin(); return null; }
    const { data } = await cliente.auth.getSession();
    const usuario = data.session && data.session.user;
    if (!usuario) { irAlLogin(); return null; }

    let perfil = sesionActual();
    if (navigator.onLine || !perfil) {
      try {
        const datos = await rolDe(usuario.id);
        if (!datos) { irAlLogin('sin-rol'); return null; }
        perfil = { rol: datos.rol, nombre: datos.nombre, correo: datos.correo || usuario.email, userId: usuario.id };
        localStorage.setItem(CLAVE, JSON.stringify(perfil));
      } catch (error) {
        if (!perfil) { irAlLogin(); return null; }
      }
    }
    if (rolEsperado && perfil.rol !== rolEsperado) { irA(perfil.rol); return null; }
    return perfil;
  }

  async function cerrarSesion() {
    try { localStorage.removeItem(CLAVE); } catch (error) { /* sin almacenamiento */ }
    if (cliente) await cliente.auth.signOut({ scope: 'local' }).catch(() => {});
  }

  window.SIGEPAuth = { cliente, sesionActual, verificar, rolDe, cerrarSesion, irA, irAlLogin, storageKey, CLAVE };
})();
