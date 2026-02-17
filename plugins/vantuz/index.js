/**
 * 🐙 VANTUZ AI v3.1
 * E-Ticaretin Yapay Zeka Beyni
 * 
 * Bu plugin şunları sağlar:
 * - 7 Pazaryeri API Entegrasyonu (Trendyol, HB, N11, Amazon, CS, PTT, Pazarama)
 * - E-ticaret araçları (repricer, vision, sentiment, crossborder)
 * - Özel komutlar (/stok, /fiyat, /rapor, /uyari)
 * - Cron zamanlama ve otomasyon
 * - Hippocampus hafıza sistemi
 */

import { Hippocampus } from './memory/hippocampus.js';
import { LicenseManager } from './services/license.js';
import SchedulerService from './services/scheduler.js';
import AlertService from './services/alerts.js';

// Tools
import { repricerTool } from './tools/repricer.js';
import { visionTool } from './tools/vision.js';
import { sentimentTool } from './tools/sentiment.js';
import { crossborderTool } from './tools/crossborder.js';
import { productTool } from './tools/product.js';
import { analyticsTool } from './tools/analytics.js';
import { quickReportTool } from './tools/quick-report.js';
import NLParser from './tools/nl-parser.js';

// Platform APIs
import platformHub, {
    trendyolApi,
    hepsiburadaApi,
    n11Api,
    amazonApi,
    ciceksepetiApi,
    pttavmApi,
    pazaramaApi
} from './platforms/index.js';


const PLUGIN_ID = 'vantuz';
const PLUGIN_VERSION = '3.0.0';

export default function (api) {
    const logger = api.logger;
    const config = api.config;

    // Hippocampus hafıza sistemi
    const memory = new Hippocampus(api);

    // Lisans yöneticisi
    const license = new LicenseManager(api);

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔧 TOOLS - AI tarafından çağrılabilir araçlar
    // ═══════════════════════════════════════════════════════════════════════════

    // 🩸 Kan Emici Repricer
    api.registerTool({
        name: 'vantuz.repricer',
        description: `Rakip fiyatlarını analiz et ve optimal fiyat öner.
    Akıllı kararlar verir:
    - Rakip stoku azsa → Fiyatı yükselt
    - Rakip fiyat düşürdüyse → Kar marjına göre takip et
    - Satış hızı yüksekse → Fiyatı optimize et`,
        parameters: {
            type: 'object',
            properties: {
                barcode: {
                    type: 'string',
                    description: 'Ürün barkodu veya SKU'
                },
                platform: {
                    type: 'string',
                    enum: ['trendyol', 'hepsiburada', 'amazon', 'n11', 'all'],
                    description: 'Hedef pazaryeri'
                },
                targetMargin: {
                    type: 'number',
                    description: 'Hedef kar marjı yüzdesi (örn: 20)'
                },
                action: {
                    type: 'string',
                    enum: ['analyze', 'apply', 'schedule'],
                    description: 'Sadece analiz, uygula veya zamanla'
                }
            },
            required: ['barcode']
        },
        handler: async (params) => repricerTool.execute(params, { api, memory, license })
    });

    // 👁️ Vision AI
    api.registerTool({
        name: 'vantuz.vision',
        description: `Fotoğraftan ürün bilgisi çıkar ve pazaryerlerine ekle.
    - SEO uyumlu başlık oluşturur
    - Detaylı açıklama yazar
    - Kategori eşleştirir (5 pazaryeri için)
    - Tahmini fiyat önerir`,
        parameters: {
            type: 'object',
            properties: {
                imageUrl: {
                    type: 'string',
                    description: 'Ürün fotoğrafı URL veya base64'
                },
                targetPlatforms: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Hedef pazaryerleri: trendyol, hepsiburada, amazon_de, amazon_us, n11'
                },
                autoPublish: {
                    type: 'boolean',
                    description: 'Otomatik yayınla (true) veya önizleme (false)'
                }
            },
            required: ['imageUrl']
        },
        handler: async (params) => visionTool.execute(params, { api, memory, license })
    });

    // 🧠 Sentiment AI
    api.registerTool({
        name: 'vantuz.sentiment',
        description: `Müşteri yorumlarını analiz et ve aksiyon öner.
    - Pozitif/negatif oranları
    - Ana şikayet konuları tespit
    - Tedarikçi kalite sorunları
    - Otomatik yanıt önerileri`,
        parameters: {
            type: 'object',
            properties: {
                productId: {
                    type: 'string',
                    description: 'Ürün ID veya barkod'
                },
                platform: {
                    type: 'string',
                    enum: ['trendyol', 'hepsiburada', 'amazon', 'n11', 'all'],
                    description: 'Pazaryeri'
                },
                period: {
                    type: 'string',
                    enum: ['7d', '30d', '90d', 'all'],
                    description: 'Analiz dönemi'
                }
            },
            required: ['productId']
        },
        handler: async (params) => sentimentTool.execute(params, { api, memory, license })
    });

    // 🌍 Cross-Border
    api.registerTool({
        name: 'vantuz.crossborder',
        description: `Ürünü yurt dışı pazarına uyarla ve sat.
    - Dil çevirisi (Almanca, İngilizce)
    - Döviz hesaplama
    - Kargo + FBA komisyon hesabı
    - Optimal satış fiyatı`,
        parameters: {
            type: 'object',
            properties: {
                productId: {
                    type: 'string',
                    description: 'Kaynak ürün ID veya barkod'
                },
                sourcePlatform: {
                    type: 'string',
                    enum: ['trendyol', 'hepsiburada', 'n11'],
                    description: 'Kaynak pazaryeri'
                },
                targetMarket: {
                    type: 'string',
                    enum: ['de', 'us', 'uk', 'fr'],
                    description: 'Hedef pazar'
                },
                fulfillment: {
                    type: 'string',
                    enum: ['fba', 'fbm', 'self'],
                    description: 'Fulfillment yöntemi'
                }
            },
            required: ['productId', 'targetMarket']
        },
        handler: async (params) => crossborderTool.execute(params, { api, memory, license })
    });

    // 📦 Ürün Yönetimi
    api.registerTool({
        name: 'vantuz.product',
        description: `Ürün işlemleri: liste, güncelle, stok, fiyat.`,
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['list', 'get', 'update', 'updatePrice', 'updateStock', 'publish', 'unpublish'],
                    description: 'Yapılacak işlem'
                },
                productId: { type: 'string' },
                platform: { type: 'string' },
                data: { type: 'object', description: 'Güncelleme verisi' }
            },
            required: ['action']
        },
        handler: async (params) => productTool.execute(params, { api, memory, license })
    });

    // 📊 Analitik
    api.registerTool({
        name: 'vantuz.analytics',
        description: `Satış, stok ve performans raporları.`,
        parameters: {
            type: 'object',
            properties: {
                reportType: {
                    type: 'string',
                    enum: ['sales', 'stock', 'profit', 'competitors', 'trends'],
                    description: 'Rapor türü'
                },
                platform: { type: 'string' },
                period: {
                    type: 'string',
                    enum: ['today', '7d', '30d', '90d'],
                    description: 'Dönem'
                }
            },
            required: ['reportType']
        },
        handler: async (params) => analyticsTool.execute(params, { api, memory, license })
    });

    // 🧠 Hafıza Arama
    api.registerTool({
        name: 'vantuz.memory_search',
        description: `Hippocampus hafıza sisteminde arama yap.
    Geçmiş kararları, fiyat değişikliklerini, ürün geçmişini sorgula.`,
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Arama sorgusu' },
                type: {
                    type: 'string',
                    enum: ['decision', 'price_change', 'product', 'conversation', 'all'],
                    description: 'Hafıza türü'
                },
                limit: { type: 'number', description: 'Maksimum sonuç' }
            },
            required: ['query']
        },
        handler: async (params) => memory.search(params)
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 📝 COMMANDS - Kullanıcı tarafından doğrudan çağrılan komutlar
    // ═══════════════════════════════════════════════════════════════════════════

    api.registerCommand({
        name: 'stok',
        description: 'Stok durumunu göster',
        acceptsArgs: true,
        handler: async (ctx) => {
            const platform = ctx.args?.trim() || 'all';
            const stocks = await productTool.getStockSummary(platform, { api, memory });
            return { text: formatStockReport(stocks) };
        }
    });

    api.registerCommand({
        name: 'fiyat',
        description: 'Ürün fiyatını güncelle',
        acceptsArgs: true,
        handler: async (ctx) => {
            // Parse: "iPhone kılıf 199 TL" veya "SKU-123 %10 indirim"
            const result = await productTool.parseAndUpdatePrice(ctx.args, { api, memory });
            return { text: result.message };
        }
    });

    api.registerCommand({
        name: 'rapor',
        description: 'Satış raporu göster',
        acceptsArgs: true,
        handler: async (ctx) => {
            const period = ctx.args?.trim() || '7d';
            const report = await analyticsTool.getSalesReport(period, { api, memory });
            return { text: formatSalesReport(report) };
        }
    });

    api.registerCommand({
        name: 'rakip',
        description: 'Rakip fiyatlarını kontrol et',
        acceptsArgs: true,
        handler: async (ctx) => {
            const barcode = ctx.args?.trim();
            if (!barcode) return { text: '❌ Barkod veya ürün adı belirtin.' };
            const result = await repricerTool.analyzeCompetitors(barcode, { api, memory });
            return { text: formatCompetitorReport(result) };
        }
    });

    api.registerCommand({
        name: 'lisans',
        description: 'Lisans durumunu göster',
        handler: async () => {
            const status = await license.getStatus();
            return { text: formatLicenseStatus(status) };
        }
    });

    api.registerCommand({
        name: 'uyari',
        description: 'Uyarıları göster',
        handler: async () => {
            const alerts = alertService.alerts.filter(a => !a.read);
            return { text: alertService.formatAlerts(alerts) };
        }
    });

    api.registerCommand({
        name: 'zamanlama',
        description: 'Zamanlanmış görevleri göster',
        acceptsArgs: true,
        handler: async (ctx) => {
            if (ctx.args?.includes('ekle')) {
                const templates = scheduler.getTemplates();
                let msg = '📅 **Hazır Şablonlar**\n\n';
                templates.forEach(t => {
                    msg += `• \`${t.name}\`: ${t.scheduleHuman}\n`;
                });
                msg += '\n*Eklemek için: /zamanlama ekle [şablon]*';
                return { text: msg };
            }
            const jobs = await scheduler.listJobs();
            return { text: formatScheduleList(jobs) };
        }
    });

    api.registerCommand({
        name: 'platformlar',
        description: 'Bağlı platformları göster',
        handler: async () => {
            const result = quickReportTool.generatePlatformStatus();
            return { text: result.report };
        }
    });

    // 👥 Multi-Agent Team Command
    api.registerCommand({
        name: 'team',
        description: 'Yapay Zeka Takımı ile konuş (Milo, Josh, Marketing, Dev)',
        acceptsArgs: true,
        handler: async (ctx) => {
            // Lazy load to avoid circular deps or early init issues
            const TeamModule = (await import('../../modules/team/index.js')).default;
            const team = new TeamModule(api);
            await team.initialize();

            const args = ctx.args ? ctx.args.trim().split(' ') : [];
            const subCommand = args[0];

            if (!subCommand) {
                return { text: 'Komutlar: /team chat [agent] [mesaj], /team status, /team broadcast [mesaj]' };
            }

            if (subCommand === 'chat') {
                const agentName = args[1];
                const message = args.slice(2).join(' ');
                if (!agentName || !message) return { text: 'Kullanım: /team chat [milo|josh|marketing|dev] [mesaj]' };

                const response = await team.chat(agentName, message);
                return { text: `**@${agentName}**: ${response}` };
            }

            if (subCommand === 'broadcast') {
                const message = args.slice(1).join(' ');
                if (!message) return { text: 'Mesaj yazın.' };

                const results = await team.broadcast(message);
                let report = '📢 **Takım Yanıtları**\n\n';
                for (const [name, res] of Object.entries(results)) {
                    report += `**@${name}**: ${res}\n\n`;
                }
                return { text: report };
            }

            if (subCommand === 'status') {
                const memory = team.getSharedMemory().getEverything();
                return { text: `📝 **Takım Durumu**\n\n**Hedefler:**\n${memory.goals}\n\n**Durum:**\n${memory.status}` };
            }

            return { text: 'Geçersiz komut. Kullanılabilir: chat, broadcast, status' };
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // ⚙️ SERVICES - Arka plan servisleri
    // ═══════════════════════════════════════════════════════════════════════════

    // Lisans Doğrulama Servisi
    api.registerService({
        id: 'vantuz-license',
        start: async () => {
            logger.info('🔐 Lisans servisi başlatılıyor...');
            await license.initialize();

            // Her 24 saatte bir lisans kontrolü
            setInterval(() => license.verify(), 24 * 60 * 60 * 1000);
        },
        stop: () => {
            logger.info('🔐 Lisans servisi durduruluyor...');
        }
    });

    // Hippocampus Hafıza Servisi
    api.registerService({
        id: 'vantuz-memory',
        start: async () => {
            logger.info('🧠 Hippocampus hafıza sistemi başlatılıyor...');
            await memory.initialize();
        },
        stop: async () => {
            logger.info('🧠 Hippocampus kapatılıyor...');
            await memory.close();
        }
    });

    // Repricer Daemon (Arka planda fiyat kontrolü)
    api.registerService({
        id: 'vantuz-repricer-daemon',
        start: () => {
            logger.info('🩸 Kan Emici Repricer daemon başlatılıyor...');

            // Her 15 dakikada bir fiyat kontrolü
            const interval = setInterval(async () => {
                if (!license.isValid()) return;

                try {
                    const decisions = await repricerTool.runAutoCycle({ api, memory, license });
                    if (decisions.length > 0) {
                        logger.info(`💰 ${decisions.length} fiyat kararı alındı.`);
                    }
                } catch (err) {
                    logger.error('Repricer hatası:', err);
                }
            }, 15 * 60 * 1000);

            // Store interval for cleanup
            this._repricerInterval = interval;
        },
        stop: () => {
            if (this._repricerInterval) {
                clearInterval(this._repricerInterval);
            }
            logger.info('🩸 Repricer daemon durduruluyor...');
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 🚀 GATEWAY RPC - Harici API metodları
    // ═══════════════════════════════════════════════════════════════════════════

    api.registerGatewayMethod('vantuz.status', ({ respond }) => {
        respond(true, {
            version: PLUGIN_VERSION,
            license: license.getStatus(),
            memory: memory.getStats(),
            platforms: platformHub.getStatus()
        });
    });

    api.registerGatewayMethod('vantuz.config', ({ respond, params }) => {
        if (params.action === 'get') {
            respond(true, config.get('vantuz') || {});
        } else if (params.action === 'set') {
            config.set('vantuz', params.data);
            respond(true, { success: true });
        }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function formatStockReport(stocks) {
        let report = '📦 **Stok Durumu**\n\n';
        for (const [platform, data] of Object.entries(stocks)) {
            report += `**${platform}**\n`;
            report += `• Toplam: ${data.total} ürün\n`;
            report += `• Kritik (<5): ${data.critical} ürün\n`;
            report += `• Sıfır stok: ${data.zero} ürün\n\n`;
        }
        return report;
    }

    function formatSalesReport(report) {
        return `📊 **Satış Raporu (${report.period})**

💰 Toplam Ciro: ${report.revenue.toLocaleString('tr-TR')} ₺
📦 Toplam Sipariş: ${report.orders}
📈 Ortalama Sepet: ${report.avgBasket.toLocaleString('tr-TR')} ₺
🏆 En Çok Satan: ${report.topProduct}`;
    }

    function formatCompetitorReport(result) {
        let report = `🔍 **Rakip Analizi: ${result.product}**\n\n`;
        for (const comp of result.competitors) {
            report += `• ${comp.name}: ${comp.price} ₺ (Stok: ${comp.stock})\n`;
        }
        report += `\n💡 **Öneri**: ${result.recommendation}`;
        return report;
    }

    function formatLicenseStatus(status) {
        if (!status.valid) {
            return `❌ **Lisans Geçersiz**\nNeden: ${status.reason}`;
        }
        return `✅ **Lisans Aktif**
👤 Müşteri: ${status.customer}
📅 Bitiş: ${status.expiry}
⏰ Kalan: ${status.daysLeft} gün`;
    }

    // Plugin yüklendi
    logger.info(`🐙 Vantuz AI v${PLUGIN_VERSION} yüklendi!`);
}
