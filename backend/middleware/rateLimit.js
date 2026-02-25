// backend/middleware/rateLimit.js
// Rate limiting — kaba kuvvet saldırılarına karşı koruma

const rateLimit = require('express-rate-limit');
const { RATE_LIMITS } = require('../config/constants');

// ─── Auth rate limit (login denemesi) ───
const authLimiter = rateLimit({
    windowMs: RATE_LIMITS.AUTH.windowMs,
    max: RATE_LIMITS.AUTH.max,
    message: {
        success: false,
        message: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.',
        code: 'RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip
});

// ─── Genel API rate limit ───
const apiLimiter = rateLimit({
    windowMs: RATE_LIMITS.API.windowMs,
    max: RATE_LIMITS.API.max,
    message: {
        success: false,
        message: 'Çok fazla istek. Lütfen biraz bekleyin.',
        code: 'RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.isletme_id || req.ip
});

// ─── DB Admin işlemleri rate limit ───
const dbAdminLimiter = rateLimit({
    windowMs: RATE_LIMITS.DB_ADMIN.windowMs,
    max: RATE_LIMITS.DB_ADMIN.max,
    message: {
        success: false,
        message: 'Çok fazla veritabanı işlemi. 1 dakika sonra tekrar deneyin.',
        code: 'RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = { authLimiter, apiLimiter, dbAdminLimiter };
