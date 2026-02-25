// backend/controllers/auth.controller.js
// Auth iş mantığı

const bcrypt = require('bcryptjs');
const { masterPool } = require('../config/db');
const { generateToken } = require('../middleware/auth');
const { generateRandomToken } = require('../utils/crypto');
const { successResponse, errorResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// ─── Login ───
exports.login = async (req, res) => {
    try {
        const { kullanici_adi, sifre } = req.body;

        // Kullanıcıyı bul
        const result = await masterPool.query(
            `SELECT * FROM admin_users WHERE kullanici_adi = $1`,
            [kullanici_adi]
        );

        if (!result.rows.length) {
            return errorResponse(res, 'Kullanıcı adı veya şifre hatalı', 401);
        }

        const user = result.rows[0];

        // Şifre kontrolü
        const isValid = await bcrypt.compare(sifre, user.sifre);
        if (!isValid) {
            return errorResponse(res, 'Kullanıcı adı veya şifre hatalı', 401);
        }

        // Token oluştur
        const token = generateToken(user);

        // Son giriş zamanını güncelle
        await masterPool.query(
            `UPDATE admin_users SET son_giris = NOW() WHERE id = $1`,
            [user.id]
        ).catch(() => {}); // Hata olursa sessizce geç

        logger.info(`Giriş başarılı: ${kullanici_adi} (${user.isletme_id || 'super_admin'})`);

        return successResponse(res, {
            token,
            user: {
                id: user.id,
                ad_soyad: user.ad_soyad,
                kullanici_adi: user.kullanici_adi,
                isletme_id: user.isletme_id,
                is_super_admin: user.is_super_admin
            }
        }, 'Giriş başarılı');

    } catch (err) {
        logger.error('Login hatası:', err.message);
        return errorResponse(res, 'Giriş sırasında bir hata oluştu');
    }
};

// ─── Şifre sıfırlama isteği (WhatsApp OTP) ───
exports.requestReset = async (req, res) => {
    try {
        const { telefon } = req.body;

        if (!telefon) {
            return errorResponse(res, 'Telefon numarası gerekli', 400);
        }

        // Telefon numarasını normalize et
        const { normalizePhone } = require('../utils/helpers');
        const normalizedPhone = normalizePhone(telefon);

        // Kullanıcıyı bul
        const result = await masterPool.query(
            `SELECT id, ad_soyad, telefon FROM admin_users WHERE telefon = $1 OR telefon = $2`,
            [telefon, normalizedPhone]
        );

        // Bulunamasa bile aynı mesajı ver (güvenlik — numaranın kayıtlı olup olmadığını ifşa etme)
        if (!result.rows.length) {
            return successResponse(res, {},
                'Eğer bu numara kayıtlı ise WhatsApp ile doğrulama kodu gönderildi');
        }

        const user = result.rows[0];

        // 6 haneli OTP oluştur
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 dakika geçerli

        // OTP'yi DB'ye kaydet
        await masterPool.query(`
            UPDATE admin_users 
            SET reset_token = $1, reset_token_expiry = $2
            WHERE id = $3
        `, [otp, expiry, user.id]);

        // WhatsApp ile OTP gönder
        // MessagingService hazır olduğunda burada çağrılacak:
        // await MessagingService.sendText(null, normalizedPhone, 
        //     `🔐 RandevuCRM Şifre Sıfırlama\n\nDoğrulama kodunuz: *${otp}*\n\nBu kod 10 dakika geçerlidir.\nEğer bu isteği siz yapmadıysanız bu mesajı dikkate almayın.`
        // );

        // TODO: Geçici olarak console'a yazdır (geliştirme aşaması)
        logger.info(`OTP gönderildi: ${normalizedPhone} → ${otp}`);

        return successResponse(res, { 
            telefon_masked: telefon.slice(0, 4) + '***' + telefon.slice(-2) 
        }, 'Eğer bu numara kayıtlı ise WhatsApp ile doğrulama kodu gönderildi');

    } catch (err) {
        logger.error('Şifre sıfırlama hatası:', err.message);
        return errorResponse(res, 'İşlem sırasında bir hata oluştu');
    }
};

// ─── OTP doğrulama + yeni şifre belirleme ───
exports.confirmReset = async (req, res) => {
    try {
        const { telefon, otp, yeni_sifre } = req.body;

        if (!telefon || !otp || !yeni_sifre) {
            return errorResponse(res, 'Telefon, doğrulama kodu ve yeni şifre gerekli', 400);
        }

        if (yeni_sifre.length < 6) {
            return errorResponse(res, 'Yeni şifre en az 6 karakter olmalı', 400);
        }

        const { normalizePhone } = require('../utils/helpers');
        const normalizedPhone = normalizePhone(telefon);

        // OTP'yi kontrol et
        const result = await masterPool.query(`
            SELECT id FROM admin_users 
            WHERE (telefon = $1 OR telefon = $2) 
              AND reset_token = $3 
              AND reset_token_expiry > NOW()
        `, [telefon, normalizedPhone, otp]);

        if (!result.rows.length) {
            return errorResponse(res, 'Doğrulama kodu hatalı veya süresi dolmuş', 400);
        }

        // Yeni şifreyi hashle
        const hashedPassword = await bcrypt.hash(yeni_sifre, 10);

        // Güncelle ve OTP'yi temizle
        await masterPool.query(`
            UPDATE admin_users 
            SET sifre = $1, reset_token = NULL, reset_token_expiry = NULL
            WHERE id = $2
        `, [hashedPassword, result.rows[0].id]);

        logger.info(`Şifre sıfırlandı (WhatsApp OTP): user_id=${result.rows[0].id}`);

        return successResponse(res, {}, 'Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.');

    } catch (err) {
        logger.error('Şifre sıfırlama onay hatası:', err.message);
        return errorResponse(res, 'İşlem sırasında bir hata oluştu');
    }
};

// ─── Token yenile ───
exports.refreshToken = async (req, res) => {
    try {
        const newToken = generateToken(req.user);
        return successResponse(res, { token: newToken }, 'Token yenilendi');
    } catch (err) {
        return errorResponse(res, 'Token yenilenemedi');
    }
};

// ─── Şifre değiştir (giriş yapmış kullanıcı) ───
exports.changePassword = async (req, res) => {
    try {
        const { mevcut_sifre, yeni_sifre } = req.body;

        if (!mevcut_sifre || !yeni_sifre) {
            return errorResponse(res, 'Mevcut ve yeni şifre gerekli', 400);
        }

        if (yeni_sifre.length < 6) {
            return errorResponse(res, 'Yeni şifre en az 6 karakter olmalı', 400);
        }

        // Mevcut şifreyi kontrol et
        const result = await masterPool.query(
            `SELECT sifre FROM admin_users WHERE id = $1`, [req.user.id]
        );

        const isValid = await bcrypt.compare(mevcut_sifre, result.rows[0].sifre);
        if (!isValid) {
            return errorResponse(res, 'Mevcut şifre hatalı', 401);
        }

        // Yeni şifreyi hashle ve kaydet
        const hashed = await bcrypt.hash(yeni_sifre, 10);
        await masterPool.query(
            `UPDATE admin_users SET sifre = $1 WHERE id = $2`,
            [hashed, req.user.id]
        );

        logger.info(`Şifre değiştirildi: user_id=${req.user.id}`);

        return successResponse(res, {}, 'Şifreniz başarıyla güncellendi');

    } catch (err) {
        logger.error('Şifre değiştirme hatası:', err.message);
        return errorResponse(res, 'İşlem sırasında bir hata oluştu');
    }
};

// ─── Profil bilgisi ───
exports.getProfile = async (req, res) => {
    try {
        const result = await masterPool.query(
            `SELECT id, isletme_id, kullanici_adi, ad_soyad, email, is_super_admin, created_at, son_giris
             FROM admin_users WHERE id = $1`,
            [req.user.id]
        );

        if (!result.rows.length) {
            return errorResponse(res, 'Kullanıcı bulunamadı', 404);
        }

        return successResponse(res, { user: result.rows[0] });

    } catch (err) {
        return errorResponse(res, 'Profil bilgisi alınamadı');
    }
};
