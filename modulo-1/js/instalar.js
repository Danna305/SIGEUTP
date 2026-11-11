// Botón «Instalar app» del Módulo 1 (Chrome, Edge y Android).
// Aparece solo cuando el navegador indica que la app se puede instalar
// (evento beforeinstallprompt) y desaparece al instalarla.
// En iPhone y iPad se instala desde Compartir → «Agregar a pantalla de inicio».
(() => {
  let solicitud = null;

  function quitar() {
    const boton = document.getElementById('m1-instalar');
    if (boton) boton.remove();
  }

  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    solicitud = evento;
    if (document.getElementById('m1-instalar')) return;
    const boton = document.createElement('button');
    boton.id = 'm1-instalar';
    boton.type = 'button';
    boton.className = 'btn sm';
    boton.innerHTML = '<i data-ic="download"></i>Instalar app';
    boton.style.cssText = 'position:fixed;right:16px;bottom:max(16px, env(safe-area-inset-bottom));z-index:1050;box-shadow:var(--sombra-pop)';
    boton.addEventListener('click', async () => {
      if (!solicitud) return;
      solicitud.prompt();
      await solicitud.userChoice.catch(() => null);
      solicitud = null;
      quitar();
    });
    document.body.appendChild(boton);
    if (typeof pintarIconos === 'function') pintarIconos(boton.parentNode);
  });

  window.addEventListener('appinstalled', quitar);
})();
