// backend/controllers/service.controller.js
const { masterPool } = require('../config/db');
const { successResponse, errorResponse, sanitizeTableName } = require('../utils/helpers');
const logger = require('../utils/logger');

// ─── Hizmet Listesi ───
exports.list = async (req, res) => {
    try {
        const { isletme_id } = req.user;
        const table = `${sanitizeTableName(isletme_id)}_hizmetler`;

        const result = await masterPool.query(
            `SELECT * FROM ${table} ORDER BY sira ASC, id ASC`
        );
        return successResponse(res, { data: result.rows });

    } catch (err) {
        logger.error('Hizmet listesi hatası:', err.message);
        return errorResponse(res, 'Hizmet listesi alınamadı');
    }
};

// ─── Yeni Hizmet Ekle ───
exports.create = async (req, res) => {
    try {
        const { isletme_id } = req.user;
        const table = `${sanitizeTableName(isletme_id)}_hizmetler`;
        const { hizmet_adi, kategori, sure_dakika, fiyat, para_birimi, aciklama, renk } = req.body;

        // Sıra
        const orderResult = await masterPool.query(
            `SELECT COALESCE(MAX(sira), 0) + 1 as next FROM ${table}`
        );

        const result = await masterPool.query(`
            INSERT INTO ${table} (hizmet_adi, kategori, sure_dakika, fiyat, para_birimi, aciklama, renk, sira)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            hizmet_adi,
            kategori || null,
            sure_dakika || 60,
            fiyat || 0,
            para_birimi || 'TRY',
            aciklama || null,
            renk || null,
            orderResult.rows[0].next
        ]);

        logger.info(`Hizmet eklendi: ${hizmet_adi} (${isletme_id})`);
        return successResponse(res, { data: result.rows[0] }, 'Hizmet eklendi', 201);

    } catch (err) {
        logger.error('Hizmet ekleme hatası:', err.message);
        return errorResponse(res, 'Hizmet eklenemedi');
    }
};

// ─── Hizmet Güncelle ───
exports.update = async (req, res) => {
    try {
        const { isletme_id } = req.user;
        const table = `${sanitizeTableName(isletme_id)}_hizmetler`;
        const { id } = req.params;
        const { hizmet_adi, kategori, sure_dakika, fiyat, para_birimi, aciklama, renk } = req.body;

        const result = await masterPool.query(`
            UPDATE ${table} SET
                hizmet_adi = COALESCE($1, hizmet_adi),
                kategori = COALESCE($2, kategori),
                sure_dakika = COALESCE($3, sure_dakika),
                fiyat = COALESCE($4, fiyat),
                para_birimi = COALESCE($5, para_birimi),
                aciklama = COALESCE($6, aciklama),
                renk = COALESCE($7, renk)
            WHERE id = $8
            RETURNING *
        `, [hizmet_adi, kategori, sure_dakika, fiyat, para_birimi, aciklama, renk, id]);

        if (!result.rows.length) {
            return errorResponse(res, 'Hizmet bulunamadı', 404);
        }

        return successResponse(res, { data: result.rows[0] }, 'Hizmet güncellendi');

    } catch (err) {
        logger.error('Hizmet güncelleme hatası:', err.message);
        return errorResponse(res, 'Hizmet güncellenemedi');
    }
};

// ─── Hizmet Aktif/Pasif ───
exports.toggle = async (req, res) => {
    try {
        const { isletme_id } = req.user;
        const table = `${sanitizeTableName(isletme_id)}_hizmetler`;
        const { id } = req.params;

        const result = await masterPool.query(`
            UPDATE ${table} SET is_active = NOT is_active
            WHERE id = $1
            RETURNING id, hizmet_adi, is_active
        `, [id]);

        if (!result.rows.length) {
            return errorResponse(res, 'Hizmet bulunamadı', 404);
        }

        return successResponse(res, { data: result.rows[0] });

    } catch (err) {
        return errorResponse(res, 'İşlem başarısız');
    }
};

// ─── Hizmet Sil ───
exports.remove = async (req, res) => {
    try {
        const { isletme_id } = req.user;
        const table = `${sanitizeTableName(isletme_id)}_hizmetler`;
        const { id } = req.params;

        const result = await masterPool.query(
            `DELETE FROM ${table} WHERE id = $1 RETURNING hizmet_adi`, [id]
        );

        if (!result.rows.length) {
            return errorResponse(res, 'Hizmet bulunamadı', 404);
        }

        logger.info(`Hizmet silindi: ${result.rows[0].hizmet_adi} (${isletme_id})`);
        return successResponse(res, {}, 'Hizmet silindi');

    } catch (err) {
        return errorResponse(res, 'Hizmet silinemedi');
    }
};
