// ====== Presentación del Módulo 1 (index.html) ======
// La lógica del expediente digital vive en js/expediente.js y usa Supabase
// (antes llamaba a un backend Express/MySQL que ya no existe).

// Cambia de sección en el menú de la presentación
function showPage(pageId) {
    document.querySelectorAll(".page-section").forEach((sec) => sec.classList.remove("active"));
    document.getElementById(pageId).classList.add("active");
    document.querySelectorAll("nav ul li a").forEach((a) => a.classList.remove("active-nav"));
    document.getElementById("nav-" + pageId).classList.add("active-nav");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Registra el service worker para que la presentación funcione sin conexión
if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => navigator.serviceWorker.register("serviceworker.js").catch(() => {}));
}
