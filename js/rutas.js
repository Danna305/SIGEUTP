/* =====================================================================
   SIGEP · Rutas compartidas de la plataforma
   ---------------------------------------------------------------------
   Toda la aplicación usa un solo inicio de sesión (login.html) y una sola
   sesión de Supabase. Este archivo dice, desde cualquier página, dónde
   está el acceso y cuál es la pantalla de inicio de cada rol:

     SIGEP.rutas.login        acceso único (iniciar sesión, registro, recuperar)
     SIGEP.rutas.sitio        página principal del producto
     SIGEP.inicioDe(rol)      'alumno' | 'asesor' | 'coordinacion' → URL de su inicio
     SIGEP.irAlLogin()        lleva al acceso (por ejemplo, al cerrar sesión)

   Las URL se calculan a partir de la ubicación de este archivo (js/rutas.js
   está en la raíz), así funcionan igual en localhost y en GitHub Pages.
   ===================================================================== */
(() => {
  'use strict';
  const script = document.currentScript;
  const raiz = new URL('../', script ? script.src : location.href);
  const url = (ruta) => new URL(ruta, raiz).href;

  const rutas = {
    raiz: raiz.href,
    sitio: url('index.html'),
    login: url('login.html'),
    alumno: url('modulo-4/alumno.html#inicio'),
    asesor: url('modulo-4/asesor.html#alumnos'),
    coordinacion: url('modulo-2/index.html#/app/dashboard'),
  };

  window.SIGEP = {
    rutas,
    url,
    inicioDe: (rol) => rutas[rol] || rutas.login,
    irAlLogin: (motivo) => {
      const destino = new URL(rutas.login);
      if (motivo) destino.searchParams.set('motivo', motivo);
      location.replace(destino.href);
    },
  };
})();
