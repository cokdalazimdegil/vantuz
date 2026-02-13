// modules/war-room/competitor-tracker.js
// Competitor Price Tracker for Vantuz OS V2
// Monitors rival prices with POLITENESS MODE to avoid IP bans.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from '../../core/ai-provider.js';

const HISTORY_FILE = path.join(os.homedir(), '.vantuz', 'memory', 'competitor-history.json');
const MAX_HISTORY = 1000;

// ═══════════════════════════════════════════════════════════════════════════
// POLITENESS MODE — Anti-Ban Protection
// ═══════════════════════════════════════════════════════════════════════════

function randomDelay(minMs = 2000, maxMs = 5000) {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise(resolve => setTimeout(resolve, delay));
}

const RATE_LIMITS = new Map(); // platform -> { count, resetAt }
const MAX_REQUESTS_PER_HOUR = 120;

function checkRateLimit(platform) {
    const now = Date.now();
    let limit = RATE_LIMITS.get(platform);

    if (!limit || now > limit.resetAt) {
        limit = { count: 0, resetAt: now + 3600000 }; // 1 hour window
        RATE_LIMITS.set(platform, limit);
    }

    if (limit.count >= MAX_REQUESTS_PER_HOUR) {
        log('WARN', `Rate limit reached for ${platform}`, {
            count: limit.count,
            resetIn: Math.round((limit.resetAt - now) / 60000) + ' min'
        });
        return false;
    }

    limit.count++;
    return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// HISTORY PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
        }
    } catch (e) { /* ignore */ }
    return {};
}

function saveHistory(history) {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = HISTORY_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(history, null, 2), 'utf-8');
    fs.renameSync(tmp, HISTORY_FILE);
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPETITOR TRACKER
// ═══════════════════════════════════════════════════════════════════════════

class CompetitorTracker {
    constructor() {
        this.history = loadHistory(); // barcode -> [{timestamp, platform, competitors[]}]
        this.adapters = null; // Set by init()
        log('INFO', 'CompetitorTracker initialized', {
            trackedProducts: Object.keys(this.history).length
        });
    }

    /**
     * Set adapter registry reference.
     */
    setAdapters(adapterRegistry) {
        this.adapters = adapterRegistry;
    }

    /**
     * Track competitor prices for a single product.
     * @param {string} barcode
     * @param {string} platform - Platform to check (default: all active).
     * @returns {{ competitors: array, alert: string|null }}
     */
    async trackProduct(barcode, platform = null) {
        const competitors = [];
        const platforms = platform
            ? [platform]
            : (this.adapters?.getActive() || []).map(a => a.name);

        for (const pName of platforms) {
            // Rate limit check
            if (!checkRateLimit(pName)) {
                log('WARN', `Skipping ${pName} for ${barcode}: rate limited`);
                continue;
            }

            const adapter = this.adapters?.get(pName);
            if (!adapter || typeof adapter.getCompetitorPrices !== 'function') {
                continue;
            }

            try {
                // POLITENESS MODE: Random delay before each request
                await randomDelay(2000, 5000);

                const result = await adapter.getCompetitorPrices(barcode);
                if (result?.success && result.data) {
                    for (const comp of result.data) {
                        competitors.push({
                            platform: pName,
                            seller: comp.seller || comp.merchantName || 'unknown',
                            price: parseFloat(comp.price || comp.salePrice || 0),
                            stock: comp.stock ?? comp.hasStock ?? null,
                            rating: comp.rating || null,
                            fetchedAt: new Date().toISOString()
                        });
                    }
                }
            } catch (e) {
                log('ERROR', `Competitor fetch failed: ${pName}/${barcode}`, { error: e.message });
            }
        }

        // Store in history
        this._recordHistory(barcode, competitors);

        // Detect alerts
        const alert = this._detectAlerts(barcode, competitors);

        return { barcode, competitors, alert };
    }

    /**
     * Track multiple products in batch (respects rate limits).
     * @param {string[]} barcodes
     */
    async trackBatch(barcodes) {
        const results = [];

        for (const barcode of barcodes) {
            const result = await this.trackProduct(barcode);
            results.push(result);

            // Extra delay between products for politeness
            await randomDelay(1000, 3000);
        }

        log('INFO', `Batch tracking complete`, {
            products: barcodes.length,
            totalCompetitors: results.reduce((s, r) => s + r.competitors.length, 0)
        });

        return results;
    }

    /**
     * Get price history for a product.
     */
    getHistory(barcode) {
        return this.history[barcode] || [];
    }

    /**
     * Get competitor summary: cheapest, average, count.
     */
    getSummary(barcode) {
        const entries = this.history[barcode] || [];
        if (entries.length === 0) return null;

        const latest = entries[entries.length - 1];
        const prices = latest.competitors.map(c => c.price).filter(p => p > 0);

        return {
            barcode,
            sellerCount: latest.competitors.length,
            cheapest: prices.length > 0 ? Math.min(...prices) : null,
            average: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
            mostExpensive: prices.length > 0 ? Math.max(...prices) : null,
            lastChecked: latest.timestamp
        };
    }

    // ─────────────────────────────────────────────────────────────────────
    // PRIVATE
    // ─────────────────────────────────────────────────────────────────────

    _recordHistory(barcode, competitors) {
        if (!this.history[barcode]) {
            this.history[barcode] = [];
        }

        this.history[barcode].push({
            timestamp: new Date().toISOString(),
            competitors
        });

        // Keep only recent entries per product
        if (this.history[barcode].length > 50) {
            this.history[barcode] = this.history[barcode].slice(-50);
        }

        // Limit total history size
        const total = Object.values(this.history).reduce((s, arr) => s + arr.length, 0);
        if (total > MAX_HISTORY) {
            // Remove oldest product histories
            const sorted = Object.entries(this.history)
                .sort((a, b) => a[1].length - b[1].length);
            delete this.history[sorted[0][0]];
        }

        saveHistory(this.history);
    }

    _detectAlerts(barcode, competitors) {
        if (competitors.length === 0) return null;

        const prices = competitors.map(c => c.price).filter(p => p > 0);
        if (prices.length === 0) return null;

        const cheapest = Math.min(...prices);
        const lowStockSellers = competitors.filter(c => c.stock !== null && c.stock < 5);

        // Alert: all competitors low stock → opportunity!
        if (lowStockSellers.length > 0 && lowStockSellers.length >= competitors.length * 0.7) {
            return `🔥 FIRSAT: ${barcode} — Rakiplerin %${Math.round(lowStockSellers.length / competitors.length * 100)}'i düşük stokta. Fiyat artırma fırsatı!`;
        }

        return null;
    }
}

let trackerInstance = null;

export function getCompetitorTracker() {
    if (!trackerInstance) {
        trackerInstance = new CompetitorTracker();
    }
    return trackerInstance;
}

export default CompetitorTracker;
