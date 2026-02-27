// backend/controllers/admin.controller.js
const bcrypt = require('bcryptjs');
const { masterPool } = require('../config/db');
const TenantService = require('../services/tenant.service');
const { successResponse, errorResponse, sanitizeTableName, getCurrentPeriod } = require('../utils/helpers');
const logger = require('../utils/logger');

// ═══════════════════════════════════
// İŞLETME YÖNETİMİ
// ═══════════════════════════════════

exports.listBusinesses = async (req, res) => {
    try {
        const result = await masterPool.query(`
            SELECT u.id, u.isletme_id, u.kullanici_adi, u.ad_soyad, u.email, u.telefon,
                   u.is_active, u.created_at, u.son_giris,
                   a.durum as abo_durum, a.bitis_tarihi as abo_bitis,
                   p.gorunen_adi as paket_adi,
                   (SELECT COUNT(*) FROM calisma_odalari c WHERE c.isletme_id = u.isletme_id AND c.is_active = true) as uzman_sayisi
            FROM admin_users u
            LEFT JOIN LATERAL (
                SELECT * FROM abonelikler WHERE isletme_id = u.isletme_id ORDER BY created_at DESC LIMIT 1
            ) a ON true
            LEFT JOIN paketler p ON p.id = a.paket_id
            WHERE u.is_super_admin = false AND u.isletme_id IS NOT NULL
            ORDER BY u.created_at DESC
        `);
        return successResponse(res, { data: result.rows });
    } catch (err) {
        logger.error('İşletme listesi hatası:', err.message);
        return errorResponse(res, 'İşletme listesi alınamadı');
    }
};

exports.createBusiness = async (req, res) => {
    try {
        const { isletme_id, kullanici_adi, ad_soyad, sifre, email, telefon } = req.body;

        // Benzersizlik kontrolü
        const exists = await masterPool.query(
            `SELECT id FROM admin_users WHERE isletme_id = $1 OR kullanici_adi = $2`,
            [isletme_id, kullanici_adi]
        );
        if (exists.rows.length) {
            return errorResponse(res, 'Bu işletme ID veya kullanıcı adı zaten mevcut', 400);
        }

        // Şifreyi hashle
        const hashedPassword = await bcrypt.hash(sifre, 10);
        const tabloAdi = `${sanitizeTableName(isletme_id)}_randevular`;

        // Kullanıcı oluştur
        const userResult = await masterPool.query(`
            INSERT INTO admin_users (isletme_id, kullanici_adi, ad_soyad, sifre, email, telefon, bagli_tablo_adi, is_super_admin)
            VALUES ($1, $2, $3, $4, $5, $6, $7, false)
            RETURNING id, isletme_id, kullanici_adi, ad_soyad
        `, [isletme_id, kullanici_adi, ad_soyad, hashedPassword, email || null, telefon || null, tabloAdi]);

        // İşletme tablolarını oluştur
        const tableResults = await TenantService.createTenantTables(isletme_id);

        // 14 gün deneme aboneliği oluştur
        const starterPaket = await masterPool.query(`SELECT id FROM paketler WHERE paket_kodu = 'baslangic' LIMIT 1`);
        if (starterPaket.rows.length) {
            await masterPool.query(`
                INSERT INTO abonelikler (isletme_id, paket_id, durum, baslangic_tarihi, bitis_tarihi, deneme_bitis)
                VALUES ($1, $2, 'deneme', CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', CURRENT_DATE + INTERVAL '14 days')
            `, [isletme_id, starterPaket.rows[0].id]);
        }

        // Kullanım sayacı oluştur
        await masterPool.query(`
            INSERT INTO kullanim_sayaclari (isletme_id, donem) VALUES ($1, $2)
            ON CONFLICT (isletme_id, donem) DO NOTHING
        `, [isletme_id, getCurrentPeriod()]);

        logger.info(`Yeni işletme oluşturuldu: ${isletme_id} (${ad_soyad})`);
        return successResponse(res, { data: userResult.rows[0], tables: tableResults }, 'İşletme başarıyla oluşturuldu', 201);

    } catch (err) {
        logger.error('İşletme oluşturma hatası:', err.message);
        return errorResponse(res, 'İşletme oluşturulamadı: ' + err.message);
    }
};

exports.updateBusiness = async (req, res) => {
    try {
        const { id } = req.params;
        const { ad_soyad, email, telefon, kullanici_adi } = req.body;

        const result = await masterPool.query(`
            UPDATE admin_users SET
                ad_soyad = COALESCE($1, ad_soyad),
                email = COALESCE($2, email),
                telefon = COALESCE($3, telefon),
                kullanici_adi = COALESCE($4, kullanici_adi)
            WHERE id = $5 AND is_super_admin = false
            RETURNING id, isletme_id, ad_soyad, email, telefon
        `, [ad_soyad, email, telefon, kullanici_adi, id]);

        if (!result.rows.length) return errorResponse(res, 'İşletme bulunamadı', 404);
        return successResponse(res, { data: result.rows[0] }, 'İşletme güncellendi');
    } catch (err) {
        return errorResponse(res, 'Güncelleme hatası: ' + err.message);
    }
};

exports.deleteBusiness = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await masterPool.query(`SELECT isletme_id FROM admin_users WHERE id = $1 AND is_super_admin = false`, [id]);
        if (!user.rows.length) return errorResponse(res, 'İşletme bulunamadı', 404);

        const isletme_id = user.rows[0].isletme_id;

        // Tabloları sil
        await TenantService.dropTenantTables(isletme_id);

        // İlişkili verileri sil
        await masterPool.query(`DELETE FROM abonelikler WHERE isletme_id = $1`, [isletme_id]);
        await masterPool.query(`DELETE FROM isletme_eklentileri WHERE isletme_id = $1`, [isletme_id]);
        await masterPool.query(`DELETE FROM kullanim_sayaclari WHERE isletme_id = $1`, [isletme_id]);
        await masterPool.query(`DELETE FROM calisma_odalari WHERE isletme_id = $1`, [isletme_id]);
        await masterPool.query(`DELETE FROM admin_users WHERE id = $1`, [id]);

        logger.info(`İşletme silindi: ${isletme_id}`);
        return successResponse(res, {}, 'İşletme ve tüm verileri silindi');
    } catch (err) {
        return errorResponse(res, 'Silme hatası: ' + err.message);
    }
};

exports.toggleBusiness = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await masterPool.query(`
            UPDATE admin_users SET is_active = NOT is_active WHERE id = $1 AND is_super_admin = false
            RETURNING id, isletme_id, ad_soyad, is_active
        `, [id]);
        if (!result.rows.length) return errorResponse(res, 'İşletme bulunamadı', 404);
        return successResponse(res, { data: result.rows[0] });
    } catch (err) {
        return errorResponse(res, 'Toggle hatası');
    }
};

// ═══════════════════════════════════
// PLATFORM FİNANS
// ═══════════════════════════════════

exports.financeSummary = async (req, res) => {
    try {
        const totalBusinesses = await masterPool.query(`SELECT COUNT(*) as c FROM admin_users WHERE is_super_admin = false AND isletme_id IS NOT NULL`);
        const activeSubscriptions = await masterPool.query(`SELECT COUNT(*) as c FROM abonelikler WHERE durum IN ('aktif','deneme','hediye')`);
        const totalRevenue = await masterPool.query(`SELECT COALESCE(SUM(tutar),0) as total FROM platform_odemeler WHERE durum = 'tamamlandi'`);
        const monthlyRevenue = await masterPool.query(`
            SELECT COALESCE(SUM(tutar),0) as total FROM platform_odemeler 
            WHERE durum = 'tamamlandi' AND created_at >= date_trunc('month', CURRENT_DATE)
        `);

        // Paket dağılımı
        const packageDist = await masterPool.query(`
            SELECT p.gorunen_adi, COUNT(*) as c FROM abonelikler a
            JOIN paketler p ON p.id = a.paket_id
            WHERE a.durum IN ('aktif','deneme','hediye')
            GROUP BY p.gorunen_adi
        `);

        return successResponse(res, {
            data: {
                toplam_isletme: parseInt(totalBusinesses.rows[0].c),
                aktif_abonelik: parseInt(activeSubscriptions.rows[0].c),
                toplam_gelir: parseFloat(totalRevenue.rows[0].total),
                aylik_gelir: parseFloat(monthlyRevenue.rows[0].total),
                paket_dagilimi: packageDist.rows
            }
        });
    } catch (err) {
        return errorResponse(res, 'Finans özeti alınamadı');
    }
};

exports.listPayments = async (req, res) => {
    try {
        const result = await masterPool.query(`
            SELECT p.*, u.ad_soyad FROM platform_odemeler p
            LEFT JOIN admin_users u ON u.isletme_id = p.isletme_id
            ORDER BY p.created_at DESC LIMIT 100
        `);
        return successResponse(res, { data: result.rows });
    } catch (err) {
        return errorResponse(res, 'Ödeme listesi alınamadı');
    }
};

// ═══════════════════════════════════
// ABONELİK YÖNETİMİ
// ═══════════════════════════════════

exports.listSubscriptions = async (req, res) => {
    try {
        const result = await masterPool.query(`
            SELECT a.*, u.ad_soyad, u.isletme_id as isletme, p.gorunen_adi as paket_adi,
                   p.paket_kodu
            FROM abonelikler a
            JOIN admin_users u ON u.isletme_id = a.isletme_id
            JOIN paketler p ON p.id = a.paket_id
            ORDER BY a.created_at DESC
        `);
        return successResponse(res, { data: result.rows });
    } catch (err) {
        return errorResponse(res, 'Abonelik listesi alınamadı');
    }
};

