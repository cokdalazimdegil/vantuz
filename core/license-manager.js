const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Müşteriye Gidecek Olan PUBLIC KEY (Sadece doğrulama yapar)
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvRNpoWJ4evHdT6I55/pE
Kly7N/vycRFavRP7Fsm3w/Ugfl+mdmxCZpjZVUXDWWT2d+I+XBh13g4ZmF9h0hVH
DklNBx6ikV9hax/zMu5auNLKf/IqAs9rM9ibdMaF2pxiiFelC0W2gmr1JDAbsU5o
+Znjs9WskTCxUjcHUpViPqPaRb39wo2UC25BtbHihXEIbx6mYJVXkg8ayFEcsKQc
FF10nTYaA1B0ENV9+mpda5etbaL7WFp6lfekYCDwJ8D78McNrGWDQSkQsJFgfzDL
ad+WCVh97rnXdlW3iQCGLXCN9ad1Ky8sw1C1tllEFQb3irOJvU0+s/8Pv829NLNh
iQIDAQAB
-----END PUBLIC KEY-----`;

// NOT: Bu dosya artık lisans ÜRETEMEZ. Sadece doğrular.
// Lisans üretmek için 'admin-keygen.js' dosyasını kullanın (Müşteriye vermeyin).

module.exports = {
    verifyLicense(licenseKey) {
        try {
            // Lisans formatı: BASE64_DATA.BASE64_SIGNATURE
            const parts = licenseKey.split('.');
            if (parts.length !== 2) return { valid: false, reason: 'Geçersiz Format' };

            const data = parts[0];
            const signature = parts[1];

            // İmzayı doğrula
            const verify = crypto.createVerify('SHA256');
            verify.update(data);
            verify.end();

            // Gerçek Public Key'i kullan (Hardcoded)
            const pubKey = PUBLIC_KEY;

            const isValid = verify.verify(pubKey, signature, 'base64');

            if (!isValid) {
                return { valid: false, reason: 'Sahte Lisans (İmza Geçersiz)' };
            }

            const payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
            const today = new Date().toISOString().split('T')[0];

            if (payload.expiry < today) {
                return { valid: false, reason: 'Süresi Dolmuş Lisans' };
            }

            return { valid: true, data: payload };

        } catch (e) {
            return { valid: false, reason: 'Lisans Okunamadı' };
        }
    }
};
