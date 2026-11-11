// SERVIDOR BACKEND - MODULO 1
// Expediente Digital y Gestion de Documentos

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db');
const upload = require('./middleware/upload');

const app = express();
const PORT = process.env.PORT || 3000;

const webpush = require('web-push');
webpush.setVapidDetails(
    'mailto:tu-correo@ejemplo.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// MIDDLEWARES GLOBALES
app.use(cors({
    origin: 'https://051230-v.github.io'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir los archivos PDF subidos de forma estatica
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Log simple de peticiones (util para depurar)
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// RUTA DE PRUEBA
app.get('/', (req, res) => {
    res.json({
        mensaje: 'API del Modulo 1 - Sistema de Gestion de Estadias',
        version: '2.0.0',
        endpoints: {
            expedientes: '/api/expedientes',
            documentos: '/api/documentos',
            tiposDocumento: '/api/tipos-documento',
            revisiones: '/api/revisiones'
        }
    });
});

// ============================================
// RUTAS: EXPEDIENTES
// ============================================

// GET /api/expedientes - Lista todos los expedientes con su avance
app.get('/api/expedientes', async (req, res) => {
    try {
        const sql = `
            SELECT 
                e.id,
                e.alumno_nombre,
                e.matricula,
                e.carrera,
                e.estado_general,
                e.fecha_creacion,
                COUNT(d.id) AS total_documentos,
                SUM(CASE WHEN d.estado = 'Aprobado' THEN 1 ELSE 0 END) AS aprobados
            FROM expedientes e
            LEFT JOIN documentos d ON e.id = d.expediente_id
            GROUP BY e.id
            ORDER BY e.fecha_creacion DESC
        `;
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (error) {
        console.error('Error GET /api/expedientes:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/expedientes/:id - Obtiene un expediente con TODOS sus documentos
app.get('/api/expedientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Datos del expediente
        const [expediente] = await db.query(
            'SELECT * FROM expedientes WHERE id = ?', [id]
        );
        
        if (expediente.length === 0) {
            return res.status(404).json({ error: 'Expediente no encontrado' });
        }

        // Documentos del expediente con info del tipo
        const [documentos] = await db.query(`
            SELECT 
                d.id,
                d.archivo_pdf,
                d.version,
                d.estado,
                d.fecha_subida,
                t.nombre AS tipo_documento,
                t.obligatorio
            FROM documentos d
            INNER JOIN tipos_documento t ON d.tipo_documento_id = t.id
            WHERE d.expediente_id = ?
            ORDER BY t.id
        `, [id]);

        res.json({
            expediente: expediente[0],
            documentos: documentos
        });
    } catch (error) {
        console.error('Error GET /api/expedientes/:id:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/expedientes - Crear un nuevo expediente
app.post('/api/expedientes', async (req, res) => {
    try {
        const { alumno_nombre, matricula, carrera } = req.body;

        if (!alumno_nombre || !matricula || !carrera) {
            return res.status(400).json({ 
                error: 'Faltan campos: alumno_nombre, matricula, carrera' 
            });
        }

        const sql = `INSERT INTO expedientes (alumno_nombre, matricula, carrera) 
                     VALUES (?, ?, ?)`;
        const [result] = await db.query(sql, [alumno_nombre, matricula, carrera]);

        res.status(201).json({
            mensaje: 'Expediente creado exitosamente',
            id: result.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'La matricula ya existe' });
        }
        console.error('Error POST /api/expedientes:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/expedientes/:id - Actualizar expediente
app.put('/api/expedientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { alumno_nombre, matricula, carrera, estado_general } = req.body;

        const sql = `
            UPDATE expedientes 
            SET alumno_nombre = COALESCE(?, alumno_nombre),
                matricula = COALESCE(?, matricula),
                carrera = COALESCE(?, carrera),
                estado_general = COALESCE(?, estado_general)
            WHERE id = ?
        `;
        const [result] = await db.query(sql, 
            [alumno_nombre, matricula, carrera, estado_general, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Expediente no encontrado' });
        }

        res.json({ mensaje: 'Expediente actualizado' });
    } catch (error) {
        console.error('Error PUT /api/expedientes/:id:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/expedientes/:id - Eliminar expediente
app.delete('/api/expedientes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(
            'DELETE FROM expedientes WHERE id = ?', [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Expediente no encontrado' });
        }

        res.json({ mensaje: 'Expediente eliminado' });
    } catch (error) {
        console.error('Error DELETE /api/expedientes/:id:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// RUTAS: TIPOS DE DOCUMENTO
// ============================================

// GET /api/tipos-documento - Lista todos los tipos
app.get('/api/tipos-documento', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM tipos_documento ORDER BY id');
        res.json(rows);
    } catch (error) {
        console.error('Error GET /api/tipos-documento:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// RUTAS: DOCUMENTOS
// ============================================

// GET /api/documentos - Lista todos los documentos
app.get('/api/documentos', async (req, res) => {
    try {
        const sql = `
            SELECT 
                d.id,
                d.expediente_id,
                d.archivo_pdf,
                d.version,
                d.estado,
                d.fecha_subida,
                t.nombre AS tipo_documento,
                e.alumno_nombre,
                e.matricula
            FROM documentos d
            INNER JOIN tipos_documento t ON d.tipo_documento_id = t.id
            INNER JOIN expedientes e ON d.expediente_id = e.id
            ORDER BY d.fecha_subida DESC
        `;
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (error) {
        console.error('Error GET /api/documentos:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/documentos/:id - Obtiene un documento con sus revisiones
app.get('/api/documentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [documento] = await db.query(`
            SELECT d.*, t.nombre AS tipo_documento, e.alumno_nombre
            FROM documentos d
            INNER JOIN tipos_documento t ON d.tipo_documento_id = t.id
            INNER JOIN expedientes e ON d.expediente_id = e.id
            WHERE d.id = ?
        `, [id]);

        if (documento.length === 0) {
            return res.status(404).json({ error: 'Documento no encontrado' });
        }

        const [revisiones] = await db.query(`
            SELECT * FROM revisiones_documento 
            WHERE documento_id = ? 
            ORDER BY fecha_revision DESC
        `, [id]);

        res.json({
            documento: documento[0],
            revisiones: revisiones
        });
    } catch (error) {
        console.error('Error GET /api/documentos/:id:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/documentos - Subir un nuevo PDF
app.post('/api/documentos', upload.single('archivo'), async (req, res) => {
    try {
        const { expediente_id, tipo_documento_id } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No se subio ningun archivo PDF' });
        }
        if (!expediente_id || !tipo_documento_id) {
            return res.status(400).json({ 
                error: 'Faltan campos: expediente_id, tipo_documento_id' 
            });
        }

        const archivo_pdf = req.file.filename;
        let result;
        let mensajeExito = '';

        // Verificamos si ya existe un documento de ese tipo para ese expediente
        const [existente] = await db.query(
            'SELECT id, version FROM documentos WHERE expediente_id = ? AND tipo_documento_id = ?',
            [expediente_id, tipo_documento_id]
        );

        if (existente.length > 0) {
            // Actualizamos: incrementamos version y cambiamos el archivo
            const nuevaVersion = existente[0].version + 1;
            const sql = `
                UPDATE documentos 
                SET archivo_pdf = ?, version = ?, estado = 'En revision', fecha_subida = NOW()
                WHERE id = ?
            `;
            [result] = await db.query(sql, [archivo_pdf, nuevaVersion, existente[0].id]);

            // Registramos en el historial
            await db.query(
                `INSERT INTO historial_documentos (documento_id, accion, usuario) 
                 VALUES (?, ?, ?)`,
                [existente[0].id, `Nueva version (v${nuevaVersion}) subida`, req.body.usuario || 'Alumno']
            );

            mensajeExito = 'Documento actualizado con nueva version';
        } else {
            // Si no existe, creamos uno nuevo
            const sql = `
                INSERT INTO documentos (expediente_id, tipo_documento_id, archivo_pdf, estado) 
                VALUES (?, ?, ?, 'En revision')
            `;
            [result] = await db.query(sql, [expediente_id, tipo_documento_id, archivo_pdf]);

            // Registramos en el historial
            await db.query(
                `INSERT INTO historial_documentos (documento_id, accion, usuario) 
                 VALUES (?, ?, ?)`,
                [result.insertId, 'Documento subido por primera vez', req.body.usuario || 'Alumno']
            );

            mensajeExito = 'Documento subido exitosamente';
        }

        // ==========================================
        // LÓGICA DE NOTIFICACIÓN PUSH (AQUÍ VA)
        // ==========================================
        try {
            const [subs] = await db.query('SELECT * FROM suscripciones');
            const payload = JSON.stringify({
                title: '¡Documento Subido!',
                body: `Tu archivo está en revisión.`
            });
            
            subs.forEach(sub => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth }
                };
                // Enviamos la notificación
                webpush.sendNotification(pushSubscription, payload).catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) { 
                        db.query('DELETE FROM suscripciones WHERE endpoint = ?', [sub.endpoint]);
                    }
                });
            });
        } catch (e) { 
            console.log('Error enviando push:', e); 
        }
        // ==========================================

        // Finalmente, respondemos al cliente
        res.status(201).json({
            mensaje: mensajeExito,
            id: existente.length > 0 ? existente[0].id : result.insertId
        });

    } catch (error) {
        console.error('Error POST /api/documentos:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/documentos/:id - Actualizar estado del documento
app.put('/api/documentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;

        const estadosValidos = ['Pendiente', 'En revision', 'Aprobado', 'Requiere correccion'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ 
                error: `Estado invalido. Validos: ${estadosValidos.join(', ')}` 
            });
        }

        const sql = 'UPDATE documentos SET estado = ? WHERE id = ?';
        const [result] = await db.query(sql, [estado, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Documento no encontrado' });
        }

        // Registramos en el historial
        await db.query(
            `INSERT INTO historial_documentos (documento_id, accion, usuario) 
             VALUES (?, ?, ?)`,
            [id, `Estado cambiado a: ${estado}`, req.body.usuario || 'Asesor']
        );

        res.json({ mensaje: 'Estado actualizado correctamente' });
    } catch (error) {
        console.error('Error PUT /api/documentos/:id:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/documentos/:id - Eliminar documento
app.delete('/api/documentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.query(
            'DELETE FROM documentos WHERE id = ?', [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Documento no encontrado' });
        }

        res.json({ mensaje: 'Documento eliminado' });
    } catch (error) {
        console.error('Error DELETE /api/documentos/:id:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// RUTAS: REVISIONES
// ============================================

// POST /api/revisiones - Crear una revision (observacion del asesor)
app.post('/api/revisiones', async (req, res) => {
    try {
        const { documento_id, asesor_nombre, comentario, estado_revision } = req.body;

        if (!documento_id || !asesor_nombre || !estado_revision) {
            return res.status(400).json({ 
                error: 'Faltan campos: documento_id, asesor_nombre, estado_revision' 
            });
        }

        // Insertamos la revision
        const sql = `
            INSERT INTO revisiones_documento 
            (documento_id, asesor_nombre, comentario, estado_revision) 
            VALUES (?, ?, ?, ?)
        `;
        const [result] = await db.query(sql, 
            [documento_id, asesor_nombre, comentario, estado_revision]);

        // Actualizamos el estado del documento
        await db.query(
            'UPDATE documentos SET estado = ? WHERE id = ?',
            [estado_revision, documento_id]
        );

        // Registramos en el historial
        await db.query(
            `INSERT INTO historial_documentos (documento_id, accion, usuario) 
             VALUES (?, ?, ?)`,
            [documento_id, `Revision: ${estado_revision}`, asesor_nombre]
        );

        res.status(201).json({
            mensaje: 'Revision registrada exitosamente',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error POST /api/revisiones:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/revisiones/:documento_id - Lista revisiones de un documento
app.get('/api/revisiones/:documento_id', async (req, res) => {
    try {
        const { documento_id } = req.params;
        const [rows] = await db.query(
            'SELECT * FROM revisiones_documento WHERE documento_id = ? ORDER BY fecha_revision DESC',
            [documento_id]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error GET /api/revisiones:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/historial - Obtiene el historial de cambios
app.get('/api/historial', async (req, res) => {
    try {
        const sql = `
            SELECT h.*, d.archivo_pdf 
            FROM historial_documentos h
            INNER JOIN documentos d ON h.documento_id = d.id
            ORDER BY h.fecha DESC
        `;
        const [rows] = await db.query(sql);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ============================================
// MANEJO DE ERRORES GLOBALES
// ============================================
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'El archivo excede el tamano maximo de 5 MB' });
    }
    if (err.message === 'Solo se permiten archivos PDF') {
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.post('/api/suscribir', async (req, res) => {
    const sub = req.body;
    const sql = `INSERT IGNORE INTO suscripciones (endpoint, p256dh, auth) VALUES (?, ?, ?)`;
    try {
        await db.query(sql, [sub.endpoint, sub.keys.p256dh, sub.keys.auth]);
        res.status(201).json({ mensaje: 'Suscripción guardada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
    console.log('============================================');
    console.log(`Servidor Backend corriendo en:`);
    console.log(`http://localhost:${PORT}`);
    console.log('============================================');
});