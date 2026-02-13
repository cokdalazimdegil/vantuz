export default {
    name: 'Amazon',
    icon: '🟡', // Yellow circle icon for Amazon
    description: 'Global E-ticaret Platformu',
    requiredFields: [
        { key: 'sellerId', label: 'Seller ID', env: 'AMAZON_SELLER_ID' },
        { key: 'clientId', label: 'Client ID (LWA)', env: 'AMAZON_CLIENT_ID' },
        { key: 'clientSecret', label: 'Client Secret (LWA)', env: 'AMAZON_CLIENT_SECRET' },
        { key: 'refreshToken', label: 'Refresh Token', env: 'AMAZON_REFRESH_TOKEN' },
        { key: 'region', label: 'Bölge (eu/na/tr)', env: 'AMAZON_REGION', default: 'eu' }
    ],
    async getOrders(creds) {
        // Stub
        return [];
    }
};