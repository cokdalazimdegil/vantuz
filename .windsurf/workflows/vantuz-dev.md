---
description: Vantuz E-Ticaret Yönetim Sistemi Geliştirme ve Dağıtım İş Akışı
---

# 🐙 Vantuz İş Akışı (Workflow)

Bu doküman, Vantuz projesinde yeni özellik ekleme, hata giderme ve sistem optimizasyonu süreçlerini tanımlar.

## 1. Geliştirme Ortamı Hazırlığı
// turbo
1. Bağımlılıkları kontrol et: `npm install`
2. Yerel yapılandırmayı doğrula: `node onboard.js` (Eğer `.env` yoksa)
3. Geliştirici modunda başlat: `node cli.js tui`

## 2. Yeni Platform/Pazaryeri Ekleme
1. `platforms/` altında yeni bir dosya oluştur (örn: `yeni_pazar.js`)
2. `platforms/index.js` içerisinde register et.
3. `core/engine.js` içerisinde `_initPlatforms` metoduna ekle.

## 3. Tool (Araç) Geliştirme
1. `plugins/vantuz/tools/` altında yeni tool dosyasını oluştur.
2. `plugins/vantuz/index.js` içerisinde `api.registerTool` ile AI erişimine aç.

## 4. Test ve Kalite
1. Lint kontrolü: `npm run lint`
2. Testleri çalıştır: `npm test`

## 5. Dağıtım (Release)
1. `package.json` versiyonunu güncelle.
2. `CHANGELOG.md` (varsa) güncelle.
3. `git tag` ile yeni versiyonu işaretle.
