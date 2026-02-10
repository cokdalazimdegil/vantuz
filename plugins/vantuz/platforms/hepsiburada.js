/**
 * 🟣 HEPSİBURADA API Entegrasyonu
 * developer.hepsiburada.com
 */

import axios from 'axios';
import { requestWithRetry } from './_request.js';

const BASE_URL = 'https://mpop-sit.hepsiburada.com'; // Production: mpop.hepsiburada.com
const LISTING_URL = 'https://listing-external.hepsiburada.com';

export class HepsiburadaAPI {
    constructor(config) {
        this.merchantId = config.merchantId;
        this.username = config.username;
        this.password = config.password;

        this.auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    }

    _headers() {
        return {
            'Authorization': `Basic ${this.auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    async _request(method, url, data = null, params = null) {
        try {
            const response = await requestWithRetry(axios, {
                method,
                url,
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
        const { page = 0, size = 100, sku } = params;
        return await this._request('GET',
            `${LISTING_URL}/Listings/merchantid/${this.merchantId}`,
            null, { page, size, merchantSku: sku }
        );
    }

    async createProduct(product) {
        // product: { merchantSku, hepsiburadaSku, price, availableStock, ... }
        return await this._request('POST',
            `${LISTING_URL}/Listings/merchantid/${this.merchantId}/sku/${product.hepsiburadaSku}`,
            product
        );
    }

    async updatePrice(merchantSku, price) {
        return await this._request('POST',
            `${LISTING_URL}/Listings/merchantid/${this.merchantId}`,
            {
                listings: [{
                    merchantSku,
                    price,
                    currency: 'TRY'
                }]
            }
        );
    }

    async updateStock(merchantSku, stock) {
        return await this._request('POST',
            `${LISTING_URL}/Listings/merchantid/${this.merchantId}`,
            {
                listings: [{
                    merchantSku,
                    availableStock: stock
                }]
            }
        );
    }

    async bulkUpdate(listings) {
        // listings: [{ merchantSku, price?, availableStock? }]
        return await this._request('POST',
            `${LISTING_URL}/Listings/merchantid/${this.merchantId}`,
            { listings }
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SİPARİŞ İŞLEMLERİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getOrders(params = {}) {
        const {
            status, // Open, Shipped, Delivered, Cancelled
            startDate,
            endDate,
            page = 0,
            size = 50
        } = params;

        return await this._request('GET',
            `${BASE_URL}/orders/merchantid/${this.merchantId}`,
            null, { status, startDate, endDate, page, size }
        );
    }

    async getOrderDetail(orderId) {
        return await this._request('GET',
            `${BASE_URL}/orders/merchantid/${this.merchantId}/id/${orderId}`
        );
    }

    async confirmOrder(orderId) {
        return await this._request('PUT',
            `${BASE_URL}/orders/merchantid/${this.merchantId}/id/${orderId}/confirm`
        );
    }

    async shipOrder(orderId, trackingNumber, cargoCompany) {
        return await this._request('PUT',
            `${BASE_URL}/orders/merchantid/${this.merchantId}/id/${orderId}/ship`,
            {
                trackingNumber,
                cargoCompany
            }
        );
    }

    async cancelOrder(orderId, reason) {
        return await this._request('PUT',
            `${BASE_URL}/orders/merchantid/${this.merchantId}/id/${orderId}/cancel`,
            { reason }
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // KATEGORİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getCategories() {
        return await this._request('GET', `${LISTING_URL}/categories/get-all-categories`);
    }

    async getCategoryAttributes(categoryId) {
        return await this._request('GET',
            `${LISTING_URL}/product-attributes/category/${categoryId}`
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER
    // ═══════════════════════════════════════════════════════════════════════════

    async testConnection() {
        const result = await this.getProducts({ page: 0, size: 1 });
        return result.success;
    }

    isConnected() {
        return !!(this.merchantId && this.username && this.password);
    }
}

let instance = null;

export const hepsiburadaApi = {
    init(config) {
        instance = new HepsiburadaAPI(config);
        return instance;
    },
    getInstance() { return instance; },
    isConnected() { return instance?.isConnected() || false; },

    async getProducts(params) { return instance?.getProducts(params); },
    async updatePrice(sku, price) { return instance?.updatePrice(sku, price); },
    async updateStock(sku, qty) { return instance?.updateStock(sku, qty); },
    async getOrders(params) { return instance?.getOrders(params); }
};
