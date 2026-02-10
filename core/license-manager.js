const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Müşteriye Gidecek Olan PUBLIC KEY (Sadece doğrulama yapar)
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAphjtxJVk8qG3HpXTVKoG
QKvvUdPeO4dohFFc2S2SP31mapevTgXDklO6fDapEAzRAaySZDYMQhyeK5lZXlXZ
fSf8OhzM2vyQ/oBp0VuLOv0fcx9oDYsPOoDY6F4X04cfPHlrIXdzeSpk9G+Dv8HL
/P2uVlLn249Olwhj0bKioFqUggm+m+WIhsHeHtSngzbrqi0A1O8FG8Srj1Zb5O/9
99c1JjzDa36XwuIEMYHFgewvNuVS8GqB+Tr3EYdA0dbzI27Y273N3Ay9l3LhzfmR
6faAgQcegPVdrbhqyCQmuDDUBbt4vE+sGGwitl5UyT6Edyaf/GRciXp/KHytvUCe
vQIDAQAB
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

            // Gerçek Public Key'i okuyalım (Normalde hardcoded olur ama demo için dosyadan okuyorum)
            const pubKey = fs.readFileSync(path.join(__dirname, '../public.pem'), 'utf8');

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
