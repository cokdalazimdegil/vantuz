module.exports = {
    name: 'N11',
    requiredFields: [
        { key: 'apiKey', label: 'API Key' },
        { key: 'apiSecret', label: 'API Secret' }
    ],
    async getOrders(creds) {
        // Stub
        return [];
    }
};