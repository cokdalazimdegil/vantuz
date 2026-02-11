export default {
    name: 'N11',
    icon: '🔵', // Blue circle icon for N11
    description: 'Alternatif E-ticaret Platformu',
    requiredFields: [
        { key: 'apiKey', label: 'API Key', env: 'N11_API_KEY' },
        { key: 'apiSecret', label: 'API Secret', env: 'N11_API_SECRET' }
    ],
    async getOrders(creds) {
        // Stub
        return [];
    }
};