exports.updateSubscription = async (req, res) => {
    try {
        const { isletme_id } = req.params;
        const { paket_id, durum, bitis_tarihi } = req.body;

        const result = await masterPool.query(`
            UPDATE abonelikler SET
                paket_id = COALESCE($1, paket_id),
                durum = COALESCE($2, durum),
                bitis_tarihi = COALESCE($3, bitis_tarihi),
                updated_at = NOW()
            WHERE isletme_id = $4 AND durum IN ('aktif','deneme','hediye')
            RETURNING *
        `, [paket_id, durum, bitis_tarihi, isletme_id]);

        if (!result.rows.length) return errorResponse(res, 'Abonelik bulunamadı', 404);
        return successResponse(res, { data: result.rows[0] }, 'Abonelik güncellendi');
    } catch (err) {
        return errorResponse(res, 'Abonelik güncellenemedi');
    }
};

exports.giftSubscription = async (req, res) => {
    try {
        const { isletme_id } = req.params;
        const { paket_id, sure_gun, neden } = req.body;

        // Mevcut aboneliği hediye olarak güncelle veya yeni oluştur
        await masterPool.query(`
            UPDATE abonelikler SET durum = 'suresi_doldu' WHERE isletme_id = $1 AND durum IN ('aktif','deneme')
        `, [isletme_id]);

        const result = await masterPool.query(`
            INSERT INTO abonelikler (isletme_id, paket_id, durum, baslangic_tarihi, bitis_tarihi)
            VALUES ($1, $2, 'hediye', CURRENT_DATE, CURRENT_DATE + $3 * INTERVAL '1 day')
            RETURNING *
        `, [isletme_id, paket_id || 2, sure_gun || 30]);

        // Hediye kaydı
        await masterPool.query(`
            INSERT INTO hediyeler (isletme_id, hediye_turu, sure_gun, veren_admin, neden)
            VALUES ($1, 'abonelik', $2, $3, $4)
        `, [isletme_id, sure_gun || 30, req.user.kullanici_adi, neden || 'Hediye abonelik']);

        logger.info(`Hediye abonelik verildi: ${isletme_id} (${sure_gun || 30} gün)`);
        return successResponse(res, { data: result.rows[0] }, 'Hediye abonelik verildi');
    } catch (err) {
        return errorResponse(res, 'Hediye abonelik verilemedi');
    }
};

// ═══════════════════════════════════
// KUPON YÖNETİMİ
// ═══════════════════════════════════

exports.listCoupons = async (req, res) => {
    try {
        const result = await masterPool.query(`SELECT * FROM kuponlar ORDER BY created_at DESC`);
        return successResponse(res, { data: result.rows });
    } catch (err) {
        return errorResponse(res, 'Kupon listesi alınamadı');
    }
};

