// backend/utils/helpers.js
// Genel yardımcı fonksiyonlar

// Tablo adı sanitize (SQL injection koruması)
function sanitizeTableName(name) {
    return name.replace(/[^a-z0-9_]/gi, '').toLowerCase();
}

// İşletme ID doğrulama
function isValidIsletmeId(id) {
    return /^[a-z0-9_]{3,50}$/.test(id);
}

// Tarih formatla (TR)
function formatDateTR(date) {
    const d = new Date(date);
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                     'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Mevcut dönem (2026-02 formatı)
function getCurrentPeriod() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Para formatla
function formatCurrency(amount, currency = 'TRY') {
    if (currency === 'USD') return `$${Number(amount).toFixed(2)}`;
    return `₺${Number(amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
}

// Telefon numarası normalize
function normalizePhone(phone) {
    if (!phone) return null;
    let clean = phone.replace(/[^0-9+]/g, '');
    // 05XX → +905XX
    if (clean.startsWith('0') && clean.length === 11) {
        clean = '+9' + clean;
    }
    // 5XX → +905XX
    if (clean.startsWith('5') && clean.length === 10) {
        clean = '+90' + clean;
    }
    return clean;
}

// Sayfa ve limit parametrelerini parse et
function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

// Başarılı response helper
function successResponse(res, data, message = 'İşlem başarılı', statusCode = 200) {
    return res.status(statusCode).json({ success: true, message, ...data });
}

// Hata response helper
function errorResponse(res, message = 'Bir hata oluştu', statusCode = 500, code = null) {
    const response = { success: false, message };
    if (code) response.code = code;
    return res.status(statusCode).json(response);
}

module.exports = {
    sanitizeTableName,
    isValidIsletmeId,
    formatDateTR,
    getCurrentPeriod,
    formatCurrency,
    normalizePhone,
    parsePagination,
    successResponse,
    errorResponse
};
