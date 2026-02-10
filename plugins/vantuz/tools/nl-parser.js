/**
 * 🧠 AKILLI KOMUT AYRISTIRICI
 * Doğal dil mesajlarını e-ticaret komutlarına çevir
 * 
 * Kullanıcı: "trendyoldaki kırmızı kılıfların fiyatını 149 yap"
 * Çıktı: { action: 'updatePrice', platform: 'trendyol', filter: 'kırmızı kılıf', price: 149 }
 */

const PRICE_PATTERNS = [
    /(?:fiyat[ıi]n[ıi]?|fiyat)\s*(?:şimdi\s+)?(\d+(?:[.,]\d+)?)\s*(?:tl|₺|lira)?(?:\s*yap)?/i,
    /(\d+(?:[.,]\d+)?)\s*(?:tl|₺|lira)?\s*(?:yap|ol(?:sun)?|ayarla)/i,
    /(?:yeni\s+fiyat|güncel\s+fiyat)[:\s]*(\d+(?:[.,]\d+)?)/i,
    /%(\d+)\s*(?:indir|düşür|azalt)/i,
    /%(\d+)\s*(?:artır|yükselt|zam)/i
];

const STOCK_PATTERNS = [
    /stok[u]?\s*(\d+)\s*(?:yap|ol(?:sun)?|ayarla)?/i,
    /(\d+)\s*adet\s*(?:stok|envanter)/i,
    /(?:stok|envanter)[:\s]*(\d+)/i
];

const PLATFORM_PATTERNS = {
    trendyol: /trendyol|ty/i,
    hepsiburada: /hepsiburada|hb/i,
    n11: /n11/i,
    amazon: /amazon|amz/i,
    ciceksepeti: /çiçek\s*sepeti|ciceksepeti|cs/i,
    pttavm: /ptt\s*avm|pttavm|ptt/i,
    pazarama: /pazarama|pzr/i
};

const ACTION_PATTERNS = {
    updatePrice: /fiyat|price|ücret|tutar/i,
    updateStock: /stok|stock|envanter|adet/i,
    getOrders: /sipariş|order|satış/i,
    getProducts: /ürün|product|liste/i,
    analyze: /analiz|rapor|report|özet/i,
    competitor: /rakip|rekabet|competitor/i
};

const TIME_PATTERNS = {
    '1d': /bugün|son\s*1\s*gün|dün/i,
    '7d': /son\s*(?:1\s*)?hafta|7\s*gün|bu\s*hafta/i,
    '30d': /son\s*(?:1\s*)?ay|30\s*gün|bu\s*ay/i,
    '90d': /son\s*3\s*ay|90\s*gün|çeyrek/i
};

export class NLParser {
    /**
     * Mesajı analiz et
     */
    parse(message) {
        const result = {
            original: message,
            action: null,
            platform: null,
            filter: null,
            value: null,
            period: null,
            confidence: 0,
            parsed: {}
        };

        // Platform bul
        for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
            if (pattern.test(message)) {
                result.platform = platform;
                break;
            }
        }

        // Action bul
        for (const [action, pattern] of Object.entries(ACTION_PATTERNS)) {
            if (pattern.test(message)) {
                result.action = action;
                break;
            }
        }

        // Fiyat değişikliği
        for (const pattern of PRICE_PATTERNS) {
            const match = message.match(pattern);
            if (match) {
                result.action = 'updatePrice';
                const value = parseFloat(match[1].replace(',', '.'));

                // Yüzde mi yoksa sabit fiyat mı?
                if (message.match(/%\d+\s*(?:indir|düşür|azalt)/i)) {
                    result.parsed.percentChange = -value;
                } else if (message.match(/%\d+\s*(?:artır|yükselt|zam)/i)) {
                    result.parsed.percentChange = value;
                } else {
                    result.parsed.price = value;
                }
                result.value = value;
                break;
            }
        }

        // Stok değişikliği
        for (const pattern of STOCK_PATTERNS) {
            const match = message.match(pattern);
            if (match) {
                result.action = 'updateStock';
                result.value = parseInt(match[1]);
                result.parsed.stock = result.value;
                break;
            }
        }

        // Zaman dilimi
        for (const [period, pattern] of Object.entries(TIME_PATTERNS)) {
            if (pattern.test(message)) {
                result.period = period;
                break;
            }
        }

        // SKU/Barkod bul
        const skuMatch = message.match(/(?:sku|barkod|kod)[:\s]*([A-Z0-9\-]+)/i);
        if (skuMatch) {
            result.parsed.sku = skuMatch[1];
        }

        // Ürün filtresi (kalan kısım)
        result.filter = this.extractFilter(message);

        // Güven skoru
        result.confidence = this.calculateConfidence(result);

        return result;
    }

    /**
     * Ürün filtresini çıkar
     */
    extractFilter(message) {
        // Platform ve action kelimelerini temizle
        let cleaned = message
            .replace(/trendyol|hepsiburada|n11|amazon|çiçeksepeti|pttavm|pazarama/gi, '')
            .replace(/fiyat[ıi]?|stok[u]?|sipariş|ürün|analiz|rakip/gi, '')
            .replace(/\d+\s*(?:tl|₺|lira)?/gi, '')
            .replace(/(?:yap|ol|ayarla|güncelle|değiştir)/gi, '')
            .replace(/(?:tüm|hepsi|bütün)/gi, '')
            .trim();

        // Anlamlı kelimeler kaldı mı?
        const words = cleaned.split(/\s+/).filter(w => w.length > 2);
        return words.length > 0 ? words.join(' ') : null;
    }

    /**
     * Güven skoru hesapla
     */
    calculateConfidence(result) {
        let score = 0;
        if (result.action) score += 30;
        if (result.platform) score += 20;
        if (result.value) score += 25;
        if (result.filter || result.parsed.sku) score += 15;
        if (result.period) score += 10;
        return Math.min(score, 100);
    }

    /**
     * Sonucu insan diline çevir
     */
    toHuman(result) {
        const parts = [];

        if (result.action === 'updatePrice' && result.parsed.price) {
            parts.push(`Fiyatı ${result.parsed.price}₺ yap`);
        } else if (result.action === 'updatePrice' && result.parsed.percentChange) {
            const dir = result.parsed.percentChange > 0 ? 'artır' : 'düşür';
            parts.push(`Fiyatı %${Math.abs(result.parsed.percentChange)} ${dir}`);
        } else if (result.action === 'updateStock') {
            parts.push(`Stoku ${result.parsed.stock} yap`);
        } else if (result.action === 'getOrders') {
            parts.push('Siparişleri getir');
        } else if (result.action === 'analyze') {
            parts.push('Analiz yap');
        }

        if (result.platform) {
            parts.push(`(${result.platform})`);
        }

        if (result.filter) {
            parts.push(`"${result.filter}" için`);
        }

        if (result.period) {
            parts.push(`son ${result.period}`);
        }

        return parts.join(' ');
    }
}

// Kısa yardımcı fonksiyonlar
export function parseCommand(message) {
    return new NLParser().parse(message);
}

export function whatDoYouMean(message) {
    const result = new NLParser().parse(message);
    return new NLParser().toHuman(result);
}

export default NLParser;
