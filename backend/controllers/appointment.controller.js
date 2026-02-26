// backend/controllers/appointment.controller.js
const { masterPool } = require('../config/db');
const { successResponse, errorResponse, sanitizeTableName } = require('../utils/helpers');
const logger = require('../utils/logger');

// ─── Randevu Listesi ───
exports.list = async (req, res) => {
    try {
        const { bagli_tablo_adi, isletme_id } = req.user;
        const table = sanitizeTableName(bagli_tablo_adi);
        const { start, end, uzman, durum } = req.query;

        let query = `SELECT * FROM ${table} WHERE 1=1`;
        const params = [];
        let idx = 1;

        if (start) {
            query += ` AND baslangic_saati >= $${idx}`;
            params.push(start);
            idx++;
        }
        if (end) {
            query += ` AND baslangic_saati <= $${idx}`;
            params.push(end);
            idx++;
        }
        if (uzman) {
            query += ` AND uzman = $${idx}`;
            params.push(uzman);
            idx++;
        }
        if (durum) {
            query += ` AND durum = $${idx}`;
            params.push(durum);
            idx++;
        }

        query += ` ORDER BY baslangic_saati ASC`;

        const result = await masterPool.query(query, params);
        return successResponse(res, { data: result.rows });

    } catch (err) {
        logger.error('Randevu listesi hatası:', err.message);
        return errorResponse(res, 'Randevu listesi alınamadı');
    }
};

// ─── Yeni Randevu Oluştur ───
exports.create = async (req, res) => {
    try {
        const { bagli_tablo_adi } = req.user;
        const table = sanitizeTableName(bagli_tablo_adi);
        const {
            musteri_adi, telefon_no, islem_turu, hizmet_id,
            uzman, uzman_id, baslangic_saati, bitis_saati,
            durum, odeme_tutari, kaynak, notlar
        } = req.body;

        const result = await masterPool.query(`
            INSERT INTO ${table} 
            (musteri_adi, telefon_no, islem_turu, hizmet_id, uzman, uzman_id, baslangic_saati, bitis_saati, durum, odeme_tutari, kaynak, notlar)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING *
        `, [
            musteri_adi, telefon_no || null, islem_turu || null, hizmet_id || null,
            uzman || null, uzman_id || null, baslangic_saati, bitis_saati,
            durum || 'bekliyor', odeme_tutari || null, kaynak || 'manuel', notlar || null
        ]);

        logger.info(`Randevu oluşturuldu: ${musteri_adi} — ${baslangic_saati}`);
        return successResponse(res, { data: result.rows[0] }, 'Randevu oluşturuldu', 201);

    } catch (err) {
        logger.error('Randevu oluşturma hatası:', err.message);
        return errorResponse(res, 'Randevu oluşturulamadı');
    }
};

// ─── Randevu Güncelle ───
exports.update = async (req, res) => {
    try {
        const { bagli_tablo_adi } = req.user;
        const table = sanitizeTableName(bagli_tablo_adi);
        const { id } = req.params;
        const {
            musteri_adi, telefon_no, islem_turu, hizmet_id,
            uzman, uzman_id, baslangic_saati, bitis_saati,
            durum, odeme_durumu, odeme_tutari, odeme_yontemi, kaynak, notlar
        } = req.body;

        const result = await masterPool.query(`
            UPDATE ${table} SET
                musteri_adi = COALESCE($1, musteri_adi),
                telefon_no = COALESCE($2, telefon_no),
                islem_turu = COALESCE($3, islem_turu),
                hizmet_id = COALESCE($4, hizmet_id),
                uzman = COALESCE($5, uzman),
                uzman_id = COALESCE($6, uzman_id),
                baslangic_saati = COALESCE($7, baslangic_saati),
                bitis_saati = COALESCE($8, bitis_saati),
                durum = COALESCE($9, durum),
                odeme_durumu = COALESCE($10, odeme_durumu),
                odeme_tutari = COALESCE($11, odeme_tutari),
                odeme_yontemi = COALESCE($12, odeme_yontemi),
                kaynak = COALESCE($13, kaynak),
                notlar = COALESCE($14, notlar),
                updated_at = NOW()
            WHERE id = $15
            RETURNING *
        `, [musteri_adi, telefon_no, islem_turu, hizmet_id, uzman, uzman_id,
            baslangic_saati, bitis_saati, durum, odeme_durumu, odeme_tutari,
            odeme_yontemi, kaynak, notlar, id]);

        if (!result.rows.length) {
            return errorResponse(res, 'Randevu bulunamadı', 404);
        }

        return successResponse(res, { data: result.rows[0] }, 'Randevu güncellendi');

    } catch (err) {
        logger.error('Randevu güncelleme hatası:', err.message);
        return errorResponse(res, 'Randevu güncellenemedi');
    }
};

