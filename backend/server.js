// backend/server.js
// Ana sunucu — route bağlama + başlatma

require('dotenv').config();

const app = require('./app');
const path = require('path');
const { testConnection, getStats, masterPool } = require('./config/db');
const logger = require('./utils/logger');

// ══════════════════════════════════════
// ROUTE BAĞLAMA
// ══════════════════════════════════════

// Auth
app.use('/api/auth', require('./routes/auth.routes'));

// Uzmanlar
app.use('/api/experts', require('./routes/expert.routes'));

// Randevular
app.use('/api/appointments', require('./routes/appointment.routes'));

// Hizmetler
app.use('/api/services', require('./routes/service.routes'));

// Legacy uyumluluk (eski frontend /api/appointments/uzmanlar kullanıyor)
const { auth: authMw } = require('./middleware/auth');
const appointmentCtrl = require('./controllers/appointment.controller');
app.get('/api/appointments/uzmanlar', authMw, appointmentCtrl.legacyExperts);

// Health check endpoints (public — test sayfası için)
app.get('/api/health/db', async (req, res) => {
    const result = await testConnection();
    res.json(result);
});
app.get('/api/health/tables', async (req, res) => {
    try {
        const requiredTables = [
            'admin_users', 'paketler', 'eklentiler', 'abonelikler',
            'isletme_eklentileri', 'kullanim_sayaclari', 'fatura_entegrasyonlari',
            'platform_odemeler', 'kuponlar', 'hediyeler', 'calisma_odalari',
            'db_ayarlari', 'migration_log', 'yedekleme_log', 'sistem_ayarlari'
        ];
        const tables = [];
        for (const name of requiredTables) {
            const exists = await masterPool.query(
                `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`, [name]
            );
            tables.push({ name, exists: exists.rows[0].exists });
        }
        res.json({ success: true, tables });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// TODO: Sonraki modüller eklenecek
// app.use('/api/customers',     require('./routes/customer.routes'));
// app.use('/api/notifications', require('./routes/notification.routes'));
// app.use('/api/surveys',       require('./routes/survey.routes'));
// app.use('/api/finance',       require('./routes/finance.routes'));
// app.use('/api/invoices',      require('./routes/invoice.routes'));
// app.use('/api/subscriptions', require('./routes/subscription.routes'));
// app.use('/api/messaging',     require('./routes/messaging.routes'));
// app.use('/api/analytics',     require('./routes/analytics.routes'));
// app.use('/api/settings',      require('./routes/settings.routes'));
// app.use('/api/admin',         require('./routes/admin.routes'));
// app.use('/api/n8n',           require('./routes/n8n.routes'));

// ══════════════════════════════════════
// STATIC FRONTEND
// ══════════════════════════════════════

const express = require('express');

// Frontend dosyalarını sun
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Logo uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// SPA fallback — bilinen API dışı route'ları frontend'e yönlendir
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: 'Endpoint bulunamadı' });
    }
    res.sendFile(path.join(__dirname, '..', 'frontend', 'pages', 'auth', 'login.html'));
});

// ══════════════════════════════════════
// HATA YÖNETİMİ
// ══════════════════════════════════════

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Beklenmeyen hata:', err.message);
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Sunucu hatası oluştu'
            : err.message
    });
});

// ══════════════════════════════════════
// SUNUCU BAŞLAT
// ══════════════════════════════════════

const PORT = process.env.PORT || 3000;

async function start() {
    // DB bağlantı testi
    const dbStatus = await testConnection();
    if (dbStatus.success) {
        logger.info(`PostgreSQL bağlantısı başarılı`);
    } else {
        logger.error('PostgreSQL bağlantı hatası:', dbStatus.error);
        logger.warn('Sunucu DB olmadan başlatılıyor...');
    }

    app.listen(PORT, () => {
        logger.info(`🚀 RandevuCRM v2.0 — Port: ${PORT}`);
        logger.info(`📁 Frontend: /frontend`);
        logger.info(`🔗 API: /api`);
        logger.info(`🌍 Ortam: ${process.env.NODE_ENV || 'development'}`);
    });
}

start();
