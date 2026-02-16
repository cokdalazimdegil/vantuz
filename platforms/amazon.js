module.exports = {
    name: 'Amazon',
    requiredFields: [
        { key: 'sellerId', label: 'Seller ID' },
        { key: 'authToken', label: 'Auth Token' }
    ],
    async getOrders(creds) {
        // Stub
        return [];
    }
};