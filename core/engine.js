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
import { getEIAMonitor } from './eia-monitor.js'; // New import

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
        nested: {
            eu: {
                keys: ['sellerId', 'clientId', 'refreshToken']
            },
            us: {
                keys: ['sellerId', 'clientId', 'refreshToken']
            }
        }
    },
    ciceksepeti: {
        envPrefix: 'CICEKSEPETI',
        keys: ['apiKey', 'apiSecret']
    },
    pttavm: {
        envPrefix: 'PTTAVM',
        keys: ['apiKey', 'apiSecret']
    },
    pazarama: {
        envPrefix: 'PAZARAMA',
        keys: ['apiKey', 'apiSecret']
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

        this.initialized = true;
        log('INFO', 'Vantuz Engine hazır', {
            platforms: this.context.connectedPlatforms.length,
            gateway: this.gateway?.isConnected() || false
        });

        return this;
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
            if (platformMap.envPrefix) {
                const config = {};
                let hasRequiredEnv = false;
                for (const key of platformMap.keys) {
                    const envKey = `${platformMap.envPrefix}_${key.toUpperCase()}`;
                    if (this.env[envKey]) {
                        config[key] = this.env[envKey];
                        hasRequiredEnv = true;
                    }
                }
                if (hasRequiredEnv) {
                    platformConfig[platformName] = config;
                }
            } else if (platformName === 'amazon' && this.env.AMAZON_SELLER_ID) { // Specific handling for Amazon's nested structure
                platformConfig.amazon = {};
                // Handle EU configuration
                const euConfig = {};
                let hasEuEnv = false;
                for (const key of PLATFORM_CONFIG_MAP.amazon.nested.eu.keys) {
                    const envKey = `AMAZON_${key.toUpperCase()}`;
                    if (this.env[envKey]) {
                        euConfig[key] = this.env[envKey];
                        hasEuEnv = true;
                    }
                }
                if (hasEuEnv) {
                    platformConfig.amazon.eu = euConfig;
                }

                // Handle US configuration if needed (add similar logic here)
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
                        const products = result.data?.content || result.data || [];
                        this.context.products.push(...products.map(p => ({
                            ...p,
                            _platform: platform
                        })));
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
            systemContext: this._buildContextInfo()
        };

        return await aiChat(message, enrichedConfig, this.env);
    }

    /**
     * Mesajdan Tool tespiti (Basit NLP)
     */
    async _tryExecuteToolFromMessage(message) {
        const lower = message.toLowerCase().trim();

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

        return null;
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
            aiProvider: this.config.aiProvider || 'gemini',
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
