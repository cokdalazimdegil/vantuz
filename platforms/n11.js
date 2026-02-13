export default {
    name: 'N11',
    icon: '🔵', // Blue circle icon for N11
    description: 'Alternatif E-ticaret Platformu',
    requiredFields: [
        { key: 'apiKey', label: 'App Key', env: 'N11_API_KEY' },
        { key: 'apiSecret', label: 'App Secret', env: 'N11_API_SECRET' }
    ],
    async getOrders(creds) {
        // Stub
        return [];
    }
};