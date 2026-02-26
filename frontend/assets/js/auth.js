// frontend/assets/js/auth.js
// Kimlik doğrulama yardımcısı

function checkAuth() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = '/pages/auth/login.html';
        return null;
    }

    try {
        // JWT payload'ını decode et (base64)
        const payload = JSON.parse(atob(token.split('.')[1]));

        // Süre kontrolü
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = '/pages/auth/login.html';
            return null;
        }

        return payload;
    } catch {
        localStorage.removeItem('auth_token');
        window.location.href = '/pages/auth/login.html';
        return null;
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.href = '/pages/auth/login.html';
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user'));
    } catch {
        return null;
    }
}

function getUserInitials() {
    const user = getUser();
    if (!user || !user.ad_soyad) return '?';
    return user.ad_soyad.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}
