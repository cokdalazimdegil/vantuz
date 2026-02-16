/**
 * 🐙 VANTUZ ENGINE v3.2
 * Merkezi motor - Tüm sistemleri yönetir
 * 
 * Vantuz Gateway üzerinden güçlendirilmiş altyapı
 * Entegre Tool Sistemi
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Platform Hub
import platformHub from '../plugins/vantuz/platforms/index.js';

// AI Provider & Gateway
import { getChannelManager } from './channels.js';
import { chat as aiChat, log } from './ai-provider.js';
import { getGateway } from './gateway.js';
import { getEIAMonitor } from './eia-monitor.js';
import AutomationManager from './automation.js';
import OpenClawBridge from './openclaw-bridge.js';
import { executeTool } from './agent.js';
import { getCriticalQueue } from './queue.js';
import { getMemory } from './memory.js';

// Tools
import { repricerTool } from '../plugins/vantuz/tools/repricer.js';
import { visionTool } from '../plugins/vantuz/tools/vision.js';
import { sentimentTool } from '../plugins/vantuz/tools/sentiment.js';
import { crossborderTool } from '../plugins/vantuz/tools/crossborder.js';
import { productTool } from '../plugins/vantuz/tools/product.js';
import { analyticsTool } from '../plugins/vantuz/tools/analytics.js';
import { quickReportTool } from '../plugins/vantuz/tools/quick-report.js';

const PLATFORM_CONFIG_MAP = {
    trendyol: {
        envPrefix: 'TRENDYOL',
        keys: ['supplierId', 'apiKey', 'apiSecret']
    },
    hepsiburada: {
        envPrefix: 'HEPSIBURADA',
        keys: ['merchantId', 'username', 'password']
    },
    n11: {
        envPrefix: 'N11',
        keys: ['apiKey', 'apiSecret']
    },
    amazon: {
        envPrefix: 'AMAZON',
        keys: ['sellerId', 'clientId', 'clientSecret', 'refreshToken', 'region']
    },
    ciceksepeti: {
        envPrefix: 'CICEKSEPETI',
        keys: ['apiKey', 'supplierId']
    },
    pttavm: {
        envPrefix: 'PTTAVM',
        keys: ['apiKey', 'token', 'shopId']
    },
    pazarama: {
        envPrefix: 'PAZARAMA',
        keys: ['clientId', 'clientSecret']
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const VANTUZ_HOME = path.join(os.homedir(), '.vantuz');
const CONFIG_PATH = path.join(VANTUZ_HOME, '.env');
const CONFIG_JSON = path.join(VANTUZ_HOME, 'config.json');

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class VantuzEngine {
    constructor() {
        this.initialized = false;
        this.config = {};
        this.env = {};
        this.platforms = {};
        this.channels = null;
        this.gateway = null;
        this.context = {
            products: [],
            connectedPlatforms: []
        };
        this.eiaMonitor = null; // New property
        this.automation = null;
        this.bridge = null;

        // Tool Registry
        this.tools = {
            repricer: repricerTool,
            vision: visionTool,
            sentiment: sentimentTool,
            crossborder: crossborderTool,
            product: productTool,
            analytics: analyticsTool,
            quickReport: quickReportTool
        };

        // Critical Operation Queue (Lane Queue)
        this.queue = getCriticalQueue();
        this.memory = getMemory();
    }

    /**
     * Engine'i başlat
     */
    async initialize() {
        log('INFO', 'Vantuz Engine v3.2 başlatılıyor...');

        // Config ve env yükle
        this._loadConfig();
        this._loadEnv();

        // Vantuz Gateway bağlantısı
        try {
            this.gateway = await getGateway();
            if (this.gateway.isConnected()) {
                log('INFO', 'Vantuz Gateway bağlı', this.gateway.getInfo());
            } else if (this._shouldAutoStartGateway()) {
                const started = await this.gateway.ensureRunning();
                if (started.success) {
                    log('INFO', 'Vantuz Gateway otomatik başlatıldı', this.gateway.getInfo());
                } else {
                    log('WARN', 'Gateway otomatik başlatılamadı', { error: started.error });
                }
            }
        } catch (e) {
            log('WARN', 'Gateway bağlantısı başarısız, direkt mod', { error: e.message });
        }

        // Channel Manager'ı başlat
        this.channels = await getChannelManager();

        // Platform Hub'ı başlat
        await this._initPlatforms();

        // Context oluştur (bağlı platformlardan veri çek)
        await this._buildContext();

        // Initialize and start EIA Monitor
        this.eiaMonitor = getEIAMonitor(this.config, this.env);
        await this.eiaMonitor.initMonitoringTasks(); // New line

        // Automation manager
        this.automation = new AutomationManager(this);
        this.automation.init();

        // Gateway WS bridge (inbound)
        if (this._shouldStartBridge()) {
            try {
                this.bridge = new OpenClawBridge(this, this.gateway);
                this.bridge.start();
            } catch (e) {
                log('WARN', 'Gateway bridge başlatılamadı', { error: e.message });
            }
        }

        this.initialized = true;
        log('INFO', 'Vantuz Engine hazır', {
            platforms: this.context.connectedPlatforms.length,
            gateway: this.gateway?.isConnected() || false
        });

        return this;
    }

    /**
     * Gelişmiş mesaj işleme (otomasyon + onay)
     */
    async handleMessage(message, meta = { channel: 'local', from: 'local' }) {
        if (!this.initialized) await this.initialize();
        if (this.automation) {
            const result = await this.automation.handleMessage(message, meta);
            if (result?.handled) {
                return result.response;
            }
        }
        return await this.chat(message);
    }

    /**
     * Gateway otomatik başlatılsın mı?
     */
    _shouldAutoStartGateway() {
        const envValue = this.env.VANTUZ_GATEWAY_AUTOSTART;
        if (envValue !== undefined) {
            return !['0', 'false', 'no'].includes(String(envValue).toLowerCase());
        }
        if (this.config && this.config.gatewayAutoStart !== undefined) {
            return this.config.gatewayAutoStart !== false;
        }
        return true;
    }

    _shouldStartBridge() {
        const envValue = this.env.VANTUZ_OPENCLAW_BRIDGE;
        if (envValue !== undefined) {
            return !['0', 'false', 'no'].includes(String(envValue).toLowerCase());
        }
        if (this.config && this.config.openclawBridge !== undefined) {
            return this.config.openclawBridge !== false;
        }
        return true;
    }

    /**
     * Config dosyasını yükle
     */
    _loadConfig() {
        try {
            if (fs.existsSync(CONFIG_JSON)) {
                this.config = JSON.parse(fs.readFileSync(CONFIG_JSON, 'utf-8'));
            }
        } catch (e) {
            log('ERROR', 'Config yüklenemedi', { error: e.message });
        }
    }

    /**
     * Environment değişkenlerini yükle
     */
    _loadEnv() {
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
                content.split('\n').forEach(line => {
                    const match = line.match(/^([^=]+)=(.*)$/);
                    if (match) {
                        this.env[match[1].trim()] = match[2].trim();
                    }
                });
            }
        } catch (e) {
            log('ERROR', 'Env yüklenemedi', { error: e.message });
        }
    }

    /**
     * Platform API'lerini başlat
     */
    async _initPlatforms() {
        const platformConfig = {};

        for (const platformName in PLATFORM_CONFIG_MAP) {
            const platformMap = PLATFORM_CONFIG_MAP[platformName];

            if (platformMap.envPrefix && platformMap.keys) { // Handle all platforms with direct keys
                const config = {};
                let hasRequiredEnv = false;
                for (const key of platformMap.keys) {
                    const upper = key.toUpperCase();
                    const snake = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
                    const envKey = `${platformMap.envPrefix}_${upper}`;
                    const altEnvKey = `${platformMap.envPrefix}_${snake}`;
                    const value = this.env[envKey] || this.env[altEnvKey];
                    if (value) {
                        config[key] = value;
                        hasRequiredEnv = true;
                    }
                }
                if (hasRequiredEnv) {
                    platformConfig[platformName] = config;
                }
            }
        }

        // Platform Hub'ı başlat
        if (Object.keys(platformConfig).length > 0) {
            this.platforms = await platformHub.initAll(platformConfig);
            log('INFO', 'Platform Hub başlatıldı', {
                platforms: Object.keys(this.platforms)
            });
        }
    }

    /**
     * Bağlı platformlardan context oluştur
     */
    async _buildContext() {
        this.context.connectedPlatforms = platformHub.getConnected();

        for (const platform of this.context.connectedPlatforms) {
            try {
                const api = platformHub.resolve(platform);
                if (api && typeof api.getProducts === 'function') {
                    const result = await api.getProducts({ page: 0, size: 10 });
                    if (result?.success) {
                        const data = result.data;
                        let products = [];
                        if (Array.isArray(data?.content)) products = data.content;
                        else if (Array.isArray(data)) products = data;
                        else if (Array.isArray(data?.productList?.product)) products = data.productList.product;
                        if (products.length > 0) {
                            this.context.products.push(...products.map(p => ({
                                ...p,
                                _platform: platform
                            })));
                        }
                    }
                }
            } catch (e) {
                log('ERROR', `${platform} veri çekme hatası`, { error: e.message });
            }
        }
    }

    /**
     * AI ile sohbet - Tool destekli
     */
    async chat(message) {
        if (!this.initialized) await this.initialize();

        // 1. Basit komut kontrolü (Tool çağırma)
        const toolResult = await this._tryExecuteToolFromMessage(message);
        if (toolResult) return toolResult;

        // 1.5 Gelişmiş ajan (araç çağrıları)
        const agentResult = await this._tryAgent(message);
        if (agentResult) return agentResult;

        // 2. Gateway üzerinden AI (Eğer varsa)
        if (this.gateway?.isConnected()) {
            try {
                const gatewayResult = await this.gateway.chat(message, {
                    systemPrompt: this._buildContextInfo()
                });
                if (gatewayResult.success) return gatewayResult.response;
            } catch (e) { }
        }

        // 3. Direkt API (Fallback)
        const enrichedConfig = {
            ...this.config,
            aiProvider: this.env.AI_PROVIDER || this.config.aiProvider || 'gemini',
            systemContext: this._buildContextInfo()
        };

        return await aiChat(message, enrichedConfig, this.env);
    }

    async _tryAgent(message) {
        const mode = this.config?.agentMode || this.env.VANTUZ_AGENT_MODE;
        if (!mode || mode === 'off') return null;

        const systemPrompt = [
            'Sen Vantuz gelişmiş ajanısın.',
            'Gerekirse aşağıdaki araçlardan birini çağır:',
            'exec, readFile, listDir, httpGet, apiQuery',
            'Sadece JSON döndür.',
            'Şema: { "tool": "exec|readFile|listDir|httpGet|apiQuery", "args": { ... } }',
            'apiQuery args: { "platform": "n11|trendyol|hepsiburada|amazon|ciceksepeti|pazarama|pttavm", "action": "orders|products|stock|categories", "params": { ... } }',
            'Eğer araç gerekmezse: { "final": "cevap" }',
            'Dosya yollarını ve komutları kısa tut.'
        ].join('\n');

        const plan = await aiChat(message, {
            aiProvider: this.config.aiProvider || 'gemini',
            systemContext: systemPrompt
        }, this.env);

        const jsonMatch = plan.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        let obj;
        try { obj = JSON.parse(jsonMatch[0]); } catch { return null; }
        if (obj.final) return obj.final;
        if (!obj.tool) return null;

        let toolResult;
        if (obj.tool === 'apiQuery') {
            toolResult = await this._runApiQuery(obj.args || {});
        } else {
            toolResult = await executeTool(obj.tool, obj.args || {}, this.config);
        }
        const followup = await aiChat(
            `Kullanıcı mesajı: ${message}\nAraç çıktısı:\n${toolResult.output}\nCevap ver.`,
            { aiProvider: this.config.aiProvider || 'gemini' },
            this.env
        );
        return followup;
    }

    async _runApiQuery(args = {}) {
        const platform = (args.platform || '').toLowerCase();
        const action = (args.action || '').toLowerCase();
        const params = args.params || {};
        const api = platformHub.resolve(platform);
        if (!api) return { success: false, output: 'Platform bulunamadı.' };

        try {
            if (action === 'orders' && api.getOrders) {
                const result = await api.getOrders(params);
                return { success: true, output: JSON.stringify(result?.data || result || {}, null, 2) };
            }
            if (action === 'products' && api.getProducts) {
                const result = await api.getProducts(params);
                return { success: true, output: JSON.stringify(result?.data || result || {}, null, 2) };
            }
            if (action === 'stock' && api.getProducts) {
                const result = await api.getProducts(params);
                return { success: true, output: JSON.stringify(result?.data || result || {}, null, 2) };
            }
            if (action === 'categories' && api.getTopCategories) {
                const result = await api.getTopCategories(params);
                return { success: true, output: JSON.stringify(result?.data || result || {}, null, 2) };
            }
            return { success: false, output: 'Bu platform için istenen action desteklenmiyor.' };
        } catch (e) {
            return { success: false, output: e.message };
        }
    }

    /**
     * Mesajdan Tool tespiti (Basit NLP)
     */
    async _tryExecuteToolFromMessage(message) {
        const lower = message.toLowerCase().trim();
        const normalized = lower
            .replace(/[çÇ]/g, 'c')
            .replace(/[ğĞ]/g, 'g')
            .replace(/[ıİ]/g, 'i')
            .replace(/[öÖ]/g, 'o')
            .replace(/[şŞ]/g, 's')
            .replace(/[üÜ]/g, 'u');

        // Check for explicit commands
        if (lower.startsWith('/')) {
            const parts = lower.substring(1).split(' ');
            const command = parts[0];
            const args = parts.slice(1);

            switch (command) {
                case 'repricer':
                case 'rakip':
                case 'fiyat-analizi':
                    // In a real scenario, you'd parse args and pass them to repricerTool
                    return "Repricer aracı çalıştırılıyor... (Detaylı parametreler için /rakip komutunu kullanın)";
                case 'stock':
                case 'stok-durumu':
                    const stocks = await this.getStock();
                    return JSON.stringify(stocks.map(s => ({ platform: s.platform, items: s.products.length })), null, 2);
                case 'help':
                    return "Kullanabileceğin komutlar: /rakip, /stok-durumu";
                default:
                    return `Bilinmeyen komut: /${command}. Yardım için /help yazabilirsin.`;
            }
        }

        // Natural language shortcuts (no hallucination)
        if (
            lower.includes('hangi pazaryerleri bağlı') ||
            lower.includes('hangi pazaryeri bağlı') ||
            lower.includes('hangi platformlar bağlı') ||
            normalized.includes('hangi pazaryerleri bagli') ||
            normalized.includes('hangi platformlar bagli')
        ) {
            const connected = this.context.connectedPlatforms;
            if (connected.length === 0) return 'Şu an bağlı pazaryeri yok.';
            return `Bağlı pazaryerleri: ${connected.map(p => p.toUpperCase()).join(', ')}`;
        }

        const orderKeywords = [
            'sipariş',
            'siparis'
        ];
        const hasOrderKeyword = orderKeywords.some(k => lower.includes(k) || normalized.includes(k));

        if (hasOrderKeyword) {
            const orders = await this.getOrders({ size: 100, allStatuses: true });
            if (!orders || orders.length === 0) {
                return 'Sipariş verisine ulaşılamadı. Lütfen platform API bağlantılarını kontrol edin.';
            }

            const active = orders.filter(o => this.isActiveStatus(o.status || o.shipmentPackageStatus || o.orderStatus));
            const completed = orders.filter(o => !this.isActiveStatus(o.status || o.shipmentPackageStatus || o.orderStatus));

            let message = '';
            if (active.length > 0) {
                const summary = this._summarizeOrdersByStatus(active);
                message += `Şu an bağlı platformlardan gelen toplam ${active.length} YENİ/AKTİF sipariş var.${summary ? ` (${summary})` : ''}`;
            } else {
                message += 'Şu an aktif (yeni/hazırlanan) sipariş yok.';
            }

            if (completed.length > 0) {
                const summary = this._summarizeOrdersByStatus(completed);
                message += `\n(Geçmiş Siparişler: ${completed.length} adet - ${summary})`;
            }

            return message;
        }

        if (lower.includes('onaylanan')) {
            const orders = await this.getOrders({ size: 100, status: 'Picking' });
            return `Şu an onaylanan (Picking) ${orders.length} sipariş var.`;
        }

        if (lower.includes('kargoya verilmemiş') || lower.includes('henüz kargoya') || lower.includes('kargoya verilmedi') || normalized.includes('kargoya verilmemis')) {
            const orders = await this.getOrders({ size: 100, status: 'Created' });
            return `Şu an kargoya verilmemiş (Created) ${orders.length} sipariş var.`;
        }

        return null;
    }

    _summarizeOrdersByStatus(orders = []) {
        if (!Array.isArray(orders) || orders.length === 0) return '';
        const counts = {};
        orders.forEach(o => {
            const s = (o.status || o.shipmentPackageStatus || o.orderStatus || 'UNKNOWN').toString();
            counts[s] = (counts[s] || 0) + 1;
        });
        const entries = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([s, n]) => `${s}:${n}`);
        return entries.join(', ');
    }

    /**
     * Context bilgisi oluştur (AI system prompt için)
     */
    _buildContextInfo() {
        const connected = this.context.connectedPlatforms;
        let info = `\n\n--- MEVCUT SİSTEM DURUMU ---\n`;
        info += `Bağlı Platformlar: ${connected.length > 0 ? connected.join(', ') : 'Hiçbiri'}\n`;
        info += `Gateway: ${this.gateway?.isConnected() ? 'BAĞLI' : 'KOPUK'}\n`;
        info += `Mevcut Toollar: Repricer, Vision, Sentiment, Analytics, CrossBorder\n`;

        if (this.context.products.length > 0) {
            info += `\nÖrnek Ürünler:\n`;
            this.context.products.slice(0, 3).forEach(p => {
                info += `- ${p.title} (${p._platform}): ${p.salePrice} TL\n`;
            });
        }
        return info;
    }

    // --- Helper Methods ---

    isActiveStatus(status) {
        const s = String(status || '').toLowerCase();
        return s === 'created' || s === 'picking' || s === 'unpacked' || s === 'shipped';
    }

    async getStock(platform = 'all') {
        const results = [];
        const targets = platform === 'all'
            ? this.context.connectedPlatforms
            : [platform];

        for (const p of targets) {
            try {
                const api = platformHub.resolve(p);
                if (api?.getProducts) {
                    const result = await api.getProducts({ page: 0, size: 50 });
                    if (result?.success) {
                        const products = result.data?.content || result.data || [];
                        results.push({
                            platform: p,
                            icon: platformHub.getIcon(p),
                            products: products.map(prod => ({
                                barcode: prod.barcode,
                                title: prod.title || prod.name,
                                stock: prod.quantity || prod.stock,
                                price: prod.salePrice || prod.price
                            }))
                        });
                    }
                }
            } catch (e) {
                log('ERROR', `Stok çekme hatası: ${p}`, { error: e.message });
            }
        }
        return results;
    }

    async getOrders(params = {}) {
        return await platformHub.getAllOrders(params);
    }

    getStatus() {
        const status = platformHub.getStatus();
        const connected = this.context.connectedPlatforms;
        const channelStatus = this.channels ? this.channels.getStatus() : {};
        const gatewayInfo = this.gateway ? this.gateway.getInfo() : { connected: false };

        return {
            engine: this.initialized ? 'active' : 'inactive',
            version: '3.2',
            aiProvider: this.env.AI_PROVIDER || this.config.aiProvider || 'gemini',
            gateway: gatewayInfo,
            platforms: status,
            channels: channelStatus,
            connectedCount: connected.length,
            totalPlatforms: 7,
            productCount: this.context.products.length
        };
    }

    async doctor() {
        const status = this.getStatus();
        return {
            engine: this.initialized,
            gateway: {
                status: status.gateway.connected ? 'healthy' : 'unreachable',
                ...status.gateway
            },
            platforms: status.platforms,
            ai: {
                provider: status.aiProvider,
                keyConfigured: true,
                gatewayFallback: status.gateway.connected
            },
            channels: status.channels
        };
    }
}

// Singleton instance
let engineInstance = null;

export async function getEngine() {
    if (!engineInstance) {
        engineInstance = new VantuzEngine();
        await engineInstance.initialize();
    }
    return engineInstance;
}

export default VantuzEngine;
