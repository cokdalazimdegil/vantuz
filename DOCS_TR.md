# 🐙 VANTUZ (Enterprise Edition)

**Yapay Zeka Destekli E-Ticaret Orkestrasyon Platformu**

Vantuz, işletmelerin tüm e-ticaret operasyonlarını (Trendyol, Hepsiburada, Amazon vb.) tek bir merkezden yönetmesini sağlayan, yapay zeka ile güçlendirilmiş profesyonel bir masaüstü yazılımıdır.

## 🚀 Özellikler

*   **Merkezi Yönetim:** Sınırsız sayıda mağaza ve pazaryeri hesabı.
*   **AI Vision (Görsel Zeka):** Ürün fotoğraflarını tanır; başlık, açıklama ve fiyatı otomatik oluşturur.
*   **Akıllı Stok:** Stoklar tüm platformlarda anlık senkronize edilir.
*   **Güvenli Lisanslama:** Yalnızca yetkili lisans anahtarıyla çalışır.

## 📦 Kurulum ve Çalıştırma

### Son Kullanıcı İçin (Windows/Mac/Linux)

1.  Size iletilen `vantuz` (veya `vantuz.exe`) dosyasını indirin.
2.  Çift tıklayarak veya terminalden çalıştırın.
3.  Karşılama ekranında **Lisans Anahtarınızı** girin.
4.  Kurulum sihirbazını takip ederek mağazalarınızı bağlayın.

### Geliştirici Kurulumu

```bash
git clone https://github.com/vantuz-ai/core.git
cd vantuz
npm install
npm link
vantuz
```

## 🔑 Lisanslama

Vantuz, ticari bir yazılımdır ve aktivasyon gerektirir.
Lisans anahtarı edinmek için satış temsilcinizle iletişime geçin.

**Lisans Türleri:**
*   **Starter:** Tek Mağaza, Temel Özellikler
*   **Pro:** 5 Mağaza, AI Vision
*   **Enterprise:** Sınırsız Mağaza, Özel Entegrasyonlar

## 🤖 Yapay Zeka Takımı (Multi-Agent Team)

Vantuz, arkaplanda çalışan ve birbirleriyle iletişim kurabilen özelleşmiş yapay zeka ajanlarından oluşan bir takıma sahiptir.

### Takım Üyeleri
1.  **Milo (@milo)**: Strateji Lideri. Takımı yönetir, hedefleri belirler.
2.  **Josh (@josh)**: İş Analisti. Kar marjlarını, ciroyu ve rakipleri takip eder.
3.  **Pazarlama (@marketing)**: Yaratıcı Ajan. Sosyal medya içerikleri ve SEO fikirleri üretir.
4.  **Yazılım (@dev)**: Teknik Uzman. Sistem sağlığını ve hataları kontrol eder.

### Nasıl Kullanılır?
Terminal üzerinden `/team` komutuyla takıma erişebilirsiniz:

```bash
# Milo ile strateji konuşmak için:
vantuz team chat milo "Bu hafta ciroyu artırmak için ne yapalım?"

# Tüm takıma duyuru yapmak için:
vantuz team broadcast "Arkadaşlar, yeni iPhone kılıfları geldi!"

# Takım durumunu görmek için:
vantuz team status
```

Bu ajanlar `workspace/team/` klasöründeki dosyalar üzerinden birbirleriyle haberleşir ve projeyi yönetir.

## 🛠️ Desteklenen Platformlar

| Platform | Durum | Özellikler |
|----------|-------|------------|
| **Trendyol** | ✅ Aktif | Sipariş, Stok, Ürün Yükleme, Vision AI |
| **Hepsiburada**| ✅ Aktif | Sipariş, Stok, Fiyat Yönetimi |
| **Amazon** | ✅ Aktif | SP-API, Global Satış (Cross-Border) |
| **N11** | ✅ Aktif | Sipariş, Ürün, Stok Takibi |

---
**Geliştirici:** Nuri Can Avşar
**Versiyon:** 2.2 Enterprise
