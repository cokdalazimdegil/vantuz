// core/unified-product.js
// Unified Product Model for Vantuz OS V2
// Normalizes product data from ALL platforms into one Vantuz format.

import { log } from './ai-provider.js';

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED PRODUCT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a Unified Product from raw platform data.
 * @param {object} raw - Raw product data from any platform API.
 * @param {string} platform - Source platform name.
 * @returns {object} Unified Product.
 */
export function normalizeProduct(raw, platform) {
    const normalized = {
        // Identity
        sku: raw.sku || raw.stockCode || raw.merchantSku || raw.productCode || null,
        barcode: raw.barcode || raw.barcodes?.[0] || raw.gtin || null,
        title: raw.title || raw.productName || raw.name || '',
        brand: raw.brand || raw.brandName || '',
        category: raw.category || raw.categoryName || '',

        // Pricing
        price: parseFloat(raw.salePrice || raw.price || raw.listingPrice || 0),
        listPrice: parseFloat(raw.listPrice || raw.marketPrice || raw.originalPrice || 0),
        cost: parseFloat(raw.cost || raw.costPrice || 0),
        currency: raw.currency || 'TRY',

        // Stock
        stock: parseInt(raw.quantity || raw.stock || raw.stockQuantity || 0, 10),

        // Images
        images: raw.images || raw.imageUrls || (raw.imageUrl ? [raw.imageUrl] : []),

        // Status
        onSale: raw.onSale ?? raw.approved ?? raw.active ?? true,

        // Platform-specific data
        platforms: {
            [platform]: {
                id: raw.id || raw.productId || raw.contentId || null,
                url: raw.url || raw.productUrl || null,
                lastSync: new Date().toISOString(),
                raw: raw  // Keep original for debugging
            }
        },

        // Analytics (populated by other modules)
        competitors: [],
        salesVelocity: 0,       // units/day — filled by Oracle
        margin: 0,              // calculated below
        stockoutDate: null,     // filled by Oracle
        sentimentScore: null,   // filled by CRM

        // Meta
        _source: platform,
        _normalizedAt: new Date().toISOString()
    };

    // Calculate margin
    if (normalized.cost > 0 && normalized.price > 0) {
        normalized.margin = ((normalized.price - normalized.cost) / normalized.price) * 100;
    }

    return normalized;
}

/**
 * Merge a new platform occurrence into an existing unified product.
 * (Same barcode, different platform.)
 * @param {object} existing - Existing unified product.
 * @param {object} raw - New raw data.
 * @param {string} platform - Source platform.
 * @returns {object} Merged product.
 */
export function mergeProduct(existing, raw, platform) {
    const incoming = normalizeProduct(raw, platform);

    // Add to platforms map
    existing.platforms[platform] = incoming.platforms[platform];

    // Use the lowest price as the "effective" price
    if (incoming.price > 0 && (incoming.price < existing.price || existing.price === 0)) {
        existing.price = incoming.price;
    }

    // Sum stock across platforms
    existing.stock = Object.values(existing.platforms).reduce((sum, p) => {
        const pStock = parseInt(p.raw?.quantity || p.raw?.stock || 0, 10);
        return sum + pStock;
    }, 0);

    // Use best title (longest, usually most SEO-friendly)
    if (incoming.title.length > existing.title.length) {
        existing.title = incoming.title;
    }

    // Merge images (unique)
    const allImages = [...(existing.images || []), ...(incoming.images || [])];
    existing.images = [...new Set(allImages)];

    // Recalculate margin
    if (existing.cost > 0 && existing.price > 0) {
        existing.margin = ((existing.price - existing.cost) / existing.price) * 100;
    }

    return existing;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT CATALOG (In-Memory + Disk)
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import os from 'os';

const CATALOG_FILE = path.join(os.homedir(), '.vantuz', 'memory', 'catalog.json');

class ProductCatalog {
    constructor() {
        this.products = new Map(); // barcode -> UnifiedProduct
        this._load();
    }

    _load() {
        try {
            if (fs.existsSync(CATALOG_FILE)) {
                const data = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf-8'));
                for (const [barcode, product] of Object.entries(data)) {
                    this.products.set(barcode, product);
                }
                log('INFO', `Product catalog loaded`, { count: this.products.size });
            }
        } catch (e) {
            log('WARN', 'Catalog load failed', { error: e.message });
        }
    }

    _save() {
        const dir = path.dirname(CATALOG_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const obj = Object.fromEntries(this.products);
        const tmp = CATALOG_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf-8');
        fs.renameSync(tmp, CATALOG_FILE);
    }

    /**
     * Ingest raw product data from a platform.
     */
    ingest(rawProducts, platform) {
        let added = 0, updated = 0;

        for (const raw of rawProducts) {
            const barcode = raw.barcode || raw.barcodes?.[0] || raw.gtin;
            if (!barcode) continue;

            if (this.products.has(barcode)) {
                mergeProduct(this.products.get(barcode), raw, platform);
                updated++;
            } else {
                this.products.set(barcode, normalizeProduct(raw, platform));
                added++;
            }
        }

        this._save();
        log('INFO', `Catalog ingested from ${platform}`, { added, updated, total: this.products.size });
        return { added, updated, total: this.products.size };
    }

    get(barcode) {
        return this.products.get(barcode) || null;
    }

    getAll() {
        return [...this.products.values()];
    }

    /**
     * Find products that are low on stock.
     * @param {number} threshold - Min stock threshold (default: 5).
     */
    getLowStock(threshold = 5) {
        return this.getAll().filter(p => p.stock > 0 && p.stock <= threshold);
    }

    /**
     * Find products below target margin.
     * @param {number} minMargin - Minimum margin % (default: 15).
     */
    getLowMargin(minMargin = 15) {
        return this.getAll().filter(p => p.margin > 0 && p.margin < minMargin);
    }

    get size() {
        return this.products.size;
    }
}

let catalogInstance = null;

export function getCatalog() {
    if (!catalogInstance) {
        catalogInstance = new ProductCatalog();
    }
    return catalogInstance;
}

export default ProductCatalog;
