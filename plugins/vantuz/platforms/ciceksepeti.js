/**
 * 🌸 ÇİÇEKSEPETİ API Entegrasyonu
 * bayi.ciceksepeti.com
 */

import axios from 'axios';
import { requestWithRetry } from './_request.js';

const BASE_URL = 'https://apis.ciceksepeti.com/api/v1';

export class CiceksepetiAPI {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.supplierId = config.supplierId;
    }

    _headers() {
        return {
            'x-api-key': this.apiKey,
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
        const { page = 1, pageSize = 100, stockCode } = params;
        return await this._request('GET', '/products', null, {
            page, pageSize, stockCode
        });
    }

    async getProductByStockCode(stockCode) {
        const result = await this.getProducts({ stockCode });
        if (result.success && result.data.products?.length > 0) {
            return { success: true, data: result.data.products[0] };
        }
        return { success: false, error: 'Ürün bulunamadı' };
    }

    async updateProduct(product) {
        return await this._request('PUT', '/products', {
            items: [product]
        });
    }

    async updatePrice(stockCode, salesPrice, listPrice = null) {
        return await this._request('PUT', '/products/price-and-stock', {
            items: [{
                stockCode,
                salesPrice,
                listPrice: listPrice || salesPrice
            }]
        });
    }

    async updateStock(stockCode, stockQuantity) {
        return await this._request('PUT', '/products/price-and-stock', {
            items: [{
                stockCode,
                stockQuantity
            }]
        });
    }

    async bulkUpdate(items) {
        // items: [{ stockCode, salesPrice?, stockQuantity? }]
        return await this._request('PUT', '/products/price-and-stock', { items });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SİPARİŞ İŞLEMLERİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getOrders(params = {}) {
        const {
            startDate,
            endDate,
            page = 1,
            pageSize = 100,
            orderStatus // 1: Yeni, 2: Hazırlanıyor, 3: Kargoda, 4: Teslim
        } = params;

        return await this._request('GET', '/orders', null, {
            startDate, endDate, page, pageSize, orderStatus
        });
    }

    async getOrderDetail(orderId) {
        return await this._request('GET', `/orders/${orderId}`);
    }

    async updateOrderStatus(orderId, status, trackingNumber = null) {
        const data = { orderStatus: status };
        if (trackingNumber) {
            data.cargoTrackingNumber = trackingNumber;
        }
        return await this._request('PUT', `/orders/${orderId}`, data);
    }

    async shipOrder(orderId, trackingNumber, cargoCompanyId = 1) {
        return await this._request('PUT', `/orders/${orderId}/ship`, {
            cargoCompanyId,
            cargoTrackingNumber: trackingNumber
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // KATEGORİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getCategories() {
        return await this._request('GET', '/categories');
    }

    async getCategoryAttributes(categoryId) {
        return await this._request('GET', `/categories/${categoryId}/attributes`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // KARGO
    // ═══════════════════════════════════════════════════════════════════════════

    async getCargoCompanies() {
        return await this._request('GET', '/cargo-companies');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER
    // ═══════════════════════════════════════════════════════════════════════════

    async testConnection() {
        const result = await this.getProducts({ page: 1, pageSize: 1 });
        return result.success;
    }

    isConnected() {
        return !!(this.apiKey);
    }
}

let instance = null;

export const ciceksepetiApi = {
    init(config) {
        instance = new CiceksepetiAPI(config);
        return instance;
    },
    getInstance() { return instance; },
    isConnected() { return instance?.isConnected() || false; },

    async getProducts(params) { return instance?.getProducts(params); },
    async updatePrice(code, price) { return instance?.updatePrice(code, price); },
    async updateStock(code, qty) { return instance?.updateStock(code, qty); },
    async getOrders(params) { return instance?.getOrders(params); }
};
