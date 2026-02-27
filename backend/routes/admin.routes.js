// backend/routes/admin.routes.js
const router = require('express').Router();
const { auth, superAdmin } = require('../middleware/auth');
const { businessRules, sqlRules } = require('../middleware/validate');
const { dbAdminLimiter } = require('../middleware/rateLimit');
const ctrl = require('../controllers/admin.controller');

// Tüm route'lar auth + superAdmin gerektirir
router.use(auth, superAdmin);

// ─── İşletme Yönetimi ───
router.get('/businesses', ctrl.listBusinesses);
router.post('/businesses', businessRules, ctrl.createBusiness);
router.put('/businesses/:id', ctrl.updateBusiness);
router.delete('/businesses/:id', ctrl.deleteBusiness);
router.put('/businesses/:id/toggle', ctrl.toggleBusiness);

// ─── Platform Finans ───
router.get('/finance/summary', ctrl.financeSummary);
router.get('/finance/payments', ctrl.listPayments);

// ─── Abonelik Yönetimi ───
router.get('/subscriptions', ctrl.listSubscriptions);
router.put('/subscriptions/:isletme_id', ctrl.updateSubscription);
router.post('/subscriptions/:isletme_id/gift', ctrl.giftSubscription);

// ─── Kupon Yönetimi ───
router.get('/coupons', ctrl.listCoupons);
router.post('/coupons', ctrl.createCoupon);
router.put('/coupons/:id', ctrl.updateCoupon);
router.delete('/coupons/:id', ctrl.deleteCoupon);

// ─── DB Yönetimi ───
router.get('/db/stats', dbAdminLimiter, ctrl.dbStats);
router.get('/db/tenants', dbAdminLimiter, ctrl.dbTenants);
router.get('/db/tenants/:id/tables', dbAdminLimiter, ctrl.dbTenantTables);
router.post('/db/tenants/:id/repair', dbAdminLimiter, ctrl.dbRepairTenant);
router.get('/db/migrations', ctrl.dbMigrations);
router.post('/db/migrations/custom', dbAdminLimiter, sqlRules, ctrl.dbRunCustomSQL);
router.get('/db/backups', ctrl.dbBackups);
router.post('/db/backups/create', dbAdminLimiter, ctrl.dbCreateBackup);

// ─── Sistem Ayarları ───
router.get('/settings', ctrl.getSettings);
router.put('/settings', ctrl.updateSettings);

module.exports = router;
