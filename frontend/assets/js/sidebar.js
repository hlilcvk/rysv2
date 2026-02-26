// frontend/assets/js/sidebar.js
// Sidebar oluşturma ve yönetimi

function renderSidebar(activePage = 'dashboard') {
    const user = getUser();
    const initials = getUserInitials();
    const isSuperAdmin = user?.is_super_admin || false;

    const navItems = [
        { section: 'ANA MENÜ' },
        { id: 'dashboard', icon: 'bi-calendar3', label: 'Takvim', href: '/pages/dashboard/index.html' },
        { id: 'experts', icon: 'bi-people', label: 'Uzmanlar', href: '/pages/experts/index.html' },
        { id: 'services', icon: 'bi-grid-3x3-gap', label: 'Hizmetler', href: '/pages/services/index.html' },
        { section: 'YÖNETİM', pro: true },
        { id: 'customers', icon: 'bi-person-lines-fill', label: 'Müşteriler', href: '/pages/customers/index.html', pro: true },
        { id: 'finance', icon: 'bi-wallet2', label: 'Finans', href: '/pages/finance/index.html' },
        { id: 'reports', icon: 'bi-bar-chart-line', label: 'Raporlar', href: '/pages/reports/index.html', pro: true },
        { section: 'AYARLAR' },
        { id: 'settings', icon: 'bi-gear', label: 'Ayarlar', href: '/pages/settings/index.html' },
    ];

    // Süper admin menüsü
    if (isSuperAdmin) {
        navItems.push(
            { section: 'PLATFORM' },
            { id: 'admin', icon: 'bi-shield-lock', label: 'Süper Admin', href: '/pages/admin/index.html' }
        );
    }

    let html = `
        <div class="sidebar" id="sidebar">
            <div class="sidebar-logo">
                <h2>🗓 RandevuCRM</h2>
                <span>v2.0</span>
            </div>
            <nav class="sidebar-nav">`;

    navItems.forEach(item => {
        if (item.section) {
            html += `<div class="nav-section-title">${item.section}</div>`;
        } else {
            const active = item.id === activePage ? ' active' : '';
            const badge = item.pro ? '<span class="nav-badge">PRO</span>' : '';
            html += `<a class="nav-item${active}" href="${item.href}" data-page="${item.id}">
                <i class="bi ${item.icon}"></i> ${item.label} ${badge}
            </a>`;
        }
    });

    html += `</nav>
            <div class="sidebar-footer">
                <div class="sidebar-user" onclick="logout()">
                    <div class="sidebar-avatar">${initials}</div>
                    <div class="sidebar-user-info">
                        <div class="name">${user?.ad_soyad || 'Kullanıcı'}</div>
                        <div class="role">${isSuperAdmin ? 'Süper Admin' : 'İşletme Sahibi'}</div>
                    </div>
                    <i class="bi bi-box-arrow-right" style="margin-left:auto;color:var(--text-muted);font-size:14px"></i>
                </div>
            </div>
        </div>`;

    // Mobile toggle
    html += `<button class="sidebar-toggle" onclick="document.getElementById('sidebar').classList.toggle('open')">
        <i class="bi bi-list"></i>
    </button>`;

    document.body.insertAdjacentHTML('afterbegin', html);
}
