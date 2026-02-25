// backend/services/tenant.service.js
// İşletme tablo yönetimi — otomatik oluşturma, migration, silme

const { masterPool } = require('../config/db');
const { TENANT_TABLES, DEFAULT_SETTINGS } = require('../config/constants');
const { sanitizeTableName } = require('../utils/helpers');
const logger = require('../utils/logger');

class TenantService {

    // ─── İşletme tablolarını oluştur ───
    static async createTenantTables(isletme_id) {
        const id = sanitizeTableName(isletme_id);
        const startTime = Date.now();
        const results = [];
        const templates = this.getTableTemplates(id);

        for (const table of templates) {
            try {
                await masterPool.query(table.sql);
                results.push({ table: table.name, status: 'ok' });

                await masterPool.query(`
                    INSERT INTO migration_log (migration_adi, migration_tipi, hedef, durum, calistiran, sure_ms)
                    VALUES ($1, 'isletme', $2, 'basarili', 'system', $3)
                `, [`create_${table.name}`, id, Date.now() - startTime]).catch(() => {});

            } catch (err) {
                results.push({ table: table.name, status: 'hata', error: err.message });
                logger.error(`Tablo oluşturma hatası: ${table.name}`, err.message);
            }
        }

        // Varsayılan ayarları ekle
        await this.insertDefaults(id);

        logger.info(`İşletme tabloları oluşturuldu: ${id} (${Date.now() - startTime}ms)`);
        return results;
    }

    // ─── Varsayılan ayarları ekle ───
    static async insertDefaults(isletme_id) {
        const id = sanitizeTableName(isletme_id);
        for (const [adi, degeri] of Object.entries(DEFAULT_SETTINGS)) {
            await masterPool.query(
                `INSERT INTO ${id}_ayarlar (ayar_adi, ayar_degeri) VALUES ($1, $2)
                 ON CONFLICT (ayar_adi) DO NOTHING`,
                [adi, degeri]
            ).catch(() => {});
        }
    }

    // ─── İşletme tablolarını sil ───
    static async dropTenantTables(isletme_id) {
        const id = sanitizeTableName(isletme_id);
        for (const suffix of TENANT_TABLES) {
            await masterPool.query(`DROP TABLE IF EXISTS ${id}_${suffix} CASCADE`).catch(() => {});
        }
        logger.info(`İşletme tabloları silindi: ${id}`);
    }

    // ─── İşletme tablo durumunu kontrol et ───
    static async checkTenantTables(isletme_id) {
        const id = sanitizeTableName(isletme_id);
        const results = [];

        for (const suffix of TENANT_TABLES) {
            const tableName = `${id}_${suffix}`;
            const exists = await masterPool.query(
                `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
                [tableName]
            );

            let rowCount = 0;
            let size = '0 bytes';
            if (exists.rows[0].exists) {
                const count = await masterPool.query(`SELECT COUNT(*) as c FROM ${tableName}`).catch(() => ({ rows: [{ c: 0 }] }));
                rowCount = parseInt(count.rows[0].c);

                const sizeResult = await masterPool.query(
                    `SELECT pg_size_pretty(pg_total_relation_size($1)) as size`, [tableName]
                ).catch(() => ({ rows: [{ size: '0 bytes' }] }));
                size = sizeResult.rows[0].size;
            }

            results.push({
                table: tableName,
                suffix,
                exists: exists.rows[0].exists,
                rows: rowCount,
                size
            });
        }

        return results;
    }

    // ─── Eksik tabloları oluştur (repair) ───
    static async repairTenantTables(isletme_id) {
        const id = sanitizeTableName(isletme_id);
        const status = await this.checkTenantTables(id);
        const missing = status.filter(t => !t.exists);

        if (!missing.length) return { repaired: 0, message: 'Tüm tablolar mevcut' };

        const templates = this.getTableTemplates(id);
        let repaired = 0;

        for (const m of missing) {
            const template = templates.find(t => t.name === m.table);
            if (template) {
                await masterPool.query(template.sql).catch(() => {});
                repaired++;
            }
        }

        return { repaired, missing: missing.map(m => m.table) };
    }

    // ─── Tablo yapısını getir (kolon bilgileri) ───
    static async getTableSchema(tableName) {
        const result = await masterPool.query(`
            SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
        `, [sanitizeTableName(tableName)]);

        return result.rows;
    }

    // ─── Tek işletmeye migration uygula ───
    static async runMigration(isletme_id, migration_name, sql) {
        const id = sanitizeTableName(isletme_id);
        const startTime = Date.now();
        try {
            const finalSql = sql.replace(/{isletme_id}/g, id);
            await masterPool.query(finalSql);

            await masterPool.query(`
                INSERT INTO migration_log (migration_adi, migration_tipi, hedef, durum, sql_icerik, calistiran, sure_ms)
                VALUES ($1, 'isletme', $2, 'basarili', $3, 'admin', $4)
            `, [migration_name, id, finalSql, Date.now() - startTime]);

            return { success: true };
        } catch (err) {
            await masterPool.query(`
                INSERT INTO migration_log (migration_adi, migration_tipi, hedef, durum, hata_mesaji, calistiran)
                VALUES ($1, 'isletme', $2, 'hata', $3, 'admin')
            `, [migration_name, id, err.message]).catch(() => {});

            return { success: false, error: err.message };
        }
    }

    // ─── TÜM işletmelere migration uygula ───
    static async runMigrationAll(migration_name, sql) {
        const isletmeler = await masterPool.query(
            `SELECT isletme_id FROM admin_users WHERE is_super_admin = false AND isletme_id IS NOT NULL`
        );

        const results = [];
        for (const row of isletmeler.rows) {
            const result = await this.runMigration(row.isletme_id, migration_name, sql);
            results.push({ isletme_id: row.isletme_id, ...result });
        }

        return results;
    }

    // ─── Tüm işletmelerin tablo durumu (süper admin) ───
    static async getAllTenantsStatus() {
        const isletmeler = await masterPool.query(
            `SELECT isletme_id, ad_soyad, kullanici_adi FROM admin_users 
             WHERE is_super_admin = false AND isletme_id IS NOT NULL`
        );

        const statuses = [];
        for (const row of isletmeler.rows) {
            const tables = await this.checkTenantTables(row.isletme_id);
            const totalRows = tables.reduce((sum, t) => sum + t.rows, 0);
            const existingCount = tables.filter(t => t.exists).length;

            statuses.push({
                isletme_id: row.isletme_id,
                ad_soyad: row.ad_soyad,
                tables_ok: existingCount,
                tables_total: TENANT_TABLES.length,
                total_rows: totalRows,
                healthy: existingCount === TENANT_TABLES.length
            });
        }

        return statuses;
    }

    // ─── Tablo şablonları ───
    static getTableTemplates(id) {
        return [
            {
                name: `${id}_randevular`,
                sql: `CREATE TABLE IF NOT EXISTS ${id}_randevular (
                    id SERIAL PRIMARY KEY,
                    musteri_id INTEGER,
                    musteri_adi VARCHAR(200) NOT NULL,
                    telefon_no VARCHAR(20),
                    islem_turu VARCHAR(200),
                    hizmet_id INTEGER,
                    uzman VARCHAR(100),
                    uzman_id INTEGER,
                    baslangic_saati TIMESTAMP NOT NULL,
                    bitis_saati TIMESTAMP NOT NULL,
                    durum VARCHAR(20) DEFAULT 'bekliyor',
                    odeme_durumu VARCHAR(20) DEFAULT 'odenmedi',
                    odeme_tutari DECIMAL(10,2),
                    odeme_yontemi VARCHAR(50),
                    kaynak VARCHAR(20) DEFAULT 'manuel',
                    notlar TEXT,
                    iptal_nedeni TEXT,
                    hatirlatma_gonderildi BOOLEAN DEFAULT false,
                    anket_gonderildi BOOLEAN DEFAULT false,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: `${id}_musteriler`,
                sql: `CREATE TABLE IF NOT EXISTS ${id}_musteriler (
                    id SERIAL PRIMARY KEY,
                    ad_soyad VARCHAR(200) NOT NULL,
                    telefon VARCHAR(20) UNIQUE,
                    email VARCHAR(200),
                    dogum_tarihi DATE,
                    cinsiyet VARCHAR(10),
                    adres TEXT,
                    notlar TEXT,
                    etiketler TEXT[],
                    toplam_randevu INTEGER DEFAULT 0,
                    toplam_harcama DECIMAL(10,2) DEFAULT 0,
                    son_ziyaret TIMESTAMP,
                    kaynak VARCHAR(50) DEFAULT 'manuel',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: `${id}_hizmetler`,
                sql: `CREATE TABLE IF NOT EXISTS ${id}_hizmetler (
                    id SERIAL PRIMARY KEY,
                    hizmet_adi VARCHAR(200) NOT NULL,
                    kategori VARCHAR(100),
                    sure_dakika INTEGER NOT NULL DEFAULT 60,
                    fiyat DECIMAL(10,2) NOT NULL DEFAULT 0,
                    para_birimi VARCHAR(10) DEFAULT 'TRY',
                    aciklama TEXT,
                    renk VARCHAR(20),
                    sira INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: `${id}_odemeler`,
                sql: `CREATE TABLE IF NOT EXISTS ${id}_odemeler (
                    id SERIAL PRIMARY KEY,
                    randevu_id INTEGER,
                    musteri_id INTEGER,
                    tutar DECIMAL(10,2) NOT NULL,
                    para_birimi VARCHAR(10) DEFAULT 'TRY',
                    odeme_yontemi VARCHAR(50) NOT NULL,
                    durum VARCHAR(20) DEFAULT 'tamamlandi',
                    aciklama TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: `${id}_faturalar`,
                sql: `CREATE TABLE IF NOT EXISTS ${id}_faturalar (
                    id SERIAL PRIMARY KEY,
                    fatura_no VARCHAR(50),
                    randevu_id INTEGER,
                    musteri_id INTEGER,
                    fatura_turu VARCHAR(20) DEFAULT 'e_arsiv',
                    ara_toplam DECIMAL(10,2),
                    kdv_orani DECIMAL(5,2) DEFAULT 20,
                    kdv_tutari DECIMAL(10,2),
                    toplam_tutar DECIMAL(10,2),
                    durum VARCHAR(20) DEFAULT 'bekliyor',
                    provider_fatura_id VARCHAR(100),
                    provider_response JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: `${id}_bildirimler`,
                sql: `CREATE TABLE IF NOT EXISTS ${id}_bildirimler (
                    id SERIAL PRIMARY KEY,
                    randevu_id INTEGER,
                    musteri_id INTEGER,
                    bildirim_tipi VARCHAR(50) NOT NULL,
                    kanal VARCHAR(20) DEFAULT 'whatsapp',
                    icerik TEXT,
                    durum VARCHAR(20) DEFAULT 'gonderildi',
                    hata_mesaji TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: `${id}_anketler`,
                sql: `CREATE TABLE IF NOT EXISTS ${id}_anketler (
                    id SERIAL PRIMARY KEY,
                    randevu_id INTEGER,
                    musteri_id INTEGER,
                    puan INTEGER CHECK (puan >= 1 AND puan <= 5),
                    yorum TEXT,
                    uzman_id INTEGER,
                    hizmet_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: `${id}_mesajlar`,
                sql: `CREATE TABLE IF NOT EXISTS ${id}_mesajlar (
                    id SERIAL PRIMARY KEY,
                    musteri_id INTEGER,
                    telefon VARCHAR(20),
                    yon VARCHAR(10) NOT NULL,
                    mesaj_tipi VARCHAR(50),
                    icerik TEXT,
                    durum VARCHAR(20) DEFAULT 'gonderildi',
                    provider VARCHAR(50),
                    provider_mesaj_id VARCHAR(200),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            },
            {
                name: `${id}_ayarlar`,
                sql: `CREATE TABLE IF NOT EXISTS ${id}_ayarlar (
                    id SERIAL PRIMARY KEY,
                    ayar_adi VARCHAR(100) UNIQUE NOT NULL,
                    ayar_degeri TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`
            }
        ];
    }
}

module.exports = TenantService;
