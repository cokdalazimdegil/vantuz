/**
 * 🌐 VANTUZ GATEWAY BRIDGE v1.0
 * Vantuz ↔ Vantuz Gateway iletişim katmanı
 * 
 * Gateway üzerinden:
 * - AI model yönlendirmesi
 * - Kanal yönetimi (WhatsApp, Telegram)
 * - Plugin RPC çağrıları
 * - Sistem durumu sorgulama
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from './ai-provider.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG - Gateway ayarları
// ═══════════════════════════════════════════════════════════════════════════

const OPENCLAW_HOME = path.join(process.cwd(), '.openclaw');
const OPENCLAW_CONFIG = path.join(OPENCLAW_HOME, 'openclaw.json');
const VANTUZ_HOME = path.join(os.homedir(), '.vantuz');

function loadGatewayConfig() {
    try {
        if (fs.existsSync(OPENCLAW_CONFIG)) {
            return JSON.parse(fs.readFileSync(OPENCLAW_CONFIG, 'utf-8'));
        }
    } catch (e) {
        log('WARN', 'Gateway config okunamadı', { error: e.message });
    }
    return null;
}

function getGatewayToken(config) {
    return config?.gateway?.auth?.token || null;
}

// ═══════════════════════════════════════════════════════════════════════════
// GATEWAY CLIENT
// ═══════════════════════════════════════════════════════════════════════════

export class VantuzGateway {
    constructor() {
        this.config = loadGatewayConfig();
        const port = this.config?.gateway?.port || 18789;
        this.baseUrl = `http://localhost:${port}`;
        this.token = getGatewayToken(this.config);
        this.connected = false;
        this.version = null;
    }

    /**
     * HTTP Headers (token auth)
     */
    _headers() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    /**
     * Gateway'e HTTP isteği gönder
     */
    async _request(method, endpoint, data = null, timeout = 10000) {
        try {
            const config = {
                method,
                url: `${this.baseUrl}${endpoint}`,
                headers: this._headers(),
                timeout
            };

            if (data) config.data = data;

            const response = await axios(config);
            return { success: true, data: response.data };
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                return { success: false, error: 'Gateway çalışmıyor', code: 'NOT_RUNNING' };
            }
            if (error.response?.status === 401) {
                return { success: false, error: 'Token geçersiz', code: 'AUTH_FAILED' };
            }
            return {
                success: false,
                error: error.message,
                code: error.code || 'UNKNOWN'
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SAĞLIK & DURUM
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Gateway sağlık kontrolü
     */
    async health() {
        const result = await this._request('GET', '/health');
        this.connected = result.success;
        if (result.success) {
            this.version = result.data?.version || 'unknown';
        }
        return result;
    }

    /**
     * Gateway sürecini başlat
     */
    async start() {
        const cwd = process.cwd();
        const gatewayCmd = path.join(cwd, '.openclaw', 'gateway.cmd');
        const isWin = process.platform === 'win32';

        try {
            const { spawn } = await import('child_process');
            let child;

            if (isWin && fs.existsSync(gatewayCmd)) {
                // Windows: Use generated CMD (has config env vars)
                child = spawn(gatewayCmd, [], {
                    detached: true,
                    stdio: 'ignore', // Keep it in background
                    shell: true,
                    cwd // Ensure CWD is correct for finding node_modules
                });
            } else {
                // Linux/Mac or missing CMD: Use npx directly
                // We try to load token from config if possible to pass as ENV
                const env = { ...process.env };
                if (this.config?.gateway?.auth?.token) {
                    env.OPENCLAW_GATEWAY_TOKEN = this.config.gateway.auth.token;
                }

                child = spawn('npx', ['openclaw', 'gateway', '--port', '18789', '--allow-unconfigured'], {
                    detached: true,
                    stdio: 'ignore',
                    shell: true,
                    cwd,
                    env
                });
            }

            if (child) {
                child.unref(); // Detach process so it outlives parent
                return { success: true };
            }
            return { success: false, error: 'Child process could not be spawned' };

        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Vantuz API Server (server/app.js) başlat
     */
    async startServer() {
        const serverPath = path.join(process.cwd(), 'server', 'app.js');
        if (!fs.existsSync(serverPath)) {
            return { success: false, error: 'Server dosyası bulunamadı: server/app.js' };
        }

        try {
            const { spawn } = await import('child_process');
            const child = spawn('node', [serverPath], {
                detached: true,
                stdio: 'ignore',
                shell: true,
                cwd: process.cwd(),
                env: { ...process.env, PORT: '3001' } // Ensure default port
            });

            child.unref();
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Tüm sistemi başlat (Gateway + Server)
     */
    async startFullStack() {
        // 1. Start Gateway
        const gwResult = await this.start();

        // 2. Wait for Gateway to initialize (approx 3s)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 3. Start Server
        const serverResult = await this.startServer();

        return {
            success: gwResult.success && serverResult.success,
            gateway: gwResult,
            server: serverResult
        };
    }

    /**
     * Gateway çalışmıyorsa başlat ve sağlık kontrolü yap
     */
    async ensureRunning(options = {}) {
        const {
            retries = 5,
            intervalMs = 1000
        } = options;

        if (this.isConnected()) {
            return { success: true, already: true };
        }

        const started = await this.start();
        if (!started.success) {
            return started;
        }

        for (let i = 0; i < retries; i++) {
            await new Promise(r => setTimeout(r, intervalMs));
            const health = await this.health();
            if (health.success) {
                return { success: true, started: true };
            }
        }

        return { success: false, error: 'Gateway başlatıldı ancak sağlık kontrolü geçmedi' };
    }

    /**
     * Detaylı sistem durumu
     */
    async status() {
        const result = await this._request('GET', '/status');
        if (result.success) {
            this.connected = true;
        }
        return result;
    }

    /**
     * Gateway bağlı mı?
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Gateway bilgileri
     */
    getInfo() {
        return {
            url: this.baseUrl,
            connected: this.connected,
            version: this.version,
            hasToken: !!this.token,
            configFound: !!this.config
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AI MODEL YÖNLENDİRME
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Gateway üzerinden AI chat
     * Gateway AI model routing sağlıyorsa kullan
     */
    async chat(message, options = {}) {
        const result = await this._request('POST', '/v1/chat/completions', {
            messages: [
                ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
                { role: 'user', content: message }
            ],
            model: options.model || 'default',
            max_tokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7
        }, 30000);

        if (result.success) {
            const text = result.data?.choices?.[0]?.message?.content;
            return { success: true, response: text };
        }

        return { success: false, error: result.error };
    }

    /**
     * Kullanılabilir AI modelleri
     */
    async getModels() {
        return await this._request('GET', '/v1/models');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // KANAL YÖNETİMİ
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Kanal listesi ve durumları
     */
    async getChannels() {
        return await this._request('GET', '/channels');
    }

    /**
     * Kanal bağlantı durumu
     */
    async getChannelStatus(channelName) {
        return await this._request('GET', `/channels/${channelName}/status`);
    }

    /**
     * Kanal üzerinden mesaj gönder
     */
    async sendMessage(channel, to, message) {
        return await this._request('POST', `/channels/${channel}/send`, {
            to,
            message,
            type: 'text'
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RPC - Plugin Gateway Methodları
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Gateway RPC çağrısı
     */
    async call(method, params = {}) {
        return await this._request('POST', '/rpc', {
            method,
            params
        });
    }

    /**
     * Vantuz plugin durumu
     */
    async getPluginStatus() {
        return await this.call('vantuz.status');
    }

    /**
     * Vantuz plugin config
     */
    async getPluginConfig() {
        return await this.call('vantuz.config', { action: 'get' });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CRON & ZAMANLAMA
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Zamanlanmış görev listesi
     */
    async getCronJobs() {
        return await this._request('GET', '/cron');
    }

    /**
     * Zamanlanmış görev ekle
     */
    async addCronJob(schedule, command, description) {
        return await this._request('POST', '/cron', {
            schedule,
            command,
            description
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HAFIZA (Memory)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Gateway hafıza durumu
     */
    async getMemoryStatus() {
        return await this._request('GET', '/memory/status');
    }

    /**
     * Hafıza araması
     */
    async searchMemory(query) {
        return await this._request('POST', '/memory/search', { query });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LOGLAR
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Gateway logları
     */
    async getLogs(limit = 50) {
        return await this._request('GET', `/logs?limit=${limit}`);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON & FACTORY
// ═══════════════════════════════════════════════════════════════════════════

let gatewayInstance = null;

/**
 * Vantuz Gateway singleton instance
 * Otomatik bağlantı kontrolü yapar
 */
export async function getGateway() {
    if (!gatewayInstance) {
        gatewayInstance = new VantuzGateway();

        // İlk bağlantı denemesi
        const health = await gatewayInstance.health();
        if (health.success) {
            log('INFO', 'Vantuz Gateway bağlantısı başarılı', {
                url: gatewayInstance.baseUrl,
                version: gatewayInstance.version
            });
        } else {
            log('WARN', 'Vantuz Gateway erişilemez, direkt mod kullanılacak', {
                error: health.error
            });
        }
    }
    return gatewayInstance;
}

/**
 * Gateway durumunu sıfırla (reconnect için)
 */
export function resetGateway() {
    gatewayInstance = null;
}

export default VantuzGateway;
