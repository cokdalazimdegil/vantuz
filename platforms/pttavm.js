export default {
    name: 'PttAVM',
    icon: '📮', // Postbox icon for PttAVM
    description: 'Türkiye\'nin Güvenilir E-ticaret Platformu',
    requiredFields: [
        { key: 'apiKey', label: 'API Key', env: 'PTTAVM_API_KEY' },
        { key: 'token', label: 'Token', env: 'PTTAVM_TOKEN' },
        { key: 'shopId', label: 'Shop ID', env: 'PTTAVM_SHOP_ID' }
    ],
    async getOrders(creds) {
        // Stub
        return [];
    }
};
