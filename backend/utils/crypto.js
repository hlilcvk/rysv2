// backend/utils/crypto.js
// AES-256 şifreleme — API key, token gibi hassas veriler için

const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-CHANGE-THIS-IN-PRODUCTION';

// Şifrele
function encrypt(text) {
    if (!text) return null;
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

// Çöz
function decrypt(ciphertext) {
    if (!ciphertext) return null;
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch {
        return null;
    }
}

// Rastgele token oluştur
function generateRandomToken(length = 32) {
    return CryptoJS.lib.WordArray.random(length).toString(CryptoJS.enc.Hex);
}

module.exports = { encrypt, decrypt, generateRandomToken };
