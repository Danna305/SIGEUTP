// ============================================
// CONFIGURACION DE MULTER - SUBIDA DE PDFs
// ============================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Nos aseguramos de que la carpeta 'uploads' exista
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuracion de almacenamiento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Nombre unico: timestamp + nombre original sanitizado
        const timestamp = Date.now();
        const nombreLimpio = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}-${nombreLimpio}`);
    }
});

// Filtro para aceptar SOLO archivos PDF
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos PDF'), false);
    }
};

// Configuracion final de Multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB maximo
    }
});

module.exports = upload;