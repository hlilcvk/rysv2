// backend/migrations/migrate.js
// Migration çalıştırıcı

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { masterPool } = require('../config/db');

const MIGRATIONS_DIR = __dirname;

async function getMigrationFiles() {
    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();
    return files;
}

async function getCompletedMigrations() {
    try {
        const result = await masterPool.query(
            `SELECT migration_adi FROM migration_log WHERE migration_tipi = 'ortak' AND durum = 'basarili'`
        );
        return result.rows.map(r => r.migration_adi);
    } catch {
        return [];
    }
}

async function runMigration(filename) {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filePath, 'utf8');
    const migrationName = filename.replace('.sql', '');
    const startTime = Date.now();

    try {
        await masterPool.query(sql);
        const duration = Date.now() - startTime;

        await masterPool.query(`
            INSERT INTO migration_log (migration_adi, migration_tipi, durum, calistiran, sure_ms)
            VALUES ($1, 'ortak', 'basarili', 'cli', $2)
        `, [migrationName, duration]).catch(() => {});

        console.log(`  ✅ ${filename} (${duration}ms)`);
        return true;
    } catch (err) {
        const duration = Date.now() - startTime;

        await masterPool.query(`
            INSERT INTO migration_log (migration_adi, migration_tipi, durum, hata_mesaji, calistiran, sure_ms)
            VALUES ($1, 'ortak', 'hata', $2, 'cli', $3)
        `, [migrationName, err.message, duration]).catch(() => {});

        console.error(`  ❌ ${filename}: ${err.message}`);
        return false;
    }
}

async function main() {
    const command = process.argv[2] || 'up';

    console.log('\n🗄️  RandevuCRM Migration\n');

    if (command === 'status') {
        const files = await getMigrationFiles();
        const completed = await getCompletedMigrations();

        console.log('Migration Durumu:\n');
        for (const f of files) {
            const name = f.replace('.sql', '');
            const status = completed.includes(name) ? '✅' : '⏳';
            console.log(`  ${status} ${f}`);
        }
    } else if (command === 'up') {
        const files = await getMigrationFiles();
        const completed = await getCompletedMigrations();
        const pending = files.filter(f => !completed.includes(f.replace('.sql', '')));

        if (!pending.length) {
            console.log('  Tüm migration\'lar zaten çalıştırılmış ✅');
        } else {
            console.log(`  ${pending.length} bekleyen migration:\n`);
            for (const f of pending) {
                await runMigration(f);
            }
        }
    }

    console.log('\n  Bitti.\n');
    await masterPool.end();
    process.exit(0);
}

main().catch(err => {
    console.error('Migration hatası:', err);
    process.exit(1);
});
