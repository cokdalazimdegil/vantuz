/**
 * 🔵 N11 SOAP API Entegrasyonu
 * api.n11.com/ws/*.wsdl
 */

import axios from 'axios';
import { parseStringPromise, Builder } from 'xml2js';
import { requestWithRetry } from './_request.js';

const WSDL_URLS = {
    product: 'https://api.n11.com/ws/ProductService.wsdl',
    order: 'https://api.n11.com/ws/OrderService.wsdl',
    shipment: 'https://api.n11.com/ws/ShipmentService.wsdl',
    category: 'https://api.n11.com/ws/CategoryService.wsdl',
    city: 'https://api.n11.com/ws/CityService.wsdl'
};

const SOAP_ENDPOINTS = {
    product: 'https://api.n11.com/ws/ProductService',
    order: 'https://api.n11.com/ws/OrderService',
    shipment: 'https://api.n11.com/ws/ShipmentService',
    category: 'https://api.n11.com/ws/CategoryService'
};

export class N11API {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
    }

    _buildSoapEnvelope(service, method, body) {
        const auth = `
      <auth>
        <appKey>${this.apiKey}</appKey>
        <appSecret>${this.apiSecret}</appSecret>
      </auth>
    `;

        return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" 
                   xmlns:ns1="http://www.n11.com/ws/schemas">
  <SOAP-ENV:Body>
    <ns1:${method}Request>
      ${auth}
      ${body}
    </ns1:${method}Request>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
    }

    async _soapRequest(service, method, body = '') {
        try {
            const envelope = this._buildSoapEnvelope(service, method, body);
            const response = await requestWithRetry(axios, {
                method: 'POST',
                url: SOAP_ENDPOINTS[service],
                data: envelope,
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': `${method}`
                }
            }, {
                retries: 3,
                baseDelayMs: 500,
                maxDelayMs: 4000
            });

            const result = await parseStringPromise(response.data, { explicitArray: false });
            const bodyKey = Object.keys(result['SOAP-ENV:Envelope']['SOAP-ENV:Body'])[0];
            return {
                success: true,
                data: result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][bodyKey]
            };
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
        const { page = 0, size = 100 } = params;
        return await this._soapRequest('product', 'GetProductList', `
      <pagingData>
        <currentPage>${page}</currentPage>
        <pageSize>${size}</pageSize>
      </pagingData>
    `);
    }

    async getProductByCode(productSellerCode) {
        return await this._soapRequest('product', 'GetProductBySellerCode', `
      <productSellerCode>${productSellerCode}</productSellerCode>
    `);
    }

    async createProduct(product) {
        const {
            productSellerCode, title, subtitle, description,
            domesticPrice, currencyType = 1, categoryId,
            preparingDay = 3, shipmentTemplate, images, attributes
        } = product;

        const imageXml = images.map((url, i) =>
            `<image><url>${url}</url><order>${i + 1}</order></image>`
        ).join('');

        const attrXml = attributes?.map(a =>
            `<productAttribute>
        <name>${a.name}</name>
        <value>${a.value}</value>
      </productAttribute>`
        ).join('') || '';

        return await this._soapRequest('product', 'SaveProduct', `
      <product>
        <productSellerCode>${productSellerCode}</productSellerCode>
        <title>${title}</title>
        <subtitle>${subtitle || ''}</subtitle>
        <description><![CDATA[${description}]]></description>
        <category><id>${categoryId}</id></category>
        <price>${domesticPrice}</price>
        <currencyType>${currencyType}</currencyType>
        <preparingDay>${preparingDay}</preparingDay>
        <shipmentTemplate>${shipmentTemplate}</shipmentTemplate>
        <images>${imageXml}</images>
        <attributes>${attrXml}</attributes>
        <stockItems>
          <stockItem>
            <quantity>0</quantity>
            <sellerStockCode>${productSellerCode}</sellerStockCode>
          </stockItem>
        </stockItems>
      </product>
    `);
    }

    async updatePrice(productSellerCode, price) {
        return await this._soapRequest('product', 'UpdateProductPriceBySellerCode', `
      <productSellerCode>${productSellerCode}</productSellerCode>
      <price>${price}</price>
      <currencyType>1</currencyType>
    `);
    }

    async updateStock(productSellerCode, quantity) {
        return await this._soapRequest('product', 'UpdateStockByStockSellerCode', `
      <stockItems>
        <stockItem>
          <sellerStockCode>${productSellerCode}</sellerStockCode>
          <quantity>${quantity}</quantity>
        </stockItem>
      </stockItems>
    `);
    }

    async deleteProduct(productSellerCode) {
        return await this._soapRequest('product', 'DeleteProductBySellerCode', `
      <productSellerCode>${productSellerCode}</productSellerCode>
    `);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SİPARİŞ İŞLEMLERİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getOrders(params = {}) {
        const { status, startDate, endDate, page = 0, size = 100 } = params;

        let searchData = '';
        if (status) searchData += `<status>${status}</status>`;
        if (startDate) searchData += `<period><startDate>${startDate}</startDate>`;
        if (endDate) searchData += `<endDate>${endDate}</endDate></period>`;

        return await this._soapRequest('order', 'DetailedOrderList', `
      <searchData>${searchData}</searchData>
      <pagingData>
        <currentPage>${page}</currentPage>
        <pageSize>${size}</pageSize>
      </pagingData>
    `);
    }

    async getOrderDetail(orderId) {
        return await this._soapRequest('order', 'OrderDetail', `
      <orderRequest>
        <id>${orderId}</id>
      </orderRequest>
    `);
    }

    async shipOrder(orderItemList, shipmentCompanyCode, trackingNumber) {
        // orderItemList: [{ id, quantity }]
        const itemsXml = orderItemList.map(item =>
            `<orderItem>
        <id>${item.id}</id>
        <quantity>${item.quantity}</quantity>
      </orderItem>`
        ).join('');

        return await this._soapRequest('order', 'MakeOrderItemShipment', `
      <orderItemList>${itemsXml}</orderItemList>
      <shipmentInfo>
        <shipmentCompany><id>${shipmentCompanyCode}</id></shipmentCompany>
        <trackingNumber>${trackingNumber}</trackingNumber>
      </shipmentInfo>
    `);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // KATEGORİ
    // ═══════════════════════════════════════════════════════════════════════════

    async getTopCategories() {
        return await this._soapRequest('category', 'GetTopLevelCategories', '');
    }

    async getSubCategories(categoryId) {
        return await this._soapRequest('category', 'GetSubCategories', `
      <categoryId>${categoryId}</categoryId>
      <pagingData>
        <currentPage>0</currentPage>
        <pageSize>100</pageSize>
      </pagingData>
    `);
    }

    async getCategoryAttributes(categoryId) {
        return await this._soapRequest('category', 'GetCategoryAttributes', `
      <categoryId>${categoryId}</categoryId>
      <pagingData>
        <currentPage>0</currentPage>
        <pageSize>100</pageSize>
      </pagingData>
    `);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER
    // ═══════════════════════════════════════════════════════════════════════════

    async testConnection() {
        const result = await this.getProducts({ page: 0, size: 1 });
        return result.success;
    }

    isConnected() {
        return !!(this.apiKey && this.apiSecret);
    }
}

let instance = null;

export const n11Api = {
    init(config) {
        instance = new N11API(config);
        return instance;
    },
    getInstance() { return instance; },
    isConnected() { return instance?.isConnected() || false; },

    async getProducts(params) { return instance?.getProducts(params); },
    async updatePrice(code, price) { return instance?.updatePrice(code, price); },
    async updateStock(code, qty) { return instance?.updateStock(code, qty); },
    async getOrders(params) { return instance?.getOrders(params); }
};
