export default {
    name: 'Pazarama',
    icon: '🛒', // Shopping cart icon for Pazarama
    description: 'Yeni Nesil Mobil Alışveriş Platformu',
    requiredFields: [
        { key: 'clientId', label: 'Client ID', env: 'PAZARAMA_CLIENT_ID' },
        { key: 'clientSecret', label: 'Client Secret', env: 'PAZARAMA_CLIENT_SECRET' }
    ],
    async getOrders(creds) {
        // Stub
        return [];
    }
};