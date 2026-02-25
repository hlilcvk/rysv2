// backend/config/constants.js
// Sabit değerler — tek yerden yönetim

module.exports = {

    // Randevu durumları
    APPOINTMENT_STATUS: {
        PENDING: 'bekliyor',
        CONFIRMED: 'onaylandi',
        COMPLETED: 'tamamlandi',
        CANCELLED: 'iptal',
        NO_SHOW: 'gelmedi'
    },

    // Ödeme durumları
    PAYMENT_STATUS: {
        UNPAID: 'odenmedi',
        PAID: 'odendi',
        PARTIAL: 'kismi',
        REFUNDED: 'iade'
    },

    // Ödeme yöntemleri
    PAYMENT_METHODS: {
        CASH: 'nakit',
        CARD: 'kart',
        EFT: 'eft',
        ONLINE: 'online'
    },

    // Kaynak (randevu nereden geldi)
    SOURCES: {
        WHATSAPP: 'whatsapp',
        MANUAL: 'manuel',
        ONLINE: 'online',
        PHONE: 'telefon'
    },

    // Abonelik durumları
    SUBSCRIPTION_STATUS: {
        TRIAL: 'deneme',
        ACTIVE: 'aktif',
        EXPIRED: 'suresi_doldu',
        CANCELLED: 'iptal',
        GIFT: 'hediye'
    },

    // Paket kodları
    PACKAGES: {
        STARTER: 'baslangic',
        PRO: 'profesyonel'
    },

    // Özellik kilitleri (her özelliğin hangi pakette açık olduğu)
    FEATURES: {
        crm: { starter: false, pro: true },
        hatirlatma: { starter: false, pro: true },
        anket: { starter: false, pro: true },
        raporlama: { starter: false, pro: true },
        finans_gelismis: { starter: false, pro: true },
        fatura_entegrasyon: { starter: false, pro: true },
        online_odeme: { starter: false, pro: true },
        api_erisim: { starter: false, pro: true },
        oncelikli_destek: { starter: false, pro: true },
        meta_api: { starter: false, pro: true }
    },

    // Limit eşikleri
    LIMITS: {
        WARNING_PERCENT: 80,
        LIMIT_PERCENT: 100
    },

    // İşletmeye özel tablo listesi
    TENANT_TABLES: [
        'randevular',
        'musteriler',
        'hizmetler',
        'odemeler',
        'faturalar',
        'bildirimler',
        'anketler',
        'mesajlar',
        'ayarlar'
    ],

    // Varsayılan işletme ayarları
    DEFAULT_SETTINGS: {
        calisma_baslangic: '09:00',
        calisma_bitis: '20:00',
        randevu_araligi_dk: '30',
        otomatik_hatirlatma: 'true',
        hatirlatma_saat_once: '2',
        anket_aktif: 'true',
        anket_saat_sonra: '2',
        konum_gonder: 'true',
        dil: 'tr',
        tema: 'midnight',
        para_birimi: 'TRY',
        kdv_orani: '20',
        logo_url: '',
        isletme_adresi: '',
        isletme_telefon: '',
        google_maps_link: ''
    },

    // Rate limit ayarları
    RATE_LIMITS: {
        AUTH: { windowMs: 15 * 60 * 1000, max: 10 },      // 15dk'da 10 giriş
        API: { windowMs: 1 * 60 * 1000, max: 100 },        // 1dk'da 100 istek
        DB_ADMIN: { windowMs: 1 * 60 * 1000, max: 10 }     // 1dk'da 10 DB işlem
    }
};
