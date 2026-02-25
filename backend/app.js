// backend/app.js
// Express app tanımı + güvenlik middleware'leri

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { apiLimiter } = require('./middleware/rateLimit');

const app = express();

// ─── Güvenlik ───
app.use(helmet({
    contentSecurityPolicy: false,      // Frontend inline script'ler için
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || '*'
        : '*',
    credentials: true
}));

// ─── Body parsing ───
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate limit (genel API) ───
app.use('/api', apiLimiter);

// ─── Request logging (development) ───
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        if (req.path.startsWith('/api')) {
            console.log(`${req.method} ${req.path}`);
        }
        next();
    });
}

// ─── Health check ───
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '2.0.0',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

module.exports = app;
