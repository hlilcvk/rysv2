// backend/routes/appointment.routes.js
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { appointmentRules } = require('../middleware/validate');
const ctrl = require('../controllers/appointment.controller');

router.get('/', auth, ctrl.list);
router.post('/', auth, appointmentRules, ctrl.create);
router.put('/:id', auth, ctrl.update);
router.delete('/:id', auth, ctrl.remove);
router.put('/:id/status', auth, ctrl.updateStatus);
router.get('/summary', auth, ctrl.dailySummary);

// Eski endpoint uyumluluğu (mevcut n8n + frontend)
router.get('/uzmanlar', auth, ctrl.legacyExperts);

module.exports = router;
