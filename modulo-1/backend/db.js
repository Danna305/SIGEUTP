const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

(async () => {
    try {
        await promisePool.query('SELECT 1 + 1 AS resultado');
        console.log('✅ Conexión exitosa a Clever Cloud');
    } catch (error) {
        console.error('❌ Error al conectar con Clever Cloud:', error.message);
    }
})();

module.exports = promisePool;