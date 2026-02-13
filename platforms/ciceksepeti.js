export default {
    name: 'ÇiçekSepeti',
    icon: '🌸', // Flower icon for ÇiçekSepeti
    description: 'Entegre Çevrimiçi Çiçek ve Hediye Platformu',
    requiredFields: [
        { key: 'apiKey', label: 'API Key', env: 'CICEKSEPETI_API_KEY' },
        { key: 'supplierId', label: 'Supplier ID', env: 'CICEKSEPETI_SUPPLIER_ID' }
    ],
    async getOrders(creds) {
        // Stub
        return [];
    }
};