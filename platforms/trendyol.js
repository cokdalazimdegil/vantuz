const axios = require('axios');

module.exports = {
    name: 'Trendyol',
    requiredFields: [
        { key: 'supplierId', label: 'Supplier ID', env: 'TRENDYOL_SUPPLIER_ID' },
        { key: 'apiKey', label: 'API Key', env: 'TRENDYOL_API_KEY' },
        { key: 'apiSecret', label: 'API Secret', env: 'TRENDYOL_API_SECRET' }
    ],

    // Kimlik doğrulama testi
    async testConnection(creds) {
        if (!creds.supplierId || !creds.apiKey || !creds.apiSecret) {
            throw new Error('Eksik kimlik bilgileri.');
        }
        
        // Trendyol API'sinde basit bir ping endpoint'i olmadığı için orders'ı limit 1 ile çekerek test ediyoruz
        // veya bilinen bir ürün sorgusu yapılabilir.
        try {
            await this.getOrders(creds, { limit: 1 });
            return true;
        } catch (error) {
            throw new Error('Bağlantı başarısız: ' + (error.message || 'Bilinmeyen hata'));
        }
    },
    
    async getOrders(creds, options = {}) {
        const auth = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64');
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (options.days || 3));

        try {
            const url = `https://api.trendyol.com/sapigw/suppliers/${creds.supplierId}/orders`;
            const response = await axios.get(url, {
                headers: { 
                    'Authorization': `Basic ${auth}`,
                    'User-Agent': `${creds.supplierId} - OmniMarketAI`
                },
                params: {
                    startDate: startDate.getTime(),
                    endDate: Date.now(),
                    orderBy: 'CreatedDate',
                    orderDir: 'DESC',
                    size: options.limit || 10
                }
            });

            return response.data.content.map(o => ({
                id: o.orderNumber,
                customer: `${o.customerFirstName} ${o.customerLastName}`,
                total: `${o.totalPrice} ${o.currencyCode}`,
                status: o.status,
                date: new Date(o.createdDate).toLocaleDateString('tr-TR'),
                platform: 'Trendyol'
            }));
        } catch (error) {
            const msg = error.response ? JSON.stringify(error.response.data) : error.message;
            throw new Error(`Trendyol API Hatası: ${msg}`);
        }
    }
};
