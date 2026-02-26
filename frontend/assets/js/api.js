// frontend/assets/js/api.js
// Merkezi API çağrı yardımcısı

const API_BASE = '/api';

const api = {
    // Token'ı al
    getToken() {
        return localStorage.getItem('auth_token');
    },

    // Header oluştur
    headers(extra = {}) {
        const h = { 'Content-Type': 'application/json', ...extra };
        const token = this.getToken();
        if (token) h['Authorization'] = `Bearer ${token}`;
        return h;
    },

    // GET
    async get(endpoint) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, { headers: this.headers() });
            if (res.status === 401) { this.handleUnauth(); return null; }
            return await res.json();
        } catch (err) {
            console.error('API GET error:', err);
            return { success: false, error: err.message };
        }
    },

    // POST
    async post(endpoint, body) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify(body)
            });
            if (res.status === 401) { this.handleUnauth(); return null; }
            return await res.json();
        } catch (err) {
            console.error('API POST error:', err);
            return { success: false, error: err.message };
        }
    },

    // PUT
    async put(endpoint, body) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'PUT',
                headers: this.headers(),
                body: JSON.stringify(body)
            });
            if (res.status === 401) { this.handleUnauth(); return null; }
            return await res.json();
        } catch (err) {
            console.error('API PUT error:', err);
            return { success: false, error: err.message };
        }
    },

    // DELETE
    async del(endpoint) {
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'DELETE',
                headers: this.headers()
            });
            if (res.status === 401) { this.handleUnauth(); return null; }
            return await res.json();
        } catch (err) {
            console.error('API DELETE error:', err);
            return { success: false, error: err.message };
        }
    },

    // 401 → login'e yönlendir
    handleUnauth() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/pages/auth/login.html';
    }
};
