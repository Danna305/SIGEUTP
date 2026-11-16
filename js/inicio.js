/* =====================================================================
   SIGEP · Página de inicio
   - Menú en celular (botón con aria-expanded, Escape lo cierra)
   - Cambia "Iniciar sesión" por "Ir a mi panel" si ya hay sesión
   - Registra el service worker (sw.js)
   - Botón "Instalar app" (solo aparece si el navegador lo permite)
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- Menú en celular ---------- */
  var boton = document.querySelector('.menu-boton');
  var menu = document.getElementById('menu-principal');

  function menuAbierto() {
    return boton && boton.getAttribute('aria-expanded') === 'true';
  }

  function ponerMenu(abrir, devolverFoco) {
    if (!boton || !menu) return;
    boton.setAttribute('aria-expanded', String(abrir));
    menu.classList.toggle('abierto', abrir);
    if (!abrir && devolverFoco) boton.focus();
  }

  if (boton && menu) {
    boton.addEventListener('click', function () {
      ponerMenu(!menuAbierto(), false);
    });

    // Al elegir una sección, se cierra el menú
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) ponerMenu(false, false);
    });

    // Escape cierra el menú y regresa el foco al botón
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuAbierto()) ponerMenu(false, true);
    });

    // Clic fuera del encabezado cierra el menú
    document.addEventListener('click', function (e) {
      if (menuAbierto() && !e.target.closest('.encabezado')) ponerMenu(false, false);
    });

    // Si la ventana se agranda a escritorio, se reinicia el estado
    var escritorio = window.matchMedia('(min-width: 1201px)');
    var alCambiar = function (mq) { if (mq.matches) ponerMenu(false, false); };
    if (escritorio.addEventListener) escritorio.addEventListener('change', alCambiar);
    else if (escritorio.addListener) escritorio.addListener(alCambiar);
  }

  /* ---------- Sesión compartida ---------- */
  try {
    if (window.localStorage && localStorage.getItem('estadias-sesion')) {
      var sesion = document.querySelectorAll('.encabezado [data-sesion]');
      for (var i = 0; i < sesion.length; i++) sesion[i].textContent = 'Ir a mi panel';
    }
  } catch (err) {
    // Sin acceso a localStorage (modo privado o bloqueado): se deja el texto original
  }

  /* ---------- Service worker ---------- */
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* sin service worker */ });
    });
  }

  /* ---------- Instalar app ---------- */
  var botonesInstalar = document.querySelectorAll('[data-instalar]');
  var aviso = null;

  function mostrarInstalar(ver) {
    for (var j = 0; j < botonesInstalar.length; j++) botonesInstalar[j].hidden = !ver;
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    aviso = e;
    mostrarInstalar(true);
  });

  for (var k = 0; k < botonesInstalar.length; k++) {
    botonesInstalar[k].addEventListener('click', function () {
      if (!aviso) return;
      var pendiente = aviso;
      aviso = null;
      mostrarInstalar(false);
      pendiente.prompt();
      if (pendiente.userChoice) pendiente.userChoice.catch(function () {});
    });
  }

  window.addEventListener('appinstalled', function () {
    aviso = null;
    mostrarInstalar(false);
  });
})();
