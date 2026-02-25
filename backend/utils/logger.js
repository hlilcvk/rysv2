// backend/utils/logger.js
// Basit loglama sistemi

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const currentLevel = process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

function timestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

const logger = {
    error: (msg, data = null) => {
        if (currentLevel >= LOG_LEVELS.ERROR)
            console.error(`❌ [${timestamp()}] ERROR: ${msg}`, data || '');
    },
    warn: (msg, data = null) => {
        if (currentLevel >= LOG_LEVELS.WARN)
            console.warn(`⚠️  [${timestamp()}] WARN: ${msg}`, data || '');
    },
    info: (msg, data = null) => {
        if (currentLevel >= LOG_LEVELS.INFO)
            console.log(`ℹ️  [${timestamp()}] INFO: ${msg}`, data || '');
    },
    debug: (msg, data = null) => {
        if (currentLevel >= LOG_LEVELS.DEBUG)
            console.log(`🔍 [${timestamp()}] DEBUG: ${msg}`, data || '');
    }
};

module.exports = logger;
