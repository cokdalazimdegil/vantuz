
/**
 * LİSANS YÖNETİCİSİ (DEV MODE - HERKES SÜPER KULLANICI)
 * Kullanıcının isteği üzerine tüm güvenlik/lisans kontrolleri kaldırılmıştır.
 */

export class LicenseManager {
    constructor(api = null) {
        this.isValidated = true; // Her zaman aktif
    }

    async initialize() {
        return { success: true, bypassed: true };
    }

    async activate(key) {
        return {
            success: true,
            data: {
                user: 'Developer',
                features: ['all'],
                expiresAt: '2099-12-31'
            }
        };
    }

    validateFormat(key) {
        return { valid: true };
    }

    async getFeatureStatus() {
        return { enabled: true }; // Tüm özellikler açık
    }
}
