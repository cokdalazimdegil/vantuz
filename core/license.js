
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { log } from './ai-provider.js';

const LICENSE_FILE = path.join(os.homedir(), '.vantuz', 'license.json');
import os from 'os';

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
     * Lisans anahtarını doğrula ve aktif et
     */
    activate(key) {
        // Basit simülasyon: VTZ- ile başlayan anahtarları kabul et
        // Gerçekte burası senin lisans sunucuna (API) istek atmalı.
        if (!key || !key.startsWith('VTZ-')) {
            return { success: false, message: 'Geçersiz Lisans Anahtarı formatı.' };
        }

        const now = new Date();
        const oneYearLater = new Date(now);
        oneYearLater.setFullYear(now.getFullYear() + 1);

        this.data = {
            key: key,
            activatedAt: now.toISOString(),
            expiresAt: oneYearLater.toISOString(),
            type: 'ANNUAL_PRO' // Yıllık Profesyonel Lisans
        };
        this._save();
        log('INFO', 'Lisans başarıyla aktif edildi.', { type: this.data.type });
        return { success: true, message: 'Yıllık lisans aktif edildi.' };
    }

    /**
     * Durum kontrolü
     */
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
