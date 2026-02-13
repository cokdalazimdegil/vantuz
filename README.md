# 🐙 Vantuz OS

**Yeni Nesil E-Ticaret İşletim Sistemi**

Vantuz, sıradan bir entegrasyon aracı değil; **öğrenen, gören ve sizin adınıza düşünen** bir yapay zeka işletim sistemidir.

## 🚀 Temel Yetenekler

### 🧠 Kalıcı Hafıza & Kimlik (Brain)
Vantuz artık unutmuyor. Sizin stratejilerinizi öğrenir ve uygular.
- **Persistent Memory:** Konuşulanları, alınan kararları ve verileri diske kaydeder. Restart atsanız bile hatırlar.
- **Marka Ruhu (`BRAND.md`):** "Kar marjım %15'in altına düşmesin", "Müşteriye senli benli konuşma" gibi kurallarınızı anayasası kabul eder.

### 👁️ Vision Intelligence
Sadece metin değil, görsellerle de çalışır.
- **Ürün Analizi:** Fotoğraftan ürün özelliklerini, materyalini ve tahmini fiyatını çıkarır.
- **Hasar Kontrolü:** İade gelen ürünün fotoğrafına bakıp "Hasarlı" veya "Yeniden Satılabilir" kararı verir.
- **Depo Gözü:** Depo kameralarına bağlanıp stok sayımı yapabilir.

### 🛡️ Critical Lane (Güvenli Şerit)
Hata yapma lüksü olmayan işlemler için özel koruma.
- **Serial Queue:** Aynı anda 100 fiyat güncelleme emri gelse bile, Vantuz bunları tek tek, sakince ve hatasız işler.
- **Dry-Run:** Kritik komutlar önce simülasyon modunda çalıştırılır, onaylanırsa gerçeğe dönüşür.

### 🔌 Genişletilebilir Uydu Modülleri (Nodes)
Vantuz sadece bilgisayarınızda değil, deponuzda da yaşar.
- **Warehouse Node:** Depo terminaline kurulan ufak bir modülle barkod okuma ve kamera entegrasyonu sağlar.
- **Webhooks:** Trendyol/Hepsiburada'dan gelen "Yeni Sipariş" bildirimini anında yakalar.

---

## 📦 Kurulum

```bash
# Vantuz'u global olarak kurun
npm install -g vantuz

# Yapılandırma sihirbazını başlatın
vantuz config
```

## 🎮 Kullanım

### Terminal Arayüzü (TUI)
Vantuz ile sohbet ederek şirketinizi yönetin.

```bash
vantuz tui
```

**Örnek Komutlar:**
- "Trendyol'daki tüm kılıfların fiyatını %5 artır ama kar marjını koru."
- "Şu ürünün fotoğrafını analiz et ve Amazon Almanca açıklamasını yaz."
- "Son 1 saatte gelen iadelerin hasar durumunu raporla."

### Depo Modülü Kurulumu (Warehouse Node)

```bash
# Depo bilgisayarında:
node nodes/warehouse.js
```

---

## 🏗️ Mimari

- **Core:** Node.js + Express
- **Memory:** JSON File Persistence + Vector Search
- **AI:** OpenAI GPT-4o / Google Gemini
- **Queue:** Serial Promise Queue
- **Gateway:** WebSocket Bridge

---

## 📄 Lisans

Ticari yazılım. Kullanım için lisans anahtarı gereklidir.
Yapımcı: **Nuri Can Avşar**
İletişim: nuricanavsar2000@gmail.com
Web: https://nuricanavsar.com
