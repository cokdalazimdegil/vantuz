// core/marketplace-adapter.js
// Formal MarketplaceAdapter Interface for Vantuz OS V2
// Validates that any platform plugin implements required methods.

import { log } from './ai-provider.js';

// ═══════════════════════════════════════════════════════════════════════════
// REQUIRED METHODS DEFINITION
// ═══════════════════════════════════════════════════════════════════════════

const REQUIRED_METHODS = [
    'testConnection',    // () => Promise<boolean>
    'isConnected',       // () => boolean
    'getProducts',       // (params) => Promise<{success, data}>
    'getOrders',         // (params) => Promise<{success, data}>
    'updateStock',       // (barcode, qty) => Promise<{success}>
    'updatePrice',       // (barcode, price) => Promise<{success}>
];

const OPTIONAL_METHODS = [
    'getCompetitorPrices',  // (barcode) => Promise<{success, data: [{seller, price, stock}]}>
    'getCategories',        // () => Promise<{success, data}>
    'getReviews',           // (productId) => Promise<{success, data}>
    'getProductByBarcode',  // (barcode) => Promise<{success, data}>
];

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTER VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate that a platform adapter implements all required methods.
 * @param {string} name - Platform name (e.g., 'trendyol')
 * @param {object} adapter - Adapter instance or export object
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateAdapter(name, adapter) {
    const missing = [];

    for (const method of REQUIRED_METHODS) {
        if (typeof adapter[method] !== 'function') {
            missing.push(method);
        }
    }

    const valid = missing.length === 0;

    if (!valid) {
        log('ERROR', `Adapter "${name}" eksik metodlar`, { missing });
    } else {
        log('INFO', `Adapter "${name}" geçerli ✓`);
    }

    return { valid, missing };
}

/**
 * Check which optional capabilities an adapter supports.
 * @param {object} adapter
 * @returns {string[]} List of supported optional method names.
 */
export function getAdapterCapabilities(adapter) {
    return OPTIONAL_METHODS.filter(m => typeof adapter[m] === 'function');
}

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTER REGISTRY (Dynamic Plugin System)
// ═══════════════════════════════════════════════════════════════════════════

class AdapterRegistry {
    constructor() {
        this.adapters = new Map(); // name -> { adapter, capabilities, valid }
    }

    /**
     * Register a platform adapter.
     * @param {string} name - Platform name.
     * @param {object} adapter - Adapter instance or factory export.
     */
    register(name, adapter) {
        const { valid, missing } = validateAdapter(name, adapter);

        if (!valid) {
            log('WARN', `Adapter "${name}" kayıtlı ama eksik metodları var`, { missing });
        }

        const capabilities = getAdapterCapabilities(adapter);

        this.adapters.set(name.toLowerCase(), {
            adapter,
            capabilities,
            valid,
            missing,
            registeredAt: new Date().toISOString()
        });

        log('INFO', `Adapter registered: ${name}`, { capabilities, valid });
    }

    /**
     * Get a registered adapter by name.
     */
    get(name) {
        const entry = this.adapters.get(name.toLowerCase());
        return entry?.adapter || null;
    }

    /**
     * List all registered adapters with their status.
     */
    list() {
        const result = [];
        for (const [name, entry] of this.adapters) {
            result.push({
                name,
                valid: entry.valid,
                capabilities: entry.capabilities,
                connected: entry.adapter.isConnected?.() || false,
                missing: entry.missing
            });
        }
        return result;
    }

    /**
     * Get all connected and valid adapters.
     */
    getActive() {
        return this.list().filter(a => a.valid && a.connected);
    }

    /**
     * Execute a method across all active adapters.
     * @param {string} method - Method name.
     * @param  {...any} args - Arguments.
     * @returns {Promise<Map<string, any>>} Results keyed by platform name.
     */
    async broadcast(method, ...args) {
        const results = new Map();
        const active = this.getActive();

        for (const entry of active) {
            const adapter = this.get(entry.name);
            if (typeof adapter[method] === 'function') {
                try {
                    results.set(entry.name, await adapter[method](...args));
                } catch (e) {
                    results.set(entry.name, { success: false, error: e.message });
                    log('ERROR', `Broadcast ${method} failed on ${entry.name}`, { error: e.message });
                }
            }
        }

        return results;
    }
}

// Singleton
let registryInstance = null;

export function getAdapterRegistry() {
    if (!registryInstance) {
        registryInstance = new AdapterRegistry();
    }
    return registryInstance;
}

export default AdapterRegistry;
