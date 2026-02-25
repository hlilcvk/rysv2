// backend/middleware/subscription.js
// Abonelik kontrolü + özellik kilidi

const { masterPool } = require('../config/db');
const { FEATURES, SUBSCRIPTION_STATUS } = require('../config/constants');

// ─── Özellik kontrolü ───
// Kullanım: router.get('/crm', auth, checkFeature('crm'), ctrl.list)
function checkFeature(featureName) {
    return async (req, res, next) => {
        try {
            // Süper admin her şeye erişir
            if (req.user.is_super_admin) return next();

            const { isletme_id } = req.user;

            // Abonelik bilgisini getir
            const sub = await masterPool.query(`
                SELECT a.durum, a.bitis_tarihi, p.paket_kodu, p.ozellikler
                FROM abonelikler a
                JOIN paketler p ON p.id = a.paket_id
                WHERE a.isletme_id = $1 AND a.durum IN ($2, $3, $4)
                ORDER BY a.created_at DESC LIMIT 1
            `, [isletme_id, SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIAL, SUBSCRIPTION_STATUS.GIFT]);

            if (!sub.rows.length) {
                return res.status(403).json({
                    success: false,
                    message: 'Aktif aboneliğiniz bulunmuyor',
                    code: 'NO_SUBSCRIPTION'
                });
            }

            const { durum, paket_kodu, ozellikler } = sub.rows[0];

            // Deneme süresinde tüm özellikler açık
            if (durum === SUBSCRIPTION_STATUS.TRIAL) return next();

            // Hediye abonelikte tüm özellikler açık
            if (durum === SUBSCRIPTION_STATUS.GIFT) return next();

            // Özellik kontrolü
            const features = typeof ozellikler === 'string' ? JSON.parse(ozellikler) : ozellikler;

            if (features[featureName] === false) {
                return res.status(403).json({
                    success: false,
                    message: `Bu özellik "${paket_kodu}" paketinizde mevcut değil. Profesyonel pakete geçerek erişebilirsiniz.`,
                    code: 'FEATURE_LOCKED',
                    feature: featureName,
                    current_package: paket_kodu,
                    upgrade_needed: true
                });
            }

            // Özellik açık, devam et
            req.subscription = { durum, paket_kodu, ozellikler: features };
            next();

        } catch (err) {
            console.error('Subscription check error:', err.message);
            // Hata durumunda geçişe izin ver (soft fail)
            next();
        }
    };
}

// ─── Abonelik durumu kontrolü (sadece aktiflik) ───
async function checkActive(req, res, next) {
    try {
        if (req.user.is_super_admin) return next();

        const { isletme_id } = req.user;

        const sub = await masterPool.query(`
            SELECT durum, bitis_tarihi FROM abonelikler
            WHERE isletme_id = $1 AND durum IN ($2, $3, $4)
            ORDER BY created_at DESC LIMIT 1
        `, [isletme_id, SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIAL, SUBSCRIPTION_STATUS.GIFT]);

        if (!sub.rows.length) {
            return res.status(403).json({
                success: false,
                message: 'Aktif aboneliğiniz bulunmuyor',
                code: 'NO_SUBSCRIPTION'
            });
        }

        // Deneme süresi kontrolü
        if (sub.rows[0].durum === SUBSCRIPTION_STATUS.TRIAL) {
            const bitis = new Date(sub.rows[0].bitis_tarihi);
            if (bitis < new Date()) {
                return res.status(403).json({
                    success: false,
                    message: 'Deneme süreniz dolmuştur. Devam etmek için bir paket seçin.',
                    code: 'TRIAL_EXPIRED'
                });
            }
        }

        next();
    } catch (err) {
        console.error('Active check error:', err.message);
        next();
    }
}

module.exports = { checkFeature, checkActive };