exports.createCoupon = async (req, res) => {
    try {
        const { kupon_kodu, aciklama, indirim_tipi, indirim_degeri, gecerli_paket, max_kullanim, baslangic_tarihi, bitis_tarihi } = req.body;
        const result = await masterPool.query(`
            INSERT INTO kuponlar (kupon_kodu, aciklama, indirim_tipi, indirim_degeri, gecerli_paket, max_kullanim, baslangic_tarihi, bitis_tarihi)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [kupon_kodu.toUpperCase(), aciklama, indirim_tipi || 'yuzde', indirim_degeri, gecerli_paket, max_kullanim, baslangic_tarihi, bitis_tarihi]);
        return successResponse(res, { data: result.rows[0] }, 'Kupon oluşturuldu', 201);
    } catch (err) {
        if (err.code === '23505') return errorResponse(res, 'Bu kupon kodu zaten mevcut', 400);
        return errorResponse(res, 'Kupon oluşturulamadı');
    }
};

exports.updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const { aciklama, indirim_degeri, max_kullanim, bitis_tarihi, is_active } = req.body;
        const result = await masterPool.query(`
            UPDATE kuponlar SET aciklama=COALESCE($1,aciklama), indirim_degeri=COALESCE($2,indirim_degeri),
                max_kullanim=COALESCE($3,max_kullanim), bitis_tarihi=COALESCE($4,bitis_tarihi), is_active=COALESCE($5,is_active)
            WHERE id=$6 RETURNING *
        `, [aciklama, indirim_degeri, max_kullanim, bitis_tarihi, is_active, id]);
        if (!result.rows.length) return errorResponse(res, 'Kupon bulunamadı', 404);
        return successResponse(res, { data: result.rows[0] }, 'Kupon güncellendi');
    } catch (err) {
        return errorResponse(res, 'Kupon güncellenemedi');
    }
};

exports.deleteCoupon = async (req, res) => {
    try {
        await masterPool.query(`DELETE FROM kuponlar WHERE id = $1`, [req.params.id]);
        return successResponse(res, {}, 'Kupon silindi');
    } catch (err) {
        return errorResponse(res, 'Kupon silinemedi');
    }
};

// ═══════════════════════════════════
// DB YÖNETİMİ
// ═══════════════════════════════════

exports.dbStats = async (req, res) => {
    try {
        const { getStats } = require('../config/db');
        const stats = await getStats();
        return successResponse(res, { data: stats });
    } catch (err) {
        return errorResponse(res, 'DB istatistikleri alınamadı');
    }
};

exports.dbTenants = async (req, res) => {
    try {
        const statuses = await TenantService.getAllTenantsStatus();
        return successResponse(res, { data: statuses });
    } catch (err) {
        return errorResponse(res, 'Tenant durumları alınamadı');
    }
};

exports.dbTenantTables = async (req, res) => {
    try {
        const tables = await TenantService.checkTenantTables(req.params.id);
        return successResponse(res, { data: tables });
    } catch (err) {
        return errorResponse(res, 'Tablo bilgileri alınamadı');
    }
};

exports.dbRepairTenant = async (req, res) => {
    try {
        const result = await TenantService.repairTenantTables(req.params.id);
        return successResponse(res, { data: result }, `${result.repaired} tablo onarıldı`);
    } catch (err) {
        return errorResponse(res, 'Onarım hatası');
    }
};

exports.dbMigrations = async (req, res) => {
    try {
        const result = await masterPool.query(`SELECT * FROM migration_log ORDER BY created_at DESC LIMIT 50`);
        return successResponse(res, { data: result.rows });
    } catch (err) {
        return errorResponse(res, 'Migration logları alınamadı');
    }
};

exports.dbRunCustomSQL = async (req, res) => {
    try {
        const { sql, migration_adi, hedef, isletme_id } = req.body;

        let results;
        if (hedef === 'tum') {
            results = await TenantService.runMigrationAll(migration_adi, sql);
        } else if (hedef === 'tek' && isletme_id) {
            const result = await TenantService.runMigration(isletme_id, migration_adi, sql);
            results = [{ isletme_id, ...result }];
        } else {
            // Ortak tablolar
            const startTime = Date.now();
            await masterPool.query(sql);
            await masterPool.query(`
                INSERT INTO migration_log (migration_adi, migration_tipi, durum, sql_icerik, calistiran, sure_ms)
                VALUES ($1, 'ortak', 'basarili', $2, 'admin', $3)
            `, [migration_adi, sql, Date.now() - startTime]);
            results = [{ hedef: 'ortak', success: true }];
        }

        return successResponse(res, { data: results }, 'Migration çalıştırıldı');
    } catch (err) {
        return errorResponse(res, 'SQL çalıştırma hatası: ' + err.message);
    }
};

exports.dbBackups = async (req, res) => {
    try {
        const result = await masterPool.query(`SELECT * FROM yedekleme_log ORDER BY created_at DESC LIMIT 20`);
        return successResponse(res, { data: result.rows });
    } catch (err) {
        return errorResponse(res, 'Yedekleme logları alınamadı');
    }
};

exports.dbCreateBackup = async (req, res) => {
    try {
        // Yedekleme kaydı oluştur (gerçek backup için pg_dump gerekir)
        await masterPool.query(`
            INSERT INTO yedekleme_log (yedek_tipi, hedef, durum, tetikleyen)
            VALUES ($1, $2, 'basarili', 'admin')
        `, [req.body.tur || 'tam', req.body.isletme_id || null]);

        return successResponse(res, {}, 'Yedekleme kaydı oluşturuldu');
    } catch (err) {
        return errorResponse(res, 'Yedekleme hatası');
    }
};

// ═══════════════════════════════════
// SİSTEM AYARLARI
// ═══════════════════════════════════

exports.getSettings = async (req, res) => {
    try {
        const result = await masterPool.query(`SELECT * FROM sistem_ayarlari ORDER BY id`);
        return successResponse(res, { data: result.rows });
    } catch (err) {
        return errorResponse(res, 'Ayarlar alınamadı');
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { ayarlar } = req.body; // [{ayar_adi, ayar_degeri}, ...]
        for (const ayar of ayarlar) {
            await masterPool.query(`
                UPDATE sistem_ayarlari SET ayar_degeri = $1, updated_at = NOW() WHERE ayar_adi = $2
            `, [ayar.ayar_degeri, ayar.ayar_adi]);
        }
        return successResponse(res, {}, 'Ayarlar güncellendi');
    } catch (err) {
        return errorResponse(res, 'Ayarlar güncellenemedi');
    }
};
