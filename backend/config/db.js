// backend/config/db.js
// Veritabanı bağlantı havuzu

const { Pool } = require('pg');

const masterPool = new Pool({
    host: process.env.DB_HOST || process.env.MASTER_DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.MASTER_DB_PORT || '5432'),
    database: process.env.DB_NAME || process.env.MASTER_DB_NAME || 'randevu',
    user: process.env.DB_USER || process.env.MASTER_DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.MASTER_DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Bağlantı test
masterPool.on('connect', () => {
    console.log('✅ PostgreSQL bağlantısı başarılı');
});

masterPool.on('error', (err) => {
    console.error('❌ PostgreSQL bağlantı hatası:', err.message);
});

// Bağlantı durumu kontrolü
async function testConnection() {
    try {
        const result = await masterPool.query('SELECT NOW() as time, version() as version');
        return {
            success: true,
            time: result.rows[0].time,
            version: result.rows[0].version,
            pool: {
                total: masterPool.totalCount,
                idle: masterPool.idleCount,
                waiting: masterPool.waitingCount
            }
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// DB istatistikleri
async function getStats() {
    try {
        const dbSize = await masterPool.query(
            `SELECT pg_size_pretty(pg_database_size($1)) as size`,
            [process.env.DB_NAME || 'randevu']
        );

        const tableCount = await masterPool.query(
            `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`
        );

        const activeConns = await masterPool.query(
            `SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = $1`,
            [process.env.DB_NAME || 'randevu']
        );

        return {
            db_size: dbSize.rows[0].size,
            table_count: parseInt(tableCount.rows[0].count),
            active_connections: parseInt(activeConns.rows[0].count),
            pool: {
                total: masterPool.totalCount,
                idle: masterPool.idleCount,
                waiting: masterPool.waitingCount,
                max: parseInt(process.env.DB_MAX_CONNECTIONS || '20')
            }
        };
    } catch (err) {
        return { error: err.message };
    }
}

module.exports = { masterPool, testConnection, getStats };
