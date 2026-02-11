# 🐙 Vantuz AI - Türkçe Teknik Dokümantasyon

## İçindekiler

1. [Mimari Genel Bakış](#mimari)
2. [Plugin Yapısı](#plugin-yapısı)
3. [Tools (Araçlar)](#tools)
4. [Commands (Komutlar)](#commands)
5. [Services (Servisler)](#services)
6. [Hippocampus Hafıza](#hippocampus)
7. [Yapılandırma](#yapılandırma)
8. [API Referansı](#api-referansı)

---

## Mimari

Vantuz, **Gateway altyapısı** üzerine inşa edilmiş bir plugin sistemidir.

```
┌─────────────────────────────────────────────────────────────┐
│                    Gateway                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ WhatsApp │  │ Telegram │  │ Discord  │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │             │             │                         │
│       └─────────────┼─────────────┘                         │
│                     ▼                                       │
│              ┌─────────────┐                               │
│              │ Vantuz Core │                               │
│              │   Plugin    │                               │
│              └─────┬───────┘                               │
│                    │                                        │
│    ┌───────┬───────┼───────┬───────┐                       │
│    ▼       ▼       ▼       ▼       ▼                       │
│ ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐                  │
│ │Repri-││Vision││Senti-││Cross-││Analy-│                  │
│ │cer   ││  AI  ││ment  ││Border││tics  │                  │
│ └──────┘└──────┘└──────┘└──────┘└──────┘                  │
│                    │                                        │
│              ┌─────▼───────┐                               │
│              │ Hippocampus │                               │
│              │   Memory    │                               │
│              └─────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Plugin Yapısı

```
plugins/vantuz/
├── index.js           # Ana plugin entry point
├── package.json       # Plugin manifest
├── tools/
│   ├── repricer.js    # Kan Emici fiyat robotu
│   ├── vision.js      # Fotoğraf → ürün
│   ├── sentiment.js   # Yorum analizi
│   ├── crossborder.js # Sınır ötesi satış
│   ├── product.js     # Ürün CRUD
│   └── analytics.js   # Raporlama
├── services/
│   └── license.js     # Lisans doğrulama
├── memory/
│   └── hippocampus.js # Hafıza sistemi
└── platforms/
    └── index.js       # Pazaryeri API stubs
```

---

## Tools

### vantuz.repricer

Rakip fiyatlarını analiz eder ve karar verir.

**Parametreler:**
| Param | Tip | Zorunlu | Açıklama |
|-------|-----|---------|----------|
| barcode | string | ✅ | Ürün barkodu/SKU |
| platform | string | - | trendyol, hepsiburada, amazon, n11, all |
| targetMargin | number | - | Hedef kar marjı % |
| action | string | - | analyze, apply, schedule |

**Örnek:**
```json
{
  "name": "vantuz.repricer",
  "parameters": {
    "barcode": "SKU-12345",
    "platform": "trendyol",
    "targetMargin": 25,
    "action": "analyze"
  }
}
```

---

### vantuz.vision

Fotoğraftan ürün bilgisi çıkarır.

**Parametreler:**
| Param | Tip | Zorunlu | Açıklama |
|-------|-----|---------|----------|
| imageUrl | string | ✅ | Görsel URL veya base64 |
| targetPlatforms | array | - | Hedef pazaryerleri |
| autoPublish | boolean | - | Otomatik yayınla |

---

### vantuz.sentiment

Müşteri yorumlarını analiz eder.

**Parametreler:**
| Param | Tip | Zorunlu | Açıklama |
|-------|-----|---------|----------|
| productId | string | ✅ | Ürün ID/barkod |
| platform | string | - | Pazaryeri |
| period | string | - | 7d, 30d, 90d, all |

---

### vantuz.crossborder

Uluslararası satış hazırlığı yapar.

**Parametreler:**
| Param | Tip | Zorunlu | Açıklama |
|-------|-----|---------|----------|
| productId | string | ✅ | Kaynak ürün ID |
| targetMarket | string | ✅ | de, us, uk, fr |
| fulfillment | string | - | fba, fbm, self |

---

## Commands

Kullanıcılar WhatsApp/Telegram'dan doğrudan kullanabilir:

| Komut | Açıklama | Örnek |
|-------|----------|-------|
| `/stok` | Stok özeti | `/stok trendyol` |
| `/fiyat` | Fiyat güncelle | `/fiyat SKU123 199` |
| `/rapor` | Satış raporu | `/rapor 7d` |
| `/rakip` | Rakip analizi | `/rakip SKU123` |
| `/lisans` | Lisans durumu | `/lisans` |

---

## Services

### vantuz-license
Başlatmada lisans doğrulaması yapar. Her 24 saatte bir kontrol tekrarlanır.

### vantuz-memory
Hippocampus hafıza sistemini başlatır ve yönetir.

### vantuz-repricer-daemon
Her 15 dakikada bir otomatik fiyat kontrolü yapar.

---

## Hippocampus

SQLite tabanlı gelişmiş hafıza sistemi.

### Tablolar

**Memory** - Genel hafıza
- type: decision, price_change, product, conversation, insight
- content: Hafıza içeriği
- importance: 0-1 önem skoru
- accessCount: Erişim sayısı

**PricingDecision** - Fiyat kararları
- barcode, previousPrice, newPrice, reason, outcome

**ProductContext** - Ürün bağlamı
- avgSalePrice, competitorHistory, customerSentiment

**LearnedRule** - Öğrenilen kurallar
- trigger, condition, action, confidence

### Özellikler

- **Konsolidasyon**: Her gece 03:00'te eski/önemsiz hafızalar temizlenir
- **Öğrenme**: Başarılı kararlar otomatik kural olur
- **Bağlamsal Hatırlama**: İlgili hafızalar sorgulanabilir

---

## Yapılandırma

### Gateway yapılandırma dosyası

```json
{
  "agents": {
    "defaults": {
      "workspace": "./workspace"
    }
  },
  "channels": {
    "whatsapp": { "enabled": true },
    "telegram": { 
      "enabled": true,
      "botToken": "${TELEGRAM_BOT_TOKEN}"
    }
  },
  "models": {
    "openai": {
      "apiKey": "${OPENAI_API_KEY}"
    }
  },
  "plugins": {
    "load": {
      "paths": ["./plugins/vantuz"]
    }
  }
}
```

### .env

```env
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=123456:ABC...
VANTUZ_LICENSE_KEY=...
```

---

## API Referansı

### Gateway RPC

**vantuz.status**
```json
{
  "version": "2.0.0",
  "license": { "valid": true, "customer": "..." },
  "memory": { "memories": 150, "decisions": 45 },
  "platforms": { "trendyol": true, "hepsiburada": true }
}
```

**vantuz.config**
```json
// GET
{ "action": "get" }

// SET
{ "action": "set", "data": { "repricerInterval": 30 } }
```

---

## Geliştirme

### Yeni Tool Ekleme

```javascript
// plugins/vantuz/tools/myTool.js
export const myTool = {
  name: 'my-tool',
  async execute(params, context) {
    const { api, memory, license } = context;
    // ...
    return { success: true, data: {} };
  }
};

// index.js'de register et
api.registerTool({
  name: 'vantuz.mytool',
  description: '...',
  parameters: { ... },
  handler: (params) => myTool.execute(params, context)
});
```

### Yeni Command Ekleme

```javascript
api.registerCommand({
  name: 'mycommand',
  description: 'Açıklama',
  acceptsArgs: true,
  handler: async (ctx) => {
    return { text: 'Yanıt' };
  }
});
```
