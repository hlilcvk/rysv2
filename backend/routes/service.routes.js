// backend/routes/service.routes.js
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { serviceRules } = require('../middleware/validate');
const ctrl = require('../controllers/service.controller');

router.get('/', auth, ctrl.list);
router.post('/', auth, serviceRules, ctrl.create);
router.put('/:id', auth, ctrl.update);
router.delete('/:id', auth, ctrl.remove);
router.put('/:id/toggle', auth, ctrl.toggle);

module.exports = router;
