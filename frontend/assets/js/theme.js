// frontend/assets/js/theme.js
// Tema yönetimi

function initTheme() {
    const saved = localStorage.getItem('theme') || 'midnight';
    setTheme(saved);
}

function setTheme(name) {
    document.documentElement.setAttribute('data-theme', name);
    localStorage.setItem('theme', name);

    // Dot aktifliğini güncelle
    document.querySelectorAll('.theme-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.theme === name);
    });
}

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    // Theme dot tıklama
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', () => setTheme(dot.dataset.theme));
    });
});
