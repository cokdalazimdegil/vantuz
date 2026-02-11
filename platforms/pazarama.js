export default {
    name: 'Pazarama',
    icon: '🛒', // Shopping cart icon for Pazarama
    description: 'Yeni Nesil Mobil Alışveriş Platformu',
    requiredFields: [
        { key: 'apiKey', label: 'API Key', env: 'PAZARAMA_API_KEY' }
    ],
    async getOrders(creds) {
        // Stub
        return [];
    }
};