export default {
    name: 'Amazon',
    icon: '🟡', // Yellow circle icon for Amazon
    description: 'Global E-ticaret Platformu',
    requiredFields: [
        { key: 'sellerId', label: 'Seller ID', env: 'AMAZON_SELLER_ID' },
        { key: 'authToken', label: 'Auth Token', env: 'AMAZON_AUTH_TOKEN' }
    ],
    async getOrders(creds) {
        // Stub
        return [];
    }
};