// ─── Randevu Sil ───
exports.remove = async (req, res) => {
    try {
        const { bagli_tablo_adi } = req.user;
        const table = sanitizeTableName(bagli_tablo_adi);
        const { id } = req.params;

        const result = await masterPool.query(
            `DELETE FROM ${table} WHERE id = $1 RETURNING musteri_adi`,
            [id]
        );

        if (!result.rows.length) {
            return errorResponse(res, 'Randevu bulunamadı', 404);
        }

        return successResponse(res, {}, 'Randevu silindi');

    } catch (err) {
        logger.error('Randevu silme hatası:', err.message);
        return errorResponse(res, 'Randevu silinemedi');
    }
};

// ─── Randevu Durum Güncelle ───
exports.updateStatus = async (req, res) => {
    try {
        const { bagli_tablo_adi } = req.user;
        const table = sanitizeTableName(bagli_tablo_adi);
        const { id } = req.params;
        const { durum, iptal_nedeni } = req.body;

        const validStatuses = ['bekliyor', 'onaylandi', 'tamamlandi', 'iptal', 'gelmedi'];
        if (!validStatuses.includes(durum)) {
            return errorResponse(res, 'Geçersiz durum', 400);
        }

        let query = `UPDATE ${table} SET durum = $1, updated_at = NOW()`;
        const params = [durum];

        if (durum === 'iptal' && iptal_nedeni) {
            query += `, iptal_nedeni = $2 WHERE id = $3 RETURNING *`;
            params.push(iptal_nedeni, id);
        } else {
            query += ` WHERE id = $2 RETURNING *`;
            params.push(id);
        }

        const result = await masterPool.query(query, params);

        if (!result.rows.length) {
            return errorResponse(res, 'Randevu bulunamadı', 404);
        }

        return successResponse(res, { data: result.rows[0] }, `Randevu durumu: ${durum}`);

    } catch (err) {
        logger.error('Durum güncelleme hatası:', err.message);
        return errorResponse(res, 'Durum güncellenemedi');
    }
};

// ─── Günlük Özet ───
exports.dailySummary = async (req, res) => {
    try {
        const { bagli_tablo_adi } = req.user;
        const table = sanitizeTableName(bagli_tablo_adi);
        const { date } = req.query;
        
        const targetDate = date || new Date().toISOString().split('T')[0];
        const dayStart = `${targetDate}T00:00:00`;
        const dayEnd = `${targetDate}T23:59:59`;

        const result = await masterPool.query(`
            SELECT 
                COUNT(*) as toplam,
                COUNT(*) FILTER (WHERE durum = 'tamamlandi') as tamamlanan,
                COUNT(*) FILTER (WHERE durum = 'iptal') as iptal,
                COUNT(*) FILTER (WHERE durum = 'bekliyor' OR durum = 'onaylandi') as bekleyen,
                COALESCE(SUM(odeme_tutari) FILTER (WHERE durum != 'iptal'), 0) as tahmini_ciro,
                COALESCE(SUM(odeme_tutari) FILTER (WHERE durum = 'tamamlandi' AND odeme_durumu = 'odendi'), 0) as gercek_ciro
            FROM ${table}
            WHERE baslangic_saati >= $1 AND baslangic_saati <= $2
        `, [dayStart, dayEnd]);

        return successResponse(res, { data: result.rows[0], date: targetDate });

    } catch (err) {
        logger.error('Günlük özet hatası:', err.message);
        return errorResponse(res, 'Günlük özet alınamadı');
    }
};

// ─── Legacy: Uzman listesi (eski endpoint uyumluluğu) ───
exports.legacyExperts = async (req, res) => {
    try {
        const { isletme_id } = req.user;
        const result = await masterPool.query(
            `SELECT * FROM calisma_odalari WHERE isletme_id = $1 ORDER BY sira ASC, id ASC`,
            [isletme_id]
        );
        return successResponse(res, { data: result.rows });
    } catch (err) {
        return errorResponse(res, 'Uzman listesi alınamadı');
    }
};
