module.exports = {
    name: 'Hepsiburada',
    requiredFields: [
        { key: 'merchantId', label: 'Merchant ID' },
        { key: 'username', label: 'Username' },
        { key: 'password', label: 'Password' }
    ],
    async getOrders(creds) {
        // Stub
        if (!creds.merchantId) return [];
        return [
            { number: 'HB-998877', customer: 'Ahmet Yılmaz', amount: '1250.00 TRY', status: 'Ready' }
        ];
    }
};