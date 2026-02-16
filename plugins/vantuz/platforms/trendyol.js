/**
 * 🟠 TRENDYOL API v2 Entegrasyonu
 * developers.trendyol.com/v2.0
 * 
 * Base URL: https://apigw.trendyol.com/integration
 * Auth: Basic (API Key:API Secret → Base64)
 * User-Agent: {SellerId} - SelfIntegration
 * Rate Limit: 50 req / 10 sec per endpoint
 */

import axios from 'axios';
import { log } from '../../../core/ai-provider.js';
import { requestWithRetry } from './_request.js';

const BASE_URL = 'https://apigw.trendyol.com/integration';
const STAGE_URL = 'https://stageapigw.trendyol.com/integration';

export class TrendyolAPI {
    constructor(config) {
        this.supplierId = config.supplierId;
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.isStage = config.isStage || false;

        this.baseUrl = this.isStage ? STAGE_URL : BASE_URL;
        this.auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');

        // DEBUG: Interceptor to see what's actually being sent
        this.client = axios.create();
        this.client.interceptors.request.use(request => {
            log('DEBUG', '[Axios Final Request]', {
                url: request.url,
                method: request.method,
                headers: request.headers
            });
            return request;
        });
    }

    _headers() {
        const headers = {
            'Authorization': `Basic ${this.auth}`,
            // 'Content-Type': 'application/json', // REMOVED: Managed in _request
            'User-Agent': `${this.supplierId} - SelfIntegration`,
            'X-Correlation-Id': `${this.supplierId}-${Date.now()}`
        };
        return headers;
    }

    async _request(method, endpoint, data = null, params = null) {
        try {
            const url = `${this.baseUrl}${endpoint}`;
            log('DEBUG', `[Trendyol] ${method} ${url}`);

            const headers = this._headers();
            if (method === 'POST' || method === 'PUT') {
                headers['Content-Type'] = 'application/json';
            }

            const response = await requestWithRetry(this.client, {
                method,
                url,
                headers,
                data,
                params,
                timeout: 30000
            }, {
                retries: 3,
                baseDelayMs: 500,
                maxDelayMs: 4000
            });
            return { success: true, data: response.data };
        } catch (error) {
            const errorMsg = error.response?.data?.errors?.[0]?.message || error.message;
            const statusCode = error.response?.status;

            console.error(`[Trendyol] API Hatası (${statusCode}): ${errorMsg}`);
            if (error.response?.data) {
                try {
                    const dataStr = typeof error.response.data === 'string'
                        ? error.response.data.substring(0, 200)
                        : JSON.stringify(error.response.data).substring(0, 200);
                    console.error('[Trendyol] Hata Detayı:', dataStr);
                } catch (e) { }
            }

            return {
                success: false,
                error: errorMsg,
                status: statusCode
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ÜRÜN İŞLEMLERİ
    // Prefix: /product/sellers/{sellerId}/...
    // ═══════════════════════════════════════════════════════════════════════════

    async getProducts(params = {}) {
        const { page = 0, size = 50, barcode, approved, onSale, date } = params;
        return await this._request('GET', `/product/sellers/${this.supplierId}/products`, null, {
            page, size, barcode, approved, onSale, date
        });
    }

    async getProductByBarcode(barcode) {
        const result = await this.getProducts({ barcode });
        if (result.success && result.data.content?.length > 0) {
            return { success: true, data: result.data.content[0] };
        }
        return { success: false, error: 'Ürün bulunamadı' };
    }

    async createProducts(products) {
        // items: [{ barcode, title, productMainId, brandId, categoryId, ... }]
        return await this._request('POST', `/product/sellers/${this.supplierId}/v2/products`, { items: products });
    }

    async updateProducts(products) {
        return await this._request('PUT', `/product/sellers/${this.supplierId}/v2/products`, { items: products });
    }

    async deleteProducts(barcodes) {
        const items = barcodes.map(barcode => ({ barcode }));
        return await this._request('DELETE', `/product/sellers/${this.supplierId}/products`, { items });
    }

    async getBatchRequestResult(batchRequestId) {
        return await this._request('GET', `/product/sellers/${this.supplierId}/products/batch-requests/${batchRequestId}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FİYAT & STOK
    // ═══════════════════════════════════════════════════════════════════════════

    async updatePriceAndStock(items) {
        // items: [{ barcode, quantity, salePrice, listPrice }]
        return await this._request('POST', `/product/sellers/${this.supplierId}/products/price-and-inventory`, { items });
    }

    async updatePrice(barcode, salePrice, listPrice = null) {
        return await this.updatePriceAndStock([{
            barcode,
            salePrice,
            listPrice: listPrice || salePrice
        }]);
    }

    async updateStock(barcode, quantity) {
        return await this.updatePriceAndStock([{ barcode, quantity }]);
    }

    async bulkPriceUpdate(updates) {
        // updates: [{ barcode, price, listPrice? }]
        const items = updates.map(u => ({
            barcode: u.barcode,
            salePrice: u.price,
            listPrice: u.listPrice || u.price
        }));
        return await this.updatePriceAndStock(items);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SİPARİŞ İŞLEMLERİ
    // Prefix: /order/sellers/{sellerId}/...
    // ═══════════════════════════════════════════════════════════════════════════

    async getOrders(params = {}) {
        const {
            status,
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime(),
            endDate = Date.now(),
            page = 0,
            size = 50,
            orderNumber
        } = params;

        return await this._request('GET', `/order/sellers/${this.supplierId}/orders`, null, {
            status, startDate, endDate, page, size, orderNumber,
            orderByDirection: 'DESC',
            orderByField: 'PackageLastModifiedDate'
        });
    }

    async getOrderByNumber(orderNumber) {
        const result = await this.getOrders({ orderNumber });
        if (result.success && result.data.content?.length > 0) {
            return { success: true, data: result.data.content[0] };
        }
        return { success: false, error: 'Sipariş bulunamadı' };
    }

    async updateOrderStatus(lines, status, params = {}) {
        const endpoint = `/order/sellers/${this.supplierId}/shipment-packages`;

        if (status === 'Picking') {
            return await this._request('PUT', endpoint, { lines, status: 'Picking' });
        } else if (status === 'Invoiced') {
            return await this._request('PUT', endpoint, {
                lines,
                status: 'Invoiced',
                invoiceNumber: params.invoiceNumber
            });
        }

        return { success: false, error: 'Geçersiz durum' };
    }

    async shipOrder(shipmentPackageId, trackingNumber, cargoKey = 'YURTICI') {
        return await this._request('PUT',
            `/order/sellers/${this.supplierId}/shipment-packages/${shipmentPackageId}`,
            {
                trackingNumber,
                cargoProviderCode: cargoKey,
                status: 'Shipped'
            }
        );
    }

    async getShipmentProviders() {
        return await this._request('GET', '/shipment-providers');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // KATEGORİ & MARKA
    // Prefix: /product/...
    // ═══════════════════════════════════════════════════════════════════════════

    async getCategories() {
        return await this._request('GET', '/product/product-categories');
    }

    async getCategoryAttributes(categoryId) {
        return await this._request('GET', `/product/product-categories/${categoryId}/attributes`);
    }

    async searchBrands(name) {
        return await this._request('GET', '/product/brands', null, { name });
    }

    async getBrandsByCategory(categoryId) {
        return await this._request('GET', `/product/product-categories/${categoryId}/brands`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADRES BİLGİLERİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getAddresses() {
        return await this._request('GET', `/sellers/${this.supplierId}/addresses`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RAKİP ANALİZİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getCompetitorPrices(barcode) {
        try {
            return {
                success: true,
                competitors: [],
                message: 'Rakip analizi için web_search tool kullanın'
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SORU & CEVAP
    // ═══════════════════════════════════════════════════════════════════════════

    async getQuestions(params = {}) {
        const { status = 'WAITING_FOR_ANSWER', page = 0, size = 50 } = params;
        return await this._request('GET', `/order/sellers/${this.supplierId}/questions/filter`, null, {
            status, page, size
        });
    }

    async answerQuestion(questionId, answer) {
        return await this._request('POST', `/order/sellers/${this.supplierId}/questions/${questionId}/answers`, {
            text: answer
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // YARDIMCI METODLAR
    // ═══════════════════════════════════════════════════════════════════════════

    async testConnection() {
        const result = await this.getProducts({ page: 0, size: 1 });
        return result.success;
    }

    isConnected() {
        return !!(this.supplierId && this.apiKey && this.apiSecret);
    }

    formatProduct(raw) {
        return {
            id: raw.id,
            barcode: raw.barcode,
            title: raw.title,
            brand: raw.brand,
            category: raw.categoryName,
            price: raw.salePrice,
            listPrice: raw.listPrice,
            stock: raw.quantity,
            images: raw.images?.map(i => i.url) || [],
            approved: raw.approved,
            onSale: raw.onSale,
            url: `https://www.trendyol.com/p/-p-${raw.id}`
        };
    }
}

// Singleton instance
let instance = null;

export const trendyolApi = {
    init(config) {
        instance = new TrendyolAPI(config);
        return instance;
    },

    getInstance() {
        return instance;
    },

    isConnected() {
        return instance?.isConnected() || false;
    },

    // Proxy methods
    async getProducts(params) { return instance?.getProducts(params); },
    async updatePrice(barcode, price) { return instance?.updatePrice(barcode, price); },
    async updateStock(barcode, qty) { return instance?.updateStock(barcode, qty); },
    async getOrders(params) { return instance?.getOrders(params); },
    async getCompetitors(barcode) { return instance?.getCompetitorPrices(barcode); },
    async testConnection() { return instance?.testConnection(); }
};
