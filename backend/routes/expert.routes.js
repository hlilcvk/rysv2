// backend/routes/expert.routes.js
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { expertRules } = require('../middleware/validate');
const ctrl = require('../controllers/expert.controller');

router.get('/', auth, ctrl.list);
router.post('/', auth, expertRules, ctrl.create);
router.put('/:id', auth, ctrl.update);
router.delete('/:id', auth, ctrl.remove);
router.put('/:id/toggle', auth, ctrl.toggle);
router.put('/:id/order', auth, ctrl.reorder);

module.exports = router;
