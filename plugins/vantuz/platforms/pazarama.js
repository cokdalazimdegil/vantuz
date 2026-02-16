/**
 * 🛒 PAZARAMA API Entegrasyonu  
 * sellers.pazarama.com
 */

import axios from 'axios';
import { requestWithRetry } from './_request.js';

const BASE_URL = 'https://isortagimapi.pazarama.com/api';
const AUTH_URL = 'https://isortagimapi.pazarama.com/oauth/token';

export class PazaramaAPI {
    constructor(config) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async _getAccessToken() {
        if (this.accessToken && this.tokenExpiry > Date.now()) {
            return this.accessToken;
        }

        try {
            const response = await requestWithRetry(axios, {
                method: 'POST',
                url: AUTH_URL,
                data: {
                    grant_type: 'client_credentials',
                    client_id: this.clientId,
                    client_secret: this.clientSecret
                }
            }, {
                retries: 3,
                baseDelayMs: 500,
                maxDelayMs: 4000
            });

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
            return this.accessToken;
        } catch (error) {
            throw new Error('Pazarama token alınamadı: ' + error.message);
        }
    }

    async _request(method, endpoint, data = null, params = null) {
        try {
            const token = await this._getAccessToken();
            const response = await requestWithRetry(axios, {
                method,
                url: `${BASE_URL}${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
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
        const { page = 0, size = 100, code } = params;
        return await this._request('GET', '/products', null, {
            page, size, code
        });
    }

    async createProduct(product) {
        return await this._request('POST', '/products', product);
    }

    async updateProduct(productCode, updates) {
        return await this._request('PUT', `/products/${productCode}`, updates);
    }

    async updatePrice(productCode, salePrice, listPrice = null) {
        return await this._request('PUT', `/products/${productCode}/price`, {
            salePrice,
            listPrice: listPrice || salePrice
        });
    }

    async updateStock(productCode, quantity) {
        return await this._request('PUT', `/products/${productCode}/stock`, {
            quantity
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SİPARİŞ İŞLEMLERİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getOrders(params = {}) {
        const { status, startDate, endDate, page = 0, size = 100 } = params;
        return await this._request('GET', '/orders', null, {
            status, startDate, endDate, page, size
        });
    }

    async getOrderDetail(orderId) {
        return await this._request('GET', `/orders/${orderId}`);
    }

    async approveOrder(orderId) {
        return await this._request('PUT', `/orders/${orderId}/approve`);
    }

    async shipOrder(orderId, trackingNumber, cargoCompany) {
        return await this._request('PUT', `/orders/${orderId}/ship`, {
            trackingNumber,
            cargoCompany
        });
    }

    async cancelOrder(orderId, reason) {
        return await this._request('PUT', `/orders/${orderId}/cancel`, { reason });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // KATEGORİ & MARKA
    // ═══════════════════════════════════════════════════════════════════════════

    async getCategories() {
        return await this._request('GET', '/categories');
    }

    async getCategoryAttributes(categoryId) {
        return await this._request('GET', `/categories/${categoryId}/attributes`);
    }

    async getBrands() {
        return await this._request('GET', '/brands');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER
    // ═══════════════════════════════════════════════════════════════════════════

    async testConnection() {
        try {
            await this._getAccessToken();
            return true;
        } catch {
            return false;
        }
    }

    isConnected() {
        return !!(this.clientId && this.clientSecret);
    }
}

let instance = null;

export const pazaramaApi = {
    init(config) {
        instance = new PazaramaAPI(config);
        return instance;
    },
    getInstance() { return instance; },
    isConnected() { return instance?.isConnected() || false; },

    async getProducts(params) { return instance?.getProducts(params); },
    async updatePrice(code, price) { return instance?.updatePrice(code, price); },
    async updateStock(code, qty) { return instance?.updateStock(code, qty); },
    async getOrders(params) { return instance?.getOrders(params); }
};
