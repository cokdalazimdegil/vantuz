// core/openclaw-bridge.js
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { log } from './ai-provider.js';

const DEFAULT_PORT = 18789;

function loadOpenclawConfig() {
    try {
        const configPath = path.join(process.cwd(), '.openclaw', 'openclaw.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
    } catch (e) {
        log('WARN', 'Gateway config okunamadı', { error: e.message });
    }
    return {};
}

function buildGatewayUrl(config) {
    const port = config?.gateway?.port || DEFAULT_PORT;
    const tls = config?.gateway?.tls?.enabled === true;
    const scheme = tls ? 'wss' : 'ws';
    return `${scheme}://127.0.0.1:${port}`;
}

function getAuthToken(config) {
    return config?.gateway?.auth?.token || null;
}

function toStringSafe(value) {
    return typeof value === 'string' ? value : '';
}

function normalizeChannel(value) {
    if (!value) return '';
    return String(value).toLowerCase();
}

function isOutbound(payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.fromMe === true) return true;
    if (payload.outbound === true) return true;
    if (payload.direction && String(payload.direction).toLowerCase() === 'outbound') return true;
    if (payload.isBot === true) return true;
    return false;
}

function extractInbound(evt) {
    if (!evt || evt.type !== 'event') return null;
    const payload = evt.payload;
    if (!payload || typeof payload !== 'object') return null;

    if (isOutbound(payload)) return null;

    const message =
        toStringSafe(payload.message) ||
        toStringSafe(payload.body) ||
        toStringSafe(payload.text) ||
        toStringSafe(payload.content);

    if (!message) return null;

    const channel =
        normalizeChannel(payload.channel) ||
        normalizeChannel(payload.provider) ||
        normalizeChannel(payload.channelId);

    const from =
        toStringSafe(payload.from) ||
        toStringSafe(payload.sender) ||
        toStringSafe(payload.author) ||
        toStringSafe(payload.user) ||
        toStringSafe(payload.peer) ||
        toStringSafe(payload.chatJid);

    if (!from) return null;

    return { message, channel: channel || 'whatsapp', from };
}

function appendEventLog(evt) {
    try {
        const logPath = path.join(process.cwd(), '.vantuz', 'gateway-events.log');
        const line = `${new Date().toISOString()} ${JSON.stringify(evt)}\n`;
        fs.appendFileSync(logPath, line);
    } catch { }
}

export class OpenClawBridge {
    constructor(engine, gateway) {
        this.engine = engine;
        this.gateway = gateway;
        this.ws = null;
        this.connected = false;
    }

    start() {
        const config = loadOpenclawConfig();
        const url = buildGatewayUrl(config);
        const token = getAuthToken(config);

        if (!token) {
        log('WARN', 'Gateway token bulunamadı; bridge başlatılmadı');
            return;
        }

        if (typeof WebSocket === 'undefined') {
            log('WARN', 'WebSocket bulunamadı; bridge başlatılamadı');
            return;
        }

        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
            this._sendConnect(token);
        };

        this.ws.onmessage = async (event) => {
            let parsed = null;
            try {
                parsed = JSON.parse(event.data);
            } catch {
                return;
            }

            if (parsed?.type === 'event') {
                const inbound = extractInbound(parsed);
                if (inbound) {
                    try {
                        const response = await this.engine.handleMessage(inbound.message, {
                            channel: inbound.channel,
                            from: inbound.from
                        });
                        if (response && this.gateway?.isConnected()) {
                            await this.gateway.sendMessage(inbound.channel, inbound.from, response);
                        }
                    } catch (e) {
                        log('ERROR', 'Inbound 처리 hatası', { error: e.message });
                    }
                } else {
                    appendEventLog(parsed);
                }
            }
        };

        this.ws.onclose = () => {
            this.connected = false;
        log('WARN', 'Gateway WS bağlantısı kapandı');
        };

        this.ws.onerror = (err) => {
            this.connected = false;
        log('WARN', 'Gateway WS hata', { error: String(err?.message || err) });
        };
    }

    _sendConnect(token) {
        const id = crypto.randomUUID();
        const params = {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
                id: 'vantuz',
                version: '3.3.1',
                platform: process.platform,
                mode: 'backend'
            },
            role: 'operator',
            scopes: ['operator.admin'],
            auth: { token }
        };

        const frame = {
            type: 'req',
            id,
            method: 'connect',
            params
        };

        try {
            this.ws.send(JSON.stringify(frame));
            this.connected = true;
            log('INFO', 'Gateway WS connect gönderildi');
        } catch (e) {
            log('WARN', 'Gateway WS connect gönderilemedi', { error: e.message });
        }
    }
}

export default OpenClawBridge;
