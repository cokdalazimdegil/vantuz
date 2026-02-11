export default {
    name: 'ÇiçekSepeti',
    icon: '🌸', // Flower icon for ÇiçekSepeti
    description: 'Entegre Çevrimiçi Çiçek ve Hediye Platformu',
    requiredFields: [
        { key: 'apiKey', label: 'API Key', env: 'CICEKSEPETI_API_KEY' }
    ],
    async getOrders(creds) {
        // Stub
        return [];
    }
};