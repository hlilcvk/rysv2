// backend/routes/auth.routes.js
// Auth endpoint'leri

const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { loginRules, resetPasswordRules, newPasswordRules } = require('../middleware/validate');
const ctrl = require('../controllers/auth.controller');

// Public
router.post('/login', authLimiter, loginRules, ctrl.login);
router.post('/reset-password', authLimiter, resetPasswordRules, ctrl.requestReset);
router.post('/reset-password/confirm', authLimiter, newPasswordRules, ctrl.confirmReset);

// Auth gerekli
router.post('/refresh', auth, ctrl.refreshToken);
router.post('/change-password', auth, ctrl.changePassword);
router.get('/me', auth, ctrl.getProfile);

module.exports = router;
