
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { log } from './ai-provider.js';
import os from 'os';

const LICENSE_FILE = path.join(os.homedir(), '.vantuz', 'license.json');

// PUBLIC KEY (Müşteriye giden kodun içine gömülü)
// Sadece senin Private Key'inle imzalanmış veriyi doğrular.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnOaEFB+3s2ouGnbfGlbE
XO55/RFjoifn2dMNTLt49Ul6CsDES0VaKOQ3+Vmyw8OjYwy773Z/wunX09qCEXDE
vKHAhxxBa3RQafIbQ/2MIyGTjvxrGelDPzB6yStSwLgShcXtRvAh69aXpFjXCLaW
svNq+7vcnNdXeZ2c0ipWbnqjpPiFKDe+wZ//gkx70zYXc4WijyLtTQWC6BobhpOA
isx5uykTzr+LLtMb2n1TpxEopSRbkLQQD4NMskH9Eb1Nx3znl+PjZooUXvr+8eJr
jQp0PTDTL32LHo2iaWwkKZ38PDc/hfSuu3Kt31t0SIxAwObcCmO2OtiZ7wTKxDow
RwIDAQAB
-----END PUBLIC KEY-----`;

export class LicenseManager {
    constructor() {
        this.data = this._load();
    }

    _load() {
        try {
            if (fs.existsSync(LICENSE_FILE)) {
                return JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8'));
            }
        } catch (e) {}
        return { key: null, activatedAt: null, type: 'DEMO', expiresAt: null };
    }

    _save() {
        fs.writeFileSync(LICENSE_FILE, JSON.stringify(this.data, null, 2));
    }

    /**
     * Lisans anahtarını doğrula (Signature Verification)
     * Format: BASE64_PAYLOAD.BASE64_SIGNATURE
     */
    activate(licenseString) {
        try {
            const [payloadB64, signatureB64] = licenseString.split('.');
            if (!payloadB64 || !signatureB64) {
                return { success: false, message: 'Geçersiz lisans formatı.' };
            }

            // 1. İmzayı Doğrula
            const verify = crypto.createVerify('SHA256');
            verify.update(payloadB64);
            verify.end();
            const isValid = verify.verify(PUBLIC_KEY, signatureB64, 'base64');

            if (!isValid) {
                return { success: false, message: '❌ SAHTE LİSANS! İmza doğrulanamadı.' };
            }

            // 2. İçeriği Çöz
            const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf-8'));
            
            // 3. Son Kullanma Tarihini Kontrol Et (Payload içinden gelir)
            // Payload: { type: 'ANNUAL', expires: '2027-01-01', user: '...' }
            
            this.data = {
                key: licenseString,
                activatedAt: new Date().toISOString(),
                expiresAt: payload.expires,
                type: payload.type || 'PRO'
            };
            this._save();
            
            return { success: true, message: `Lisans aktif! Bitiş: ${payload.expires}` };

        } catch (e) {
            return { success: false, message: 'Lisans işlenirken hata oluştu: ' + e.message };
        }
    }

    check() {
        if (!this.data.key || !this.data.expiresAt) {
            return { valid: false, reason: 'NO_LICENSE', message: 'Lisans bulunamadı.' };
        }

        const now = new Date();
        const expires = new Date(this.data.expiresAt);
        const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));

        if (daysLeft <= 0) {
            return { valid: false, reason: 'EXPIRED', message: 'Lisans süresi doldu.' };
        }

        return { 
            valid: true, 
            type: this.data.type, 
            daysLeft: daysLeft,
            expiresAt: this.data.expiresAt 
        };
    }

    getInfo() {
        const check = this.check();
        return {
            ...this.data,
            valid: check.valid,
            daysLeft: check.daysLeft || 0
        };
    }
}

export const licenseManager = new LicenseManager();
