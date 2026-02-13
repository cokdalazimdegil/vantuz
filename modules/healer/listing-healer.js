// modules/healer/listing-healer.js
// Self-Healing Listings for Vantuz OS V2
// Audits product listings and optimizes underperforming ones.

import { log } from '../../core/ai-provider.js';

// ═══════════════════════════════════════════════════════════════════════════
// LISTING HEALTH CHECKS
// ═══════════════════════════════════════════════════════════════════════════

const HEALTH_RULES = [
    {
        name: 'short_title',
        check: (p) => (p.title || '').length < 40,
        severity: 'warning',
        message: 'Başlık çok kısa — SEO performansı düşük',
        fix: 'title_optimization'
    },
    {
        name: 'no_images',
        check: (p) => !p.images || p.images.length === 0,
        severity: 'critical',
        message: 'Ürün görseli yok — satış ihtimali çok düşük',
        fix: 'add_images'
    },
    {
        name: 'few_images',
        check: (p) => p.images && p.images.length > 0 && p.images.length < 3,
        severity: 'warning',
        message: 'Görsel sayısı az — en az 3 görsel önerilir',
        fix: 'add_images'
    },
    {
        name: 'no_brand',
        check: (p) => !p.brand || p.brand.trim() === '',
        severity: 'info',
        message: 'Marka belirtilmemiş',
        fix: 'add_brand'
    },
    {
        name: 'zero_stock',
        check: (p) => p.stock === 0 && p.onSale,
        severity: 'critical',
        message: 'Stok sıfır ama satışta — phantom listing',
        fix: 'deactivate_or_restock'
    },
    {
        name: 'turkish_chars_missing',
        check: (p) => {
            const title = p.title || '';
            // Titles with Turkish words but no Turkish chars might be poorly optimized
            const hasTurkish = /[çğıöşüÇĞİÖŞÜ]/.test(title);
            const looksLatin = /^[a-zA-Z0-9\s\-\+\.\,\/\(\)]+$/.test(title);
            return looksLatin && title.length > 20; // Might be missing Turkish chars
        },
        severity: 'info',
        message: 'Başlıkta Türkçe karakter yok — arama sıralaması düşebilir',
        fix: 'title_optimization'
    },
    {
        name: 'high_price_no_sales',
        check: (p) => p.salesVelocity === 0 && p.margin > 40,
        severity: 'warning',
        message: 'Yüksek marj ama sıfır satış — fiyat çok yüksek olabilir',
        fix: 'price_review'
    }
];

// ═══════════════════════════════════════════════════════════════════════════
// LISTING HEALER
// ═══════════════════════════════════════════════════════════════════════════

class ListingHealer {
    constructor() {
        this.auditResults = [];
        log('INFO', 'ListingHealer initialized');
    }

    /**
     * Audit a single product listing.
     * @param {object} product - Unified product from catalog.
     * @returns {{ barcode, issues: array, score: number }}
     */
    audit(product) {
        const issues = [];

        for (const rule of HEALTH_RULES) {
            try {
                if (rule.check(product)) {
                    issues.push({
                        rule: rule.name,
                        severity: rule.severity,
                        message: rule.message,
                        suggestedFix: rule.fix
                    });
                }
            } catch (e) {
                // Rule check error — skip silently
            }
        }

        // Health score: 100 = perfect
        const penalties = {
            critical: 30,
            warning: 15,
            info: 5
        };
        const totalPenalty = issues.reduce((sum, i) => sum + (penalties[i.severity] || 0), 0);
        const score = Math.max(0, 100 - totalPenalty);

        return {
            barcode: product.barcode || product.sku,
            title: product.title,
            score,
            issues,
            auditedAt: new Date().toISOString()
        };
    }

    /**
     * Audit all products in the catalog.
     * @param {object[]} products - Array of unified products.
     * @returns {{ healthy, warning, critical, results }}
     */
    auditAll(products) {
        const results = products.map(p => this.audit(p));

        const healthy = results.filter(r => r.score >= 80).length;
        const warning = results.filter(r => r.score >= 50 && r.score < 80).length;
        const critical = results.filter(r => r.score < 50).length;

        // Sort by worst first
        results.sort((a, b) => a.score - b.score);

        this.auditResults = results;

        const report = {
            total: results.length,
            healthy,
            warning,
            critical,
            avgScore: results.length > 0
                ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
                : 0,
            worstListings: results.slice(0, 10), // Top 10 worst
            auditedAt: new Date().toISOString()
        };

        log('INFO', 'Listing audit complete', {
            total: report.total,
            healthy,
            warning,
            critical,
            avgScore: report.avgScore
        });

        return report;
    }

    /**
     * Generate AI-powered title suggestions for a product.
     * @param {object} product - Unified product.
     * @param {function} aiChat - AI chat function for generating suggestions.
     * @returns {string} Suggested title.
     */
    async suggestTitle(product, aiChat) {
        if (!aiChat) return product.title;

        const prompt = `Şu ürün başlığını SEO için optimize et. Türkçe arama trendlerine uygun olsun. Mevcut: "${product.title}". Kategori: ${product.category || 'bilinmiyor'}. Sadece optimize edilmiş başlığı yaz, başka bir şey yazma.`;

        try {
            const response = await aiChat(prompt);
            return response.trim();
        } catch (e) {
            log('WARN', 'Title suggestion failed', { error: e.message });
            return product.title;
        }
    }

    getStatus() {
        const results = this.auditResults;
        return {
            lastAuditSize: results.length,
            avgScore: results.length > 0
                ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length)
                : 0,
            criticalCount: results.filter(r => r.score < 50).length
        };
    }
}

let healerInstance = null;

export function getListingHealer() {
    if (!healerInstance) {
        healerInstance = new ListingHealer();
    }
    return healerInstance;
}

export default ListingHealer;
