-- backend/migrations/001_initial_schema.sql
-- Ortak tablolar — tüm işletmeler paylaşır
-- Bu migration sadece 1 kez çalıştırılır

-- ══════════════════════════════════════
-- ADMIN USERS (güncelleme: email, reset token, son_giris)
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    isletme_id VARCHAR(50) UNIQUE,
    kullanici_adi VARCHAR(100) UNIQUE NOT NULL,
    ad_soyad VARCHAR(200) NOT NULL,
    sifre VARCHAR(255) NOT NULL,
    email VARCHAR(200),
    telefon VARCHAR(20),
    bagli_tablo_adi VARCHAR(100),
    is_super_admin BOOLEAN DEFAULT false,
    reset_token VARCHAR(100),
    reset_token_expiry TIMESTAMP,
    son_giris TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════
-- ÇALIŞMA ODALARI / UZMANLAR (güncelleme: renk, uzmanlık, saat)
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS calisma_odalari (
    id SERIAL PRIMARY KEY,
    isletme_id VARCHAR(50) NOT NULL,
    oda_adi VARCHAR(100) NOT NULL,
    uzmanlik VARCHAR(200),
    renk VARCHAR(20) DEFAULT '#6366F1',
    telefon VARCHAR(20),
    email VARCHAR(200),
    calisma_baslangic TIME DEFAULT '09:00',
    calisma_bitis TIME DEFAULT '20:00',
    calisma_gunleri INTEGER[] DEFAULT '{1,2,3,4,5,6}',
    sira INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calisma_odalari_isletme ON calisma_odalari(isletme_id);

-- ══════════════════════════════════════
-- PAKETLER
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS paketler (
    id SERIAL PRIMARY KEY,
    paket_kodu VARCHAR(50) UNIQUE NOT NULL,
    gorunen_adi VARCHAR(200) NOT NULL,
    aylik_fiyat DECIMAL(10,2) NOT NULL,
    yillik_fiyat DECIMAL(10,2),
    aylik_fiyat_usd DECIMAL(10,2),
    yillik_fiyat_usd DECIMAL(10,2),
    max_uzman INTEGER,
    max_musteri INTEGER,
    max_aylik_mesaj INTEGER NOT NULL DEFAULT 1500,
    max_randevu_aylik INTEGER,
    ozellikler JSONB NOT NULL DEFAULT '{}',
    sira INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Varsayılan 2 paket
INSERT INTO paketler (paket_kodu, gorunen_adi, aylik_fiyat, yillik_fiyat, aylik_fiyat_usd, yillik_fiyat_usd, max_uzman, max_musteri, max_aylik_mesaj, ozellikler, sira) VALUES
('baslangic', 'Başlangıç', 499, 4990, 29, 290, 5, 1000, 1500,
 '{"crm":false,"hatirlatma":false,"anket":false,"raporlama":false,"finans_gelismis":false,"fatura_entegrasyon":false,"online_odeme":false,"api_erisim":false,"oncelikli_destek":false,"meta_api":false}', 1),
('profesyonel', 'Profesyonel', 999, 9990, 59, 590, NULL, NULL, 5000,
 '{"crm":true,"hatirlatma":true,"anket":true,"raporlama":true,"finans_gelismis":true,"fatura_entegrasyon":true,"online_odeme":true,"api_erisim":true,"oncelikli_destek":true,"meta_api":true}', 2)
ON CONFLICT (paket_kodu) DO NOTHING;

-- ══════════════════════════════════════
-- EKLENTİLER
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS eklentiler (
    id SERIAL PRIMARY KEY,
    eklenti_kodu VARCHAR(50) UNIQUE NOT NULL,
    gorunen_adi VARCHAR(200) NOT NULL,
    aciklama TEXT,
    eklenen_tur VARCHAR(20) NOT NULL,
    eklenen_miktar INTEGER NOT NULL,
    aylik_fiyat_try DECIMAL(10,2) NOT NULL,
    aylik_fiyat_usd DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sira INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO eklentiler (eklenti_kodu, gorunen_adi, aciklama, eklenen_tur, eklenen_miktar, aylik_fiyat_try, aylik_fiyat_usd, sira) VALUES
('uzman_2', '+2 Uzman', 'Ekibinize 2 uzman daha ekleyin', 'uzman', 2, 50, 5, 1),
('mesaj_500', '+500 Mesaj', 'Aylık 500 ekstra WhatsApp mesajı', 'mesaj', 500, 100, 10, 2),
('musteri_500', '+500 Müşteri', 'Müşteri kapasitesinizi 500 artırın', 'musteri', 500, 100, 10, 3)
ON CONFLICT (eklenti_kodu) DO NOTHING;

-- ══════════════════════════════════════
-- ABONELİKLER
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS abonelikler (
    id SERIAL PRIMARY KEY,
    isletme_id VARCHAR(50) NOT NULL,
    paket_id INTEGER REFERENCES paketler(id),
    durum VARCHAR(20) DEFAULT 'deneme',
    periyot VARCHAR(10) DEFAULT 'aylik',
    para_birimi VARCHAR(10) DEFAULT 'TRY',
    baslangic_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
    bitis_tarihi DATE,
    deneme_bitis DATE,
    iptal_tarihi DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_abonelikler_isletme ON abonelikler(isletme_id);

-- ══════════════════════════════════════
-- İŞLETME EKLENTİLERİ
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS isletme_eklentileri (
    id SERIAL PRIMARY KEY,
    isletme_id VARCHAR(50) NOT NULL,
    eklenti_id INTEGER REFERENCES eklentiler(id),
    adet INTEGER NOT NULL DEFAULT 1,
    durum VARCHAR(20) DEFAULT 'aktif',
    baslangic_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
    para_birimi VARCHAR(10) DEFAULT 'TRY',
    aylik_tutar DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════
-- KULLANIM SAYAÇLARI
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS kullanim_sayaclari (
    id SERIAL PRIMARY KEY,
    isletme_id VARCHAR(50) NOT NULL,
    donem VARCHAR(7) NOT NULL,
    mesaj_sayisi INTEGER DEFAULT 0,
    musteri_sayisi INTEGER DEFAULT 0,
    uzman_sayisi INTEGER DEFAULT 0,
    randevu_sayisi INTEGER DEFAULT 0,
    mesaj_uyari_80 BOOLEAN DEFAULT false,
    mesaj_uyari_100 BOOLEAN DEFAULT false,
    musteri_uyari_80 BOOLEAN DEFAULT false,
    musteri_uyari_100 BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(isletme_id, donem)
);

-- ══════════════════════════════════════
-- FATURA ENTEGRASYONLARi
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS fatura_entegrasyonlari (
    id SERIAL PRIMARY KEY,
    isletme_id VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMP,
    provider_config JSONB DEFAULT '{}',
    otomatik_fatura BOOLEAN DEFAULT false,
    fatura_turu VARCHAR(20) DEFAULT 'e_arsiv',
    kdv_orani DECIMAL(5,2) DEFAULT 20,
    durum VARCHAR(20) DEFAULT 'aktif',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════
-- PLATFORM ÖDEMELERİ
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS platform_odemeler (
    id SERIAL PRIMARY KEY,
    isletme_id VARCHAR(50) NOT NULL,
    tutar DECIMAL(10,2) NOT NULL,
    para_birimi VARCHAR(10) DEFAULT 'TRY',
    odeme_turu VARCHAR(50),
    aciklama TEXT,
    provider VARCHAR(50),
    provider_odeme_id VARCHAR(200),
    durum VARCHAR(20) DEFAULT 'tamamlandi',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════
-- KUPONLAR
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS kuponlar (
    id SERIAL PRIMARY KEY,
    kupon_kodu VARCHAR(50) UNIQUE NOT NULL,
    aciklama TEXT,
    indirim_tipi VARCHAR(20) DEFAULT 'yuzde',
    indirim_degeri DECIMAL(10,2) NOT NULL,
    gecerli_paket VARCHAR(50),
    max_kullanim INTEGER,
    kullanim_sayisi INTEGER DEFAULT 0,
    baslangic_tarihi DATE,
    bitis_tarihi DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════
-- HEDİYELER
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS hediyeler (
    id SERIAL PRIMARY KEY,
    isletme_id VARCHAR(50) NOT NULL,
    hediye_turu VARCHAR(50) NOT NULL,
    hediye_detay JSONB,
    sure_gun INTEGER,
    baslangic_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
    bitis_tarihi DATE,
    veren_admin VARCHAR(100),
    neden TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════
-- DB AYARLARI (Süper admin)
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS db_ayarlari (
    id SERIAL PRIMARY KEY,
    ayar_adi VARCHAR(100) UNIQUE NOT NULL,
    ayar_degeri TEXT NOT NULL,
    sifrelenmis BOOLEAN DEFAULT false,
    aciklama TEXT,
    son_degistiren VARCHAR(100),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════
-- MİGRATİON LOG
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS migration_log (
    id SERIAL PRIMARY KEY,
    migration_adi VARCHAR(200) NOT NULL,
    migration_tipi VARCHAR(50) NOT NULL,
    hedef VARCHAR(100),
    durum VARCHAR(20) DEFAULT 'basarili',
    sql_icerik TEXT,
    hata_mesaji TEXT,
    calistiran VARCHAR(100),
    sure_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════
-- YEDEKLEME LOG
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS yedekleme_log (
    id SERIAL PRIMARY KEY,
    yedek_tipi VARCHAR(20) NOT NULL,
    hedef VARCHAR(200),
    dosya_yolu TEXT,
    dosya_boyut BIGINT,
    durum VARCHAR(20) DEFAULT 'basarili',
    hata_mesaji TEXT,
    tetikleyen VARCHAR(100),
    sure_saniye INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════
-- SİSTEM AYARLARI
-- ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS sistem_ayarlari (
    id SERIAL PRIMARY KEY,
    ayar_adi VARCHAR(100) UNIQUE NOT NULL,
    ayar_degeri TEXT,
    aciklama TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sistem_ayarlari (ayar_adi, ayar_degeri, aciklama) VALUES
('platform_adi', 'RandevuCRM', 'Platform görünen adı'),
('deneme_suresi_gun', '14', 'Yeni işletme deneme süresi'),
('varsayilan_dil', 'tr', 'Varsayılan dil'),
('bakim_modu', 'false', 'Bakım modu aktif mi')
ON CONFLICT (ayar_adi) DO NOTHING;
