// modules/war-room/pricing-engine.js
// Dynamic Pricing Engine for Vantuz OS V2
// Reads rules from BRAND.md, applies pricing strategies, includes KILL SWITCH.

import fs from 'fs';
import path from 'path';
import { log } from '../../core/ai-provider.js';
import { getCriticalQueue } from '../../core/queue.js';

// ═══════════════════════════════════════════════════════════════════════════
// BRAND RULES PARSER
// ═══════════════════════════════════════════════════════════════════════════

function parseBrandRules() {
    const brandPath = path.join(process.cwd(), 'workspace', 'BRAND.md');
    const defaults = {
        minMargin: 15,
        maxDiscount: 30,
        killSwitchMargin: 5,   // Kill switch activates below this
        strategy: 'smart'       // 'aggressive', 'smart', 'conservative'
    };

    try {
        if (!fs.existsSync(brandPath)) return defaults;
        const content = fs.readFileSync(brandPath, 'utf-8');

        // Parse min margin
        const marginMatch = content.match(/Minimum Kar Marjı[:\s]*%?(\d+)/i);
        if (marginMatch) defaults.minMargin = parseInt(marginMatch[1], 10);

        // Parse max discount
        const discountMatch = content.match(/Maksimum İndirim[:\s]*%?(\d+)/i);
        if (discountMatch) defaults.maxDiscount = parseInt(discountMatch[1], 10);

        // Parse strategy
        if (content.includes('Agresif') || content.includes('aggressive')) {
            defaults.strategy = 'aggressive';
        } else if (content.includes('Muhafazakar') || content.includes('conservative')) {
            defaults.strategy = 'conservative';
        }

        log('INFO', 'Brand rules parsed', defaults);
    } catch (e) {
        log('WARN', 'Brand rules parse error, using defaults', { error: e.message });
    }

    return defaults;
}

// ═══════════════════════════════════════════════════════════════════════════
// KILL SWITCH
// ═══════════════════════════════════════════════════════════════════════════

let killSwitchActive = false;
let killSwitchReason = '';
const killSwitchCallbacks = []; // webhook/notification callbacks

function activateKillSwitch(reason, productInfo) {
    killSwitchActive = true;
    killSwitchReason = reason;

    log('ERROR', `🛑 KILL SWITCH ACTIVATED: ${reason}`, productInfo);

    // Notify all registered callbacks
    for (const cb of killSwitchCallbacks) {
        try { cb({ reason, productInfo, timestamp: new Date().toISOString() }); }
        catch (e) { /* swallow */ }
    }
}

function resetKillSwitch() {
    killSwitchActive = false;
    killSwitchReason = '';
    log('INFO', '✅ Kill Switch reset — otonom mod devam ediyor');
}

// ═══════════════════════════════════════════════════════════════════════════
// PRICING ENGINE
// ═══════════════════════════════════════════════════════════════════════════

class PricingEngine {
    constructor() {
        this.rules = parseBrandRules();
        this.queue = getCriticalQueue();
        this.decisions = []; // Recent decisions log
        log('INFO', 'PricingEngine initialized', this.rules);
    }

    /**
     * Register a callback for Kill Switch activation.
     */
    onKillSwitch(callback) {
        killSwitchCallbacks.push(callback);
    }

    /**
     * Reload brand rules (e.g., after BRAND.md edit).
     */
    reloadRules() {
        this.rules = parseBrandRules();
        log('INFO', 'Brand rules reloaded', this.rules);
    }

    /**
     * Check kill switch status.
     */
    isKillSwitchActive() {
        return { active: killSwitchActive, reason: killSwitchReason };
    }

    /**
     * Reset kill switch (manual override).
     */
    resetKillSwitch() {
        resetKillSwitch();
    }

