// backend/middleware/validate.js
// Input validation kuralları

const { body, param, query, validationResult } = require('express-validator');

// ─── Validation sonuçlarını kontrol et ───
function handleValidation(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Geçersiz giriş verisi',
            errors: errors.array().map(e => ({
                field: e.path,
                message: e.msg
            }))
        });
    }
    next();
}

// ─── Login validation ───
const loginRules = [
    body('kullanici_adi')
        .trim()
        .notEmpty().withMessage('Kullanıcı adı gerekli')
        .isLength({ min: 3, max: 50 }).withMessage('Kullanıcı adı 3-50 karakter olmalı'),
    body('sifre')
        .notEmpty().withMessage('Şifre gerekli')
        .isLength({ min: 4 }).withMessage('Şifre en az 4 karakter olmalı'),
    handleValidation
];

// ─── Şifre sıfırlama validation (WhatsApp OTP) ───
const resetPasswordRules = [
    body('telefon')
        .trim()
        .notEmpty().withMessage('Telefon numarası gerekli')
        .matches(/^[0-9+\- ()]{7,20}$/).withMessage('Geçerli bir telefon numarası girin'),
    handleValidation
];

const newPasswordRules = [
    body('telefon')
        .trim()
        .notEmpty().withMessage('Telefon numarası gerekli'),
    body('otp')
        .trim()
        .notEmpty().withMessage('Doğrulama kodu gerekli')
        .isLength({ min: 6, max: 6 }).withMessage('Doğrulama kodu 6 haneli olmalı')
        .isNumeric().withMessage('Doğrulama kodu sadece rakam olmalı'),
    body('yeni_sifre')
        .isLength({ min: 6 }).withMessage('Şifre en az 6 karakter olmalı')
        .matches(/[a-zA-Z]/).withMessage('Şifre en az bir harf içermeli')
        .matches(/[0-9]/).withMessage('Şifre en az bir rakam içermeli'),
    handleValidation
];

// ─── Randevu validation ───
const appointmentRules = [
    body('musteri_adi')
        .trim()
        .notEmpty().withMessage('Müşteri adı gerekli')
        .isLength({ max: 200 }).withMessage('Müşteri adı çok uzun'),
    body('telefon_no')
        .optional()
        .trim()
        .matches(/^[0-9+\- ()]{7,20}$/).withMessage('Geçersiz telefon numarası'),
    body('baslangic_saati')
        .notEmpty().withMessage('Başlangıç saati gerekli')
        .isISO8601().withMessage('Geçersiz tarih formatı'),
    body('bitis_saati')
        .notEmpty().withMessage('Bitiş saati gerekli')
        .isISO8601().withMessage('Geçersiz tarih formatı'),
    body('uzman')
        .optional()
        .trim()
        .isLength({ max: 100 }),
    handleValidation
];

// ─── Uzman validation ───
const expertRules = [
    body('oda_adi')
        .trim()
        .notEmpty().withMessage('Uzman adı gerekli')
        .isLength({ max: 100 }).withMessage('Uzman adı çok uzun'),
    handleValidation
];

// ─── Müşteri validation ───
const customerRules = [
    body('ad_soyad')
        .trim()
        .notEmpty().withMessage('Ad soyad gerekli')
        .isLength({ max: 200 }),
    body('telefon')
        .optional()
        .trim()
        .matches(/^[0-9+\- ()]{7,20}$/).withMessage('Geçersiz telefon numarası'),
    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Geçersiz email'),
    handleValidation
];

// ─── Hizmet validation ───
const serviceRules = [
    body('hizmet_adi')
        .trim()
        .notEmpty().withMessage('Hizmet adı gerekli')
        .isLength({ max: 200 }),
    body('sure_dakika')
        .isInt({ min: 5, max: 480 }).withMessage('Süre 5-480 dakika arası olmalı'),
    body('fiyat')
        .isFloat({ min: 0 }).withMessage('Fiyat 0 veya üzeri olmalı'),
    handleValidation
];

// ─── İşletme ekleme (süper admin) ───
const businessRules = [
    body('isletme_id')
        .trim()
        .notEmpty().withMessage('İşletme ID gerekli')
        .isLength({ min: 3, max: 50 }).withMessage('İşletme ID 3-50 karakter')
        .matches(/^[a-z0-9_]+$/).withMessage('İşletme ID sadece küçük harf, rakam ve alt çizgi içerebilir'),
    body('kullanici_adi')
        .trim()
        .notEmpty().withMessage('Kullanıcı adı gerekli')
        .isLength({ min: 3, max: 100 }),
    body('ad_soyad')
        .trim()
        .notEmpty().withMessage('Ad soyad gerekli'),
    body('sifre')
        .isLength({ min: 6 }).withMessage('Şifre en az 6 karakter'),
    handleValidation
];

// ─── SQL injection koruması (özel SQL çalıştırma) ───
const sqlRules = [
    body('sql')
        .notEmpty().withMessage('SQL gerekli')
        .custom((value) => {
            const forbidden = [
                /DROP\s+DATABASE/i,
                /DROP\s+TABLE\s+(admin_users|paketler|abonelikler|eklentiler)/i,
                /TRUNCATE\s+(admin_users|paketler|abonelikler|eklentiler)/i,
                /DELETE\s+FROM\s+admin_users/i,
                /ALTER\s+TABLE\s+admin_users\s+DROP/i,
            ];
            for (const pattern of forbidden) {
                if (pattern.test(value)) {
                    throw new Error('Bu SQL komutu güvenlik nedeniyle engellenmiştir');
                }
            }
            return true;
        }),
    body('migration_adi')
        .trim()
        .notEmpty().withMessage('Migration adı gerekli')
        .isLength({ max: 200 }),
    handleValidation
];

module.exports = {
    loginRules,
    resetPasswordRules,
    newPasswordRules,
    appointmentRules,
    expertRules,
    customerRules,
    serviceRules,
    businessRules,
    sqlRules
};
