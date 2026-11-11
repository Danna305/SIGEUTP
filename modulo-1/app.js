// ====== FUNCIÓN PARA CAMBIAR DE PÁGINA (Menú principal) ======
function showPage(pageId) {
    document.querySelectorAll(".page-section").forEach((sec) => sec.classList.remove("active"));
    document.getElementById(pageId).classList.add("active");
    document.querySelectorAll("nav ul li a").forEach((a) => a.classList.remove("active-nav"));
    document.getElementById("nav-" + pageId).classList.add("active-nav");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ====== FLUJO INTERNO DE LA DEMOSTRACIÓN (Portal -> Login -> Dashboard) ======
function irAlLogin() {
    document.getElementById("vista-portal").style.display = "none";
    document.getElementById("vista-login").style.display = "block";
}

function volverAlPortal() {
    document.getElementById("vista-login").style.display = "none";
    document.getElementById("vista-portal").style.display = "block";
}

function entrarAlDashboard(event) {
    event.preventDefault(); // Evita que la página se recargue al enviar el formulario
    document.getElementById("vista-login").style.display = "none";
    document.getElementById("vista-dashboard").style.display = "block";
    
    // Al entrar al dashboard, cargamos los datos reales de tu backend
    cargarTiposDocumento();
    cargarDocumentos();
}

// ============================================
// LÓGICA DEL MÓDULO 1: EXPEDIENTE DIGITAL
// ============================================

// --- CONFIGURACIÓN ---
const API_URL = "https://paginaideainnovadoraparaappestadias.onrender.com/api"; 
const EXPEDIENTE_ID = 1; // ID del expediente de prueba
let todosLosDocumentos = []; 

// --- INICIALIZACIÓN (Para los botones de filtro) ---
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".filtro-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".filtro-btn").forEach((b) => {
                b.classList.remove("active");
                b.style.borderBottom = "none";
                b.style.color = "var(--muted)";
            });
            
            e.target.classList.add("active");
            e.target.style.borderBottom = "2px solid var(--m1)";
            e.target.style.color = "var(--text)";

            const filtro = e.target.getAttribute("data-filtro");
            filtrarDocumentos(filtro);
        });
    });

    const formSubir = document.getElementById("form-subir-documento");
    if (formSubir) {
        formSubir.addEventListener("submit", subirDocumento);
    }
});

// --- FUNCIONES DE CARGA DE DATOS ---

async function cargarDocumentos() {
    const tbody = document.getElementById("tabla-documentos");
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">Cargando...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/expedientes/${EXPEDIENTE_ID}`);
        if (!response.ok) throw new Error("Error al cargar expediente");

        const data = await response.json();
        todosLosDocumentos = data.documentos;

        renderizarDocumentos(todosLosDocumentos);
        calcularProgreso(todosLosDocumentos);
    } catch (error) {
        console.error(error);
        tbody.innerHTML = `
            <tr><td colspan="3" style="text-align: center; color: #e74c3c; padding: 20px;">
                ❌ Error al conectar con el servidor.
            </td></tr>
        `;
    }
}

async function cargarTiposDocumento() {
    try {
        const response = await fetch(`${API_URL}/tipos-documento`);
        const tipos = await response.json();

        const select = document.getElementById("tipo-documento");
        select.innerHTML = '<option value="">Selecciona uno...</option>'; // Limpiar
        tipos.forEach((tipo) => {
            const option = document.createElement("option");
            option.value = tipo.id;
            option.textContent = tipo.nombre;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar tipos de documento:", error);
    }
}

// --- RENDERIZADO EN PANTALLA ---

function renderizarDocumentos(documentos) {
    const tbody = document.getElementById("tabla-documentos");
    tbody.innerHTML = ""; 

    if (documentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px; color: var(--muted);">No hay documentos subidos aún.</td></tr>';
        return;
    }

    documentos.forEach((doc) => {
        let badgeClass = "chip"; 
        let colorStyle = "background: #e2e8f0; color: #475569;"; // Pendiente
        
        if (doc.estado === "Aprobado") {
            colorStyle = "background: #d1fae5; color: #065f46;"; // Verde
        } else if (doc.estado === "En revisión") {
            colorStyle = "background: #fef3c7; color: #92400e;"; // Amarillo
        } else if (doc.estado === "Requiere corrección") {
            colorStyle = "background: #fee2e2; color: #991b1b;"; // Rojo
        }

        const fecha = new Date(doc.fecha_subida).toLocaleDateString("es-MX", { day: 'numeric', month: 'short', year: 'numeric' });

        const fila = document.createElement("tr");
        fila.style.borderBottom = "1px solid var(--line)";
        fila.innerHTML = `
            <td style="padding: 12px 10px;">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <span style="font-size: 1.2rem;">📄</span>
                    <div>
                        <b style="display: block; font-size: 0.9rem;">${doc.tipo_documento}</b>
                        <small style="color: var(--muted); font-size: 0.75rem;">PDF · v${doc.version}</small>
                    </div>
                </div>
            </td>
            <td style="padding: 12px 10px; font-size: 0.85rem;">${fecha}</td>
            <td style="padding: 12px 10px;">
                <span style="padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; ${colorStyle}">
                    ${doc.estado}
                </span>
            </td>
        `;
        // NOTA: Se eliminó el botón del ojito como pidió la profesora.
        tbody.appendChild(fila);
    });
}

// 4. Calcular la barra de progreso AUTOMÁTICA (según lo que pidió la profe)
function calcularProgreso(documentos) {
    // Total de documentos requeridos (según tu base de datos son 4)
    const totalRequeridos = 4; 
    const totalSubidos = documentos.length;

    // Calculamos el porcentaje (ej. si subió 2 de 4, es 50%)
    let porcentaje = (totalSubidos / totalRequeridos) * 100;
    if (porcentaje > 100) porcentaje = 100; // Tope máximo

    // Actualizar UI
    document.getElementById("porcentaje-avance").textContent = `${Math.round(porcentaje)}%`;
    document.getElementById("progreso-fill").style.width = `${porcentaje}%`;
    document.getElementById("progreso-detalle").textContent = `${totalSubidos} de ${totalRequeridos} documentos subidos`;
}

// --- FILTROS ---
function filtrarDocumentos(filtro) {
    let filtrados;
    if (filtro === "todos") {
        filtrados = todosLosDocumentos;
    } else {
        filtrados = todosLosDocumentos.filter((doc) => doc.estado === filtro);
    }
    renderizarDocumentos(filtrados);
}

// --- MODAL Y SUBIDA DE ARCHIVOS ---
function abrirModalSubir() {
    document.getElementById("modal-subir").style.display = "flex";
}

function cerrarModalSubir() {
    document.getElementById("modal-subir").style.display = "none";
    document.getElementById("form-subir-documento").reset();
}

async function subirDocumento(event) {
    event.preventDefault();

    const tipoId = document.getElementById("tipo-documento").value;
    const archivoInput = document.getElementById("archivo-pdf");

    if (!archivoInput.files[0]) return alert("Selecciona un archivo PDF");

    const formData = new FormData();
    formData.append("archivo", archivoInput.files[0]);
    formData.append("expediente_id", EXPEDIENTE_ID);
    formData.append("tipo_documento_id", tipoId);
    formData.append("usuario", "Ana Belén");

    try {
        const response = await fetch(`${API_URL}/documentos`, {
            method: "POST",
            body: formData, 
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Error al subir");
        }

        alert("¡Documento subido con éxito!");
        cerrarModalSubir();
        cargarDocumentos(); // Recargar la lista (y la barra automáticamente)
    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
    }
}