    /**
     * Calculate optimal price for a product.
     * @param {object} product - Unified Product from catalog.
     * @param {object[]} competitors - From CompetitorTracker.
     * @returns {{ action, newPrice, reason, dryRun }}
     */
    calculatePrice(product, competitors = []) {
        const { price, cost, barcode } = product;
        const { minMargin, killSwitchMargin, strategy } = this.rules;

        // ── Kill Switch Check ──
        if (cost > 0 && price > 0) {
            const currentMargin = ((price - cost) / price) * 100;
            if (currentMargin < killSwitchMargin) {
                activateKillSwitch(
                    `Kar marjı %${currentMargin.toFixed(1)} — %${killSwitchMargin} sınırının altına düştü`,
                    { barcode, price, cost, margin: currentMargin }
                );
                return {
                    action: 'KILL_SWITCH',
                    newPrice: price,
                    reason: `🛑 KILL SWITCH: Marj %${currentMargin.toFixed(1)}. Manuel onay gerekiyor.`,
                    dryRun: false
                };
            }
        }

        // ── If kill switch is globally active ──
        if (killSwitchActive) {
            return {
                action: 'BLOCKED',
                newPrice: price,
                reason: `🛑 Kill Switch aktif: ${killSwitchReason}. resetKillSwitch() ile açın.`,
                dryRun: false
            };
        }

        // ── Price Floor ──
        const minPrice = cost > 0 ? cost * (1 + minMargin / 100) : 0;

        // ── No Competitors? ──
        if (competitors.length === 0) {
            if (strategy === 'aggressive') {
                const newPrice = Math.round(price * 1.10); // +10%
                return {
                    action: 'INCREASE',
                    newPrice,
                    reason: 'Tek satıcısın — %10 artış uygula (elastiklik testi)',
                    dryRun: false
                };
            }
            return {
                action: 'HOLD',
                newPrice: price,
                reason: 'Tek satıcısın — fiyat korunuyor (muhafazakar mod)',
                dryRun: false
            };
        }

        // ── Competitor Analysis ──
        const competitorPrices = competitors.map(c => c.price).filter(p => p > 0);
        const cheapest = Math.min(...competitorPrices);
        const lowStockCount = competitors.filter(c => c.stock !== null && c.stock < 5).length;
        const lowStockRatio = lowStockCount / competitors.length;

        // Rule: Competitors running out of stock → raise price
        if (lowStockRatio >= 0.7) {
            const newPrice = Math.round(price * 1.05);
            return {
                action: 'INCREASE',
                newPrice,
                reason: `Rakiplerin %${Math.round(lowStockRatio * 100)}'i düşük stokta — %5 fiyat artışı`,
                dryRun: false
            };
        }

        // Rule: Be cheaper than cheapest — but respect margin
        let targetPrice = cheapest - 1; // 1 TL cheaper

        if (strategy === 'aggressive') {
            targetPrice = cheapest - 2; // 2 TL cheaper
        } else if (strategy === 'conservative') {
            targetPrice = cheapest; // match, don't undercut
        }

        // Never go below floor
        if (targetPrice < minPrice && minPrice > 0) {
            return {
                action: 'HOLD',
                newPrice: price,
                reason: `Rakip fiyatı (${cheapest} TL) takip edilemiyor — minimum marj %${minMargin} korunamaz.`,
                dryRun: false
            };
        }

        // No change needed
        if (Math.abs(targetPrice - price) < 1) {
            return {
                action: 'HOLD',
                newPrice: price,
                reason: 'Fiyat zaten optimal seviyede',
                dryRun: false
            };
        }

        const action = targetPrice < price ? 'DECREASE' : 'INCREASE';

        return {
            action,
            newPrice: Math.round(targetPrice),
            reason: `Rakip: ${cheapest} TL → Yeni fiyat: ${Math.round(targetPrice)} TL (${action === 'DECREASE' ? 'düşürme' : 'artırma'})`,
            dryRun: false
        };
    }

    /**
     * Execute a pricing decision through the Critical Lane.
     * @param {object} product - Unified product.
     * @param {object} decision - From calculatePrice().
     * @param {function} updateFn - Async function to apply price on platform.
     */
    async executeDecision(product, decision, updateFn) {
        if (decision.action === 'HOLD' || decision.action === 'KILL_SWITCH' || decision.action === 'BLOCKED') {
            this._logDecision(product, decision);
            return decision;
        }

        // Enqueue through Critical Lane for serial execution
        const result = await this.queue.enqueue(
            `Fiyat ${decision.action}: ${product.barcode} → ${decision.newPrice} TL`,
            async () => {
                return await updateFn(product.barcode, decision.newPrice);
            },
            { priority: 'normal', dryRun: decision.dryRun }
        );

        this._logDecision(product, decision, result);
        return { ...decision, result };
    }

    /**
     * Get recent pricing decisions.
     */
    getRecentDecisions(limit = 20) {
        return this.decisions.slice(-limit);
    }

    /**
     * Get engine status.
     */
    getStatus() {
        return {
            rules: this.rules,
            killSwitch: { active: killSwitchActive, reason: killSwitchReason },
            recentDecisions: this.decisions.length,
            queueStatus: this.queue.getStatus()
        };
    }

    // ─────────────────────────────────────────────────────────────────────

    _logDecision(product, decision, result = null) {
        const entry = {
            barcode: product.barcode,
            oldPrice: product.price,
            action: decision.action,
            newPrice: decision.newPrice,
            reason: decision.reason,
            result: result ? { success: result.success } : null,
            timestamp: new Date().toISOString()
        };

        this.decisions.push(entry);
        if (this.decisions.length > 200) {
            this.decisions = this.decisions.slice(-200);
        }

        log('INFO', `Pricing decision: ${decision.action} ${product.barcode}`, entry);
    }
}

let engineInstance = null;

export function getPricingEngine() {
    if (!engineInstance) {
        engineInstance = new PricingEngine();
    }
    return engineInstance;
}

export default PricingEngine;
