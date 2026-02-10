/**
 * 🏪 Platform API Hub
 * Tüm pazaryeri API'lerini tek noktadan yönet
 */

import { trendyolApi, TrendyolAPI } from './trendyol.js';
import { hepsiburadaApi, HepsiburadaAPI } from './hepsiburada.js';
import { n11Api, N11API } from './n11.js';
import { amazonApi, AmazonAPI } from './amazon.js';
import { ciceksepetiApi, CiceksepetiAPI } from './ciceksepeti.js';
import { pttavmApi, PttavmAPI } from './pttavm.js';
import { pazaramaApi, PazaramaAPI } from './pazarama.js';

// Platform aliases
const PLATFORM_ALIASES = {
    ty: 'trendyol',
    trendyol: 'trendyol',
    hb: 'hepsiburada',
    hepsiburada: 'hepsiburada',
    n11: 'n11',
    amazon: 'amazon',
    amz: 'amazon',
    cs: 'ciceksepeti',
    ciceksepeti: 'ciceksepeti',
    çiçeksepeti: 'ciceksepeti',
    ptt: 'pttavm',
    pttavm: 'pttavm',
    pazarama: 'pazarama',
    pzr: 'pazarama'
};

const platforms = {
    trendyol: trendyolApi,
    hepsiburada: hepsiburadaApi,
    n11: n11Api,
    amazon: amazonApi,
    ciceksepeti: ciceksepetiApi,
    pttavm: pttavmApi,
    pazarama: pazaramaApi
};

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM HUB
// ═══════════════════════════════════════════════════════════════════════════

export const platformHub = {
    /**
     * Platform'u alias ile bul
     */
    resolve(alias) {
        const normalized = alias?.toLowerCase().trim();
        const name = PLATFORM_ALIASES[normalized];
        return name ? platforms[name] : null;
    },

    /**
     * Tüm platformları başlat
     */
    async initAll(config) {
        const results = {};

        if (config.trendyol) {
            results.trendyol = trendyolApi.init(config.trendyol);
        }
        if (config.hepsiburada) {
            results.hepsiburada = hepsiburadaApi.init(config.hepsiburada);
        }
        if (config.n11) {
            results.n11 = n11Api.init(config.n11);
        }
        if (config.amazon) {
            results.amazon = amazonApi.init(config.amazon.eu, 'eu');
            if (config.amazon.us) {
                amazonApi.init(config.amazon.us, 'na');
            }
        }
        if (config.ciceksepeti) {
            results.ciceksepeti = ciceksepetiApi.init(config.ciceksepeti);
        }
        if (config.pttavm) {
            results.pttavm = pttavmApi.init(config.pttavm);
        }
        if (config.pazarama) {
            results.pazarama = pazaramaApi.init(config.pazarama);
        }

        return results;
    },

    /**
     * Bağlı platformları listele
     */
    getConnected() {
        const connected = [];
        for (const [name, api] of Object.entries(platforms)) {
            if (api.isConnected()) {
                connected.push(name);
            }
        }
        return connected;
    },

    /**
     * Durum özeti
     */
    getStatus() {
        const status = {};
        for (const [name, api] of Object.entries(platforms)) {
            status[name] = {
                connected: api.isConnected(),
                icon: this.getIcon(name)
            };
        }
        return status;
    },

    /**
     * Platform ikonu
     */
    getIcon(platform) {
        const icons = {
            trendyol: '🟠',
            hepsiburada: '🟣',
            n11: '🔵',
            amazon: '🟡',
            ciceksepeti: '🌸',
            pttavm: '📮',
            pazarama: '🛒'
        };
        return icons[platform] || '📦';
    },

    /**
     * Çoklu platform fiyat güncelle
     */
    async updatePriceMulti(barcode, price, targetPlatforms = 'all') {
        const targets = targetPlatforms === 'all'
            ? this.getConnected()
            : targetPlatforms.split(',').map(p => PLATFORM_ALIASES[p.trim()]).filter(Boolean);

        const results = {};
        const tasks = targets.map(async (platform) => {
            const api = platforms[platform];
            if (!api?.isConnected()) {
                results[platform] = { success: false, error: 'Not connected' };
                return;
            }
            try {
                results[platform] = await api.updatePrice(barcode, price);
            } catch (error) {
                results[platform] = { success: false, error: error.message };
            }
        });
        await Promise.allSettled(tasks);
        return results;
    },

    /**
     * Çoklu platform stok güncelle
     */
    async updateStockMulti(barcode, quantity, targetPlatforms = 'all') {
        const targets = targetPlatforms === 'all'
            ? this.getConnected()
            : targetPlatforms.split(',').map(p => PLATFORM_ALIASES[p.trim()]).filter(Boolean);

        const results = {};
        const tasks = targets.map(async (platform) => {
            const api = platforms[platform];
            if (!api?.isConnected()) {
                results[platform] = { success: false, error: 'Not connected' };
                return;
            }
            try {
                results[platform] = await api.updateStock(barcode, quantity);
            } catch (error) {
                results[platform] = { success: false, error: error.message };
            }
        });
        await Promise.allSettled(tasks);
        return results;
    },

    /**
     * Tüm platformlardan sipariş çek
     */
    async getAllOrders(params = {}) {
        const connected = this.getConnected();
        const allOrders = [];

        const orderPromises = connected.map(async (platform) => {
            const api = platforms[platform];
            try {
                const result = await api.getOrders(params);
                if (result?.success) {
                    const orders = result.data.content || result.data.orders || result.data || [];
                    return orders.map(order => ({
                        ...order,
                        _platform: platform,
                        _icon: this.getIcon(platform)
                    }));
                }
                return [];
            } catch {
                return [];
            }
        });

        const results = await Promise.allSettled(orderPromises);
        results.forEach(platformOrders => {
            if (platformOrders.status === 'fulfilled') {
                allOrders.push(...platformOrders.value);
            }
        });

        // Tarihe göre sırala
        allOrders.sort((a, b) => new Date(b.createdDate || b.orderDate) - new Date(a.createdDate || a.orderDate));
        return allOrders;
    }
};

// Export individual APIs
export {
    trendyolApi,
    hepsiburadaApi,
    n11Api,
    amazonApi,
    ciceksepetiApi,
    pttavmApi,
    pazaramaApi,
    TrendyolAPI,
    HepsiburadaAPI,
    N11API,
    AmazonAPI,
    CiceksepetiAPI,
    PttavmAPI,
    PazaramaAPI
};

export default platformHub;
