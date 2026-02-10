// core/eia-brain.js
import { chat as aiChat, log } from './ai-provider.js';

class EIABrain {
    constructor(config, env) {
        this.config = config;
        this.env = env;
        this.systemPrompt = this._buildSystemPrompt();
    }

    _buildSystemPrompt() {
        return `Sen bir E-Ticaret Yönetim Ajansı'nın (EIA) beynisin. Görevin, e-ticaret operasyonlarını 7/24 izlemek, analiz etmek ve **şirketin karlılığını ve büyümesini maksimize edecek proaktif aksiyon önerileri** sunmaktır. Veriye dayalı kararlar alan, sonuç odaklı ve iş stratejilerine hakim bir yönetici kişiliğine sahipsin.

Aşağıdaki bilgilerle karar ver:
- Güncel durum verileri (stok, fiyat, buybox durumu, yorumlar vb.)
- Şirket kuralları ve hedefleri (bellekten alınacak)
- Geçmiş stratejik kararlar (bellekten alınacak)

Yanıtların kısa, öz, **iş değerine odaklı** ve eyleme yönelik olmalı. Gerekirse ek bilgi veya onay istemelisin.`;
    }

    async analyzeAndDecide(context) {
        const fullPrompt = `${this.systemPrompt}

--- GÜNCEL DURUM ---
${context.currentSituation}

--- ŞİRKET KURALLARI VE HEDEFLERİ ---
${context.companyRules}

--- GEÇMİŞ KARARLAR ---
${context.pastDecisions}

Durumu analiz et ve en uygun aksiyon önerisini veya içgörüyü sun.`;

        try {
            const response = await aiChat(fullPrompt, this.config, this.env);
            log('INFO', 'EIA Brain analysis complete', { response: response.slice(0, 100) });
            return response;
        } catch (error) {
            log('ERROR', 'EIA Brain analysis failed', { error: error.message });
            return `Analiz sırasında bir hata oluştu: ${error.message}`;
        }
    }

    /**
     * Scraper'lardan gelen ham veriyi işleyip ticari içgörülere dönüştürür.
     * Bu metod, veri modelleme ve iş mantığı kurallarını içerecektir.
     */
    async processRawData(rawData, dataType) {
        log('INFO', `Processing raw data for type: ${dataType}`, { rawData: JSON.stringify(rawData).slice(0, 200) });

        let insights = {};
        switch (dataType) {
            case 'price_changes':
                insights = {
                    type: 'price_change_insight',
                    summary: `Fiyat değişikliği verisi işlendi. ${rawData.length} adet kayıt mevcut.`,
                    details: rawData.map(item => `Ürün: ${item.productName}, Eski Fiyat: ${item.oldPrice}, Yeni Fiyat: ${item.newPrice}, Platform: ${item.platform}`)
                };
                break;
            case 'buybox_status':
                insights = {
                    type: 'buybox_insight',
                    summary: `Buybox durumu verisi işlendi.`,
                    details: rawData.map(item => `Ürün: ${item.productName}, Durum: ${item.status}, Platform: ${item.platform}`)
                };
                break;
            case 'stock_movements':
                insights = {
                    type: 'stock_insight',
                    summary: `Stok hareketi verisi işlendi.`,
                    details: rawData.map(item => `Ürün: ${item.productName}, Miktar: ${item.quantityChange}, Platform: ${item.platform}`)
                };
                break;
            case 'product_reviews':
                insights = {
                    type: 'review_insight',
                    summary: `Ürün yorumları verisi işlendi.`,
                    details: rawData.map(item => `Ürün: ${item.productName}, Yorum: ${item.reviewText.slice(0, 50)}, Puan: ${item.rating}`)
                };
                break;
            default:
                insights = {
                    type: 'general_insight',
                    summary: 'Bilinen bir veri tipi değil, ham veri olarak işlendi.',
                    rawData: rawData
                };
                break;
        }
        return insights;
    }
}

let eiaBrainInstance = null;

export function getEIABrain(config, env) {
    if (!eiaBrainInstance) {
        eiaBrainInstance = new EIABrain(config, env);
    }
    return eiaBrainInstance;
}
