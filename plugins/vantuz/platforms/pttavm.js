/**
 * 📮 PTTavm API Entegrasyonu
 * pttavm.com/entegrasyon
 */

import axios from 'axios';
import { requestWithRetry } from './_request.js';

const BASE_URL = 'https://api.pttavm.com/v1';

export class PttavmAPI {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.token = config.token;
        this.shopId = config.shopId;
    }

    _headers() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json'
        };
    }

    async _request(method, endpoint, data = null, params = null) {
        try {
            const response = await requestWithRetry(axios, {
                method,
                url: `${BASE_URL}${endpoint}`,
                headers: this._headers(),
                data,
                params
            }, {
                retries: 3,
                baseDelayMs: 500,
                maxDelayMs: 4000
            });
            return { success: true, data: response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data || error.message
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ÜRÜN İŞLEMLERİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getProducts(params = {}) {
        const { page = 1, limit = 100, barcode } = params;
        return await this._request('GET', '/products', null, {
            page, limit, barcode
        });
    }

    async createProduct(product) {
        return await this._request('POST', '/products', product);
    }

    async updateProduct(productId, updates) {
        return await this._request('PUT', `/products/${productId}`, updates);
    }

    async updatePrice(barcode, price) {
        return await this._request('PUT', '/products/price', {
            items: [{ barcode, salePrice: price }]
        });
    }

    async updateStock(barcode, quantity) {
        return await this._request('PUT', '/products/stock', {
            items: [{ barcode, quantity }]
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SİPARİŞ İŞLEMLERİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getOrders(params = {}) {
        const { status, startDate, endDate, page = 1, limit = 100 } = params;
        return await this._request('GET', '/orders', null, {
            status, startDate, endDate, page, limit
        });
    }

    async getOrderDetail(orderId) {
        return await this._request('GET', `/orders/${orderId}`);
    }

    async updateOrderStatus(orderId, status) {
        return await this._request('PUT', `/orders/${orderId}/status`, { status });
    }

    async shipOrder(orderId, trackingNumber) {
        return await this._request('PUT', `/orders/${orderId}/ship`, {
            trackingNumber,
            cargoCompany: 'PTT'
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // KATEGORİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getCategories() {
        return await this._request('GET', '/categories');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER
    // ═══════════════════════════════════════════════════════════════════════════

    async testConnection() {
        const result = await this.getProducts({ page: 1, limit: 1 });
        return result.success;
    }

    isConnected() {
        return !!(this.apiKey && this.token);
    }
}

let instance = null;

export const pttavmApi = {
    init(config) {
        instance = new PttavmAPI(config);
        return instance;
    },
    getInstance() { return instance; },
    isConnected() { return instance?.isConnected() || false; },

    async getProducts(params) { return instance?.getProducts(params); },
    async updatePrice(code, price) { return instance?.updatePrice(code, price); },
    async updateStock(code, qty) { return instance?.updateStock(code, qty); },
    async getOrders(params) { return instance?.getOrders(params); }
};
