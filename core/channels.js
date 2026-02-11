/**
 * 📱 CHANNEL MANAGER v3.2
 * Gateway üzerinden kanal yönetimi
 * 
 * Desteklenen kanallar:
 * - WhatsApp (Meta Business API / Gateway)
 * - Telegram (Bot API / Gateway)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from './ai-provider.js';
import { getGateway } from './gateway.js';

const VANTUZ_HOME = path.join(os.homedir(), '.vantuz');
const CONFIG_PATH = path.join(VANTUZ_HOME, '.env');

export class ChannelManager {
    constructor() {
        this.gateway = null;
        this.status = {
            whatsapp: { connected: false, mode: 'gateway', info: '' },
            telegram: { connected: false, mode: 'gateway', info: '' }
        };
    }

    /**
     * Tüm kanalları başlat
     */
    async initAll() {
        const env = this._loadEnv();

        // Gateway üzerinden kanal durumu kontrol et
        try {
            this.gateway = await getGateway();

            if (this.gateway.isConnected()) {
                const channelResult = await this.gateway.getChannels();
                if (channelResult.success && channelResult.data) {
                    this._syncGatewayChannels(channelResult.data);
                    log('INFO', 'Kanal durumları gateway üzerinden alındı');
                    return this.status;
                }
            }
        } catch (e) {
            log('WARN', 'Gateway kanal kontrolü başarısız, lokal mod', { error: e.message });
        }

        // Fallback: Lokal env kontrolü
        if (env.TELEGRAM_BOT_TOKEN) {
            this.status.telegram.connected = true;
            this.status.telegram.info = 'Bot Token Configured (local)';
        } else {
            this.status.telegram.info = 'Token yapılandırılmamış';
        }

        if (env.WHATSAPP_ACCESS_TOKEN) {
            this.status.whatsapp.connected = true;
            this.status.whatsapp.info = 'Access Token Configured (local)';
        } else {
            this.status.whatsapp.info = 'Bağlanmak için: vantuz channels login';
        }

        return this.status;
    }

    /**
     * Gateway'den gelen kanal verilerini senkronize et
     */
    _syncGatewayChannels(gatewayData) {
        if (Array.isArray(gatewayData)) {
            for (const ch of gatewayData) {
                const name = ch.name?.toLowerCase();
                if (name === 'whatsapp' || name === 'telegram') {
                    this.status[name] = {
                        connected: ch.connected || ch.status === 'connected',
                        mode: 'gateway',
                        info: ch.info || ch.status || 'Gateway üzerinden bağlı',
                        capabilities: ch.capabilities || []
                    };
                }
            }
        } else if (typeof gatewayData === 'object') {
            // Object format: { whatsapp: {...}, telegram: {...} }
            for (const [name, data] of Object.entries(gatewayData)) {
                const key = name.toLowerCase();
                if (this.status[key]) {
                    this.status[key] = {
                        connected: data.connected || data.status === 'connected',
                        mode: 'gateway',
                        info: data.info || data.status || 'Gateway üzerinden bağlı',
                        capabilities: data.capabilities || []
                    };
                }
            }
        }
    }

    /**
     * Mesaj gönder (gateway üzerinden)
     */
    async sendMessage(channel, to, message) {
        if (!this.gateway?.isConnected()) {
            return { success: false, error: 'Gateway bağlı değil' };
        }

        const result = await this.gateway.sendMessage(channel, to, message);
        if (result.success) {
            log('INFO', `Mesaj gönderildi: ${channel} → ${to}`);
        } else {
            log('ERROR', `Mesaj gönderilemedi: ${channel}`, { error: result.error });
        }
        return result;
    }

    /**
     * Kanal durumunu yenile
     */
    async refresh() {
        return await this.initAll();
    }

    /**
     * Env dosyasını yükle
     */
    _loadEnv() {
        const env = {};
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
                content.split('\n').forEach(line => {
                    const match = line.match(/^([^=]+)=(.*)$/);
                    if (match) {
                        env[match[1].trim()] = match[2].trim();
                    }
                });
            }
        } catch (e) { }
        return env;
    }

    /**
     * Kanal durumları
     */
    getStatus() {
        return this.status;
    }

    /**
     * Gateway bağlı mı?
     */
    isGatewayMode() {
        return this.gateway?.isConnected() || false;
    }
}

// Singleton
let managerInstance = null;

export async function getChannelManager() {
    if (!managerInstance) {
        managerInstance = new ChannelManager();
        await managerInstance.initAll();
    }
    return managerInstance;
}

export default ChannelManager;
