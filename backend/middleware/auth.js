// backend/middleware/auth.js
// JWT doğrulama + rol kontrolü

const jwt = require('jsonwebtoken');
const { masterPool } = require('../config/db');

// ─── Ana auth middleware ───
function auth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Token bulunamadı' });
        }

        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Oturum süresi doldu', code: 'TOKEN_EXPIRED' });
        }
        return res.status(401).json({ success: false, message: 'Geçersiz token' });
    }
}

// ─── Süper admin kontrolü ───
function superAdmin(req, res, next) {
    if (!req.user || !req.user.is_super_admin) {
        return res.status(403).json({ success: false, message: 'Bu işlem için süper admin yetkisi gerekli' });
    }
    next();
}

// ─── İşletme sahibi kontrolü (süper admin değil) ───
function businessOwner(req, res, next) {
    if (!req.user || !req.user.isletme_id) {
        return res.status(403).json({ success: false, message: 'İşletme bilgisi bulunamadı' });
    }
    next();
}

// ─── Token oluşturma ───
function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            isletme_id: user.isletme_id,
            kullanici_adi: user.kullanici_adi,
            ad_soyad: user.ad_soyad,
            bagli_tablo_adi: user.bagli_tablo_adi,
            is_super_admin: user.is_super_admin || false
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
}

// ─── Token yenileme ───
function refreshToken(req, res) {
    try {
        const newToken = generateToken(req.user);
        res.json({ success: true, token: newToken });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Token yenilenemedi' });
    }
}

module.exports = { auth, superAdmin, businessOwner, generateToken, refreshToken };
