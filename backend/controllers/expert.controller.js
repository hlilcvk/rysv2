// backend/controllers/expert.controller.js
const { masterPool } = require('../config/db');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// Varsayılan renk paleti
const COLORS = ['#7C6FE7', '#22D3EE', '#FBB524', '#F472B6', '#34D399', '#F97316', '#8B5CF6', '#EF4444'];

// ─── Uzman Listesi ───
exports.list = async (req, res) => {
    try {
        const { isletme_id } = req.user;
        const result = await masterPool.query(
            `SELECT * FROM calisma_odalari WHERE isletme_id = $1 ORDER BY sira ASC, id ASC`,
            [isletme_id]
        );
        return successResponse(res, { data: result.rows });
    } catch (err) {
        logger.error('Uzman listesi hatası:', err.message);
        return errorResponse(res, 'Uzman listesi alınamadı');
    }
};

// ─── Yeni Uzman Ekle ───
exports.create = async (req, res) => {
    try {
        const { isletme_id } = req.user;
        const { oda_adi, uzmanlik, renk, telefon, email, calisma_baslangic, calisma_bitis, calisma_gunleri } = req.body;

        // Mevcut uzman sayısını kontrol et (limit)
        const countResult = await masterPool.query(
            `SELECT COUNT(*) as c FROM calisma_odalari WHERE isletme_id = $1 AND is_active = true`,
            [isletme_id]
        );
        const currentCount = parseInt(countResult.rows[0].c);

        // Sıra numarası
        const orderResult = await masterPool.query(
            `SELECT COALESCE(MAX(sira), 0) + 1 as next FROM calisma_odalari WHERE isletme_id = $1`,
            [isletme_id]
        );

        // Renk atama (verilmediyse sıradaki renk)
        const assignedColor = renk || COLORS[currentCount % COLORS.length];

        const result = await masterPool.query(`
            INSERT INTO calisma_odalari (isletme_id, oda_adi, uzmanlik, renk, telefon, email, calisma_baslangic, calisma_bitis, calisma_gunleri, sira, is_active, aktif)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, true)
            RETURNING *
        `, [
            isletme_id,
            oda_adi,
            uzmanlik || null,
            assignedColor,
            telefon || null,
            email || null,
            calisma_baslangic || '09:00',
            calisma_bitis || '20:00',
            calisma_gunleri || [1, 2, 3, 4, 5, 6],
            orderResult.rows[0].next
        ]);

        logger.info(`Uzman eklendi: ${oda_adi} (${isletme_id})`);
        return successResponse(res, { data: result.rows[0] }, 'Uzman başarıyla eklendi', 201);

    } catch (err) {
        logger.error('Uzman ekleme hatası:', err.message);
        return errorResponse(res, 'Uzman eklenemedi');
    }
};

// ─── Uzman Güncelle ───
exports.update = async (req, res) => {
    try {
        const { isletme_id } = req.user;
        const { id } = req.params;
        const { oda_adi, uzmanlik, renk, telefon, email, calisma_baslangic, calisma_bitis, calisma_gunleri } = req.body;

        const result = await masterPool.query(`
            UPDATE calisma_odalari SET
                oda_adi = COALESCE($1, oda_adi),
                uzmanlik = COALESCE($2, uzmanlik),
                renk = COALESCE($3, renk),
                telefon = COALESCE($4, telefon),
                email = COALESCE($5, email),
                calisma_baslangic = COALESCE($6, calisma_baslangic),
                calisma_bitis = COALESCE($7, calisma_bitis),
                calisma_gunleri = COALESCE($8, calisma_gunleri)
            WHERE id = $9 AND isletme_id = $10
            RETURNING *
        `, [oda_adi, uzmanlik, renk, telefon, email, calisma_baslangic, calisma_bitis, calisma_gunleri, id, isletme_id]);

        if (!result.rows.length) {
            return errorResponse(res, 'Uzman bulunamadı', 404);
        }

        return successResponse(res, { data: result.rows[0] }, 'Uzman güncellendi');

    } catch (err) {
        logger.error('Uzman güncelleme hatası:', err.message);
        return errorResponse(res, 'Uzman güncellenemedi');
    }
};

// ─── Uzman Aktif/Pasif Toggle ───
exports.toggle = async (req, res) => {
    try {
        const { isletme_id } = req.user;
        const { id } = req.params;

        const result = await masterPool.query(`
            UPDATE calisma_odalari SET is_active = NOT is_active, aktif = NOT aktif
            WHERE id = $1 AND isletme_id = $2
            RETURNING id, oda_adi, is_active
        `, [id, isletme_id]);

        if (!result.rows.length) {
            return errorResponse(res, 'Uzman bulunamadı', 404);
        }

        const status = result.rows[0].is_active ? 'aktif' : 'pasif';
        return successResponse(res, { data: result.rows[0] }, `Uzman ${status} yapıldı`);

    } catch (err) {
        logger.error('Uzman toggle hatası:', err.message);
        return errorResponse(res, 'İşlem başarısız');
    }
};

// ─── Uzman Sil ───
exports.remove = async (req, res) => {
    try {
        const { isletme_id } = req.user;
        const { id } = req.params;

        const result = await masterPool.query(
            `DELETE FROM calisma_odalari WHERE id = $1 AND isletme_id = $2 RETURNING oda_adi`,
            [id, isletme_id]
        );

        if (!result.rows.length) {
            return errorResponse(res, 'Uzman bulunamadı', 404);
        }

        logger.info(`Uzman silindi: ${result.rows[0].oda_adi} (${isletme_id})`);
        return successResponse(res, {}, 'Uzman silindi');

    } catch (err) {
        logger.error('Uzman silme hatası:', err.message);
        return errorResponse(res, 'Uzman silinemedi');
    }
};

// ─── Uzman Sıralama ───
exports.reorder = async (req, res) => {
    try {
        const { isletme_id } = req.user;
        const { id } = req.params;
        const { sira } = req.body;

        await masterPool.query(
            `UPDATE calisma_odalari SET sira = $1 WHERE id = $2 AND isletme_id = $3`,
            [sira, id, isletme_id]
        );

        return successResponse(res, {}, 'Sıralama güncellendi');

    } catch (err) {
        return errorResponse(res, 'Sıralama güncellenemedi');
    }
};
