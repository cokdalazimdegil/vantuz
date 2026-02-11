export default {
    name: 'Hepsiburada',
    icon: '🟣', // Purple circle icon for Hepsiburada
    description: 'Popüler E-ticaret Platformu',
    requiredFields: [
        { key: 'merchantId', label: 'Merchant ID', env: 'HEPSIBURADA_MERCHANT_ID' },
        { key: 'username', label: 'Username', env: 'HEPSIBURADA_USERNAME' },
        { key: 'password', label: 'Password', env: 'HEPSIBURADA_PASSWORD' }
    ],
    async getOrders(creds) {
        // Stub
        if (!creds.merchantId) return [];
        return [
            { number: 'HB-998877', customer: 'Ahmet Yılmaz', amount: '1250.00 TRY', status: 'Ready' }
        ];
    }
};