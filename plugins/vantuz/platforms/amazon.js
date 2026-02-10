/**
 * 🟡 AMAZON SP-API Entegrasyonu
 * developer-docs.amazon.com/sp-api
 */

import axios from 'axios';
import crypto from 'crypto';
import { requestWithRetry } from './_request.js';

const REGIONS = {
    eu: {
        endpoint: 'https://sellingpartnerapi-eu.amazon.com',
        marketplace: 'A1PA6795UKMFR9' // DE
    },
    na: {
        endpoint: 'https://sellingpartnerapi-na.amazon.com',
        marketplace: 'ATVPDKIKX0DER' // US
    },
    tr: {
        endpoint: 'https://sellingpartnerapi-eu.amazon.com',
        marketplace: 'A33AVAJ2PDY3EV' // TR
    }
};

export class AmazonAPI {
    constructor(config) {
        this.region = config.region || 'eu';
        this.sellerId = config.sellerId;
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.refreshToken = config.refreshToken;

        this.regionConfig = REGIONS[this.region];
        this.accessToken = null;
        this.tokenExpiry = null;
        this._tokenPromise = null;
    }

    async _getAccessToken() {
        if (this.accessToken && this.tokenExpiry > Date.now()) {
            return this.accessToken;
        }
        if (this._tokenPromise) {
            return await this._tokenPromise;
        }

        this._tokenPromise = (async () => {
            try {
                const response = await requestWithRetry(axios, {
                    method: 'POST',
                    url: 'https://api.amazon.com/auth/o2/token',
                    data: {
                        grant_type: 'refresh_token',
                        refresh_token: this.refreshToken,
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
                throw new Error('Token alınamadı: ' + error.message);
            } finally {
                this._tokenPromise = null;
            }
        })();

        return await this._tokenPromise;
    }

    async _request(method, path, data = null, params = null) {
        try {
            const token = await this._getAccessToken();
            const response = await requestWithRetry(axios, {
                method,
                url: `${this.regionConfig.endpoint}${path}`,
                headers: {
                    'x-amz-access-token': token,
                    'Content-Type': 'application/json'
                },
                data,
                params: {
                    ...params,
                    MarketplaceIds: this.regionConfig.marketplace
                }
            }, {
                retries: 3,
                baseDelayMs: 500,
                maxDelayMs: 4000
            });
            return { success: true, data: response.data };
        } catch (error) {
            return {
                success: false,
                error: error.response?.data?.errors || error.message
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ÜRÜN İŞLEMLERİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getInventory(params = {}) {
        const { nextToken, skus } = params;
        return await this._request('GET', '/fba/inventory/v1/summaries', null, {
            details: true,
            granularityType: 'Marketplace',
            granularityId: this.regionConfig.marketplace,
            sellerSkus: skus?.join(','),
            nextToken
        });
    }

    async getCatalogItem(asin) {
        return await this._request('GET', `/catalog/2022-04-01/items/${asin}`, null, {
            includedData: 'summaries,attributes,images,productTypes,salesRanks'
        });
    }

    async searchCatalog(keywords) {
        return await this._request('GET', '/catalog/2022-04-01/items', null, {
            keywords,
            includedData: 'summaries,images'
        });
    }

    async createListing(sku, productType, attributes) {
        return await this._request('PUT', `/listings/2021-08-01/items/${this.sellerId}/${sku}`, {
            productType,
            attributes,
            requirements: 'LISTING'
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FİYAT
    // ═══════════════════════════════════════════════════════════════════════════

    async getPricing(skus) {
        return await this._request('GET', '/products/pricing/v0/price', null, {
            ItemType: 'Sku',
            Skus: skus.join(',')
        });
    }

    async getCompetitivePricing(asins) {
        return await this._request('GET', '/products/pricing/v0/competitivePrice', null, {
            ItemType: 'Asin',
            Asins: asins.join(',')
        });
    }

    async updatePrice(sku, price, currency = 'EUR') {
        // SP-API için feed sistemi gerekir - basitleştirilmiş örnek
        const feed = {
            header: { sellerId: this.sellerId, version: '2.0' },
            messages: [{
                messageId: 1,
                sku,
                operationType: 'PARTIAL_UPDATE',
                productType: 'PRODUCT',
                attributes: {
                    purchasable_offer: [{
                        our_price: [{ schedule: [{ value_with_tax: price }] }],
                        currency
                    }]
                }
            }]
        };
        return await this._request('POST', '/feeds/2021-06-30/feeds', {
            feedType: 'JSON_LISTINGS_FEED',
            marketplaceIds: [this.regionConfig.marketplace]
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SİPARİŞ
    // ═══════════════════════════════════════════════════════════════════════════

    async getOrders(params = {}) {
        const { createdAfter, orderStatuses, nextToken } = params;
        return await this._request('GET', '/orders/v0/orders', null, {
            CreatedAfter: createdAfter || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            OrderStatuses: orderStatuses?.join(','),
            NextToken: nextToken
        });
    }

    async getOrderItems(orderId) {
        return await this._request('GET', `/orders/v0/orders/${orderId}/orderItems`);
    }

    async confirmShipment(orderId, items) {
        return await this._request('POST', `/orders/v0/orders/${orderId}/shipmentConfirmation`, {
            packageDetail: {
                packageReferenceId: `pkg-${Date.now()}`,
                carrierCode: 'OTHER',
                shippingMethod: 'Standard',
                trackingNumber: items.trackingNumber,
                shipFromSupplySourceId: this.sellerId
            },
            codCollectionMethod: 'DirectPayment',
            marketplaceId: this.regionConfig.marketplace
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FBA
    // ═══════════════════════════════════════════════════════════════════════════

    async getFbaInventory(params = {}) {
        return await this._request('GET', '/fba/inventory/v1/summaries', null, {
            details: true,
            granularityType: 'Marketplace',
            granularityId: this.regionConfig.marketplace,
            ...params
        });
    }

    async getInboundShipments(params = {}) {
        return await this._request('GET', '/fba/inbound/v0/shipments', null, params);
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
        return !!(this.sellerId && this.clientId && this.refreshToken);
    }
}

let instances = {};

export const amazonApi = {
    init(config, region = 'eu') {
        instances[region] = new AmazonAPI({ ...config, region });
        return instances[region];
    },
    getInstance(region = 'eu') { return instances[region]; },
    isConnected(region = 'eu') { return instances[region]?.isConnected() || false; },

    async getProducts(params, region) { return instances[region]?.getInventory(params); },
    async updatePrice(sku, price, region) { return instances[region]?.updatePrice(sku, price); },
    async getOrders(params, region) { return instances[region]?.getOrders(params); }
};

