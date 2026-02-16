// nodes/warehouse.js
// Warehouse Node — Lightweight hardware peripheral for Vantuz Gateway
// Connects to Gateway via WebSocket as a "node" role.
// Provides: camera.snap, barcode.scan, voice.listen commands.

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { log } from '../core/ai-provider.js';

const DEFAULT_GATEWAY_URL = 'ws://localhost:18789';

class WarehouseNode {
    constructor(options = {}) {
        this.id = options.nodeId || `warehouse-${Date.now().toString(36)}`;
        this.name = options.name || 'Depo Terminali';
        this.gatewayUrl = options.gatewayUrl || DEFAULT_GATEWAY_URL;
        this.token = options.token || process.env.OPENCLAW_GATEWAY_TOKEN || '';
        this.ws = null;
        this.connected = false;

        // Capabilities this node exposes
        this.capabilities = [
            'camera.snap',     // Take a photo
            'camera.clip',     // Record short video
            'barcode.scan',    // Scan barcode (simulated via image)
            'location.get',    // GPS / warehouse zone
            'status.report'    // Node health status
        ];

        log('INFO', `WarehouseNode "${this.name}" created`, { id: this.id });
    }

    /**
     * Connect to Gateway as a Node peripheral.
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.gatewayUrl);

                this.ws.on('open', () => {
                    // Send handshake frame
                    this.ws.send(JSON.stringify({
                        type: 'connect',
                        role: 'node',
                        nodeId: this.id,
                        name: this.name,
                        token: this.token,
                        capabilities: this.capabilities,
                        meta: {
                            platform: process.platform,
                            version: '1.0.0',
                            location: 'warehouse'
                        }
                    }));

                    this.connected = true;
                    log('INFO', `WarehouseNode connected to Gateway`, { url: this.gatewayUrl });
                    resolve(true);
                });

                this.ws.on('message', (data) => {
                    this._handleCommand(JSON.parse(data.toString()));
                });

                this.ws.on('close', () => {
                    this.connected = false;
                    log('WARN', 'WarehouseNode disconnected from Gateway');
                    // Auto-reconnect after 5s
                    setTimeout(() => this.connect().catch(() => { }), 5000);
                });

                this.ws.on('error', (err) => {
                    log('ERROR', 'WarehouseNode WebSocket error', { error: err.message });
                    reject(err);
                });

            } catch (e) {
                reject(e);
            }
        });
    }

    /**
     * Handle incoming commands from Gateway/Agent.
     */
    async _handleCommand(frame) {
        const { type, command, requestId, params = {} } = frame;

        if (type !== 'command') return;

        log('INFO', `Node command received: ${command}`, { requestId, params });

        let result;

        switch (command) {
            case 'camera.snap':
                result = await this._cameraSnap(params);
                break;

            case 'barcode.scan':
                result = await this._barcodeScan(params);
                break;

            case 'status.report':
                result = this._statusReport();
                break;

            default:
                result = { success: false, error: `Unknown command: ${command}` };
        }

        // Send response back to Gateway
        this._sendResponse(requestId, result);
    }

    /**
     * Capture an image from camera.
     * In production: uses device camera API.
     * Prototype: reads from a configured watch directory.
     */
    async _cameraSnap(params = {}) {
        const watchDir = params.watchDir || path.join(process.cwd(), 'warehouse', 'camera');

        // Prototype: look for the latest image in watch directory
        if (!fs.existsSync(watchDir)) {
            fs.mkdirSync(watchDir, { recursive: true });
            return {
                success: false,
                error: `Kamera klasörü oluşturuldu: ${watchDir}. Fotoğraf dosyasını buraya koyun.`
            };
        }

        const files = fs.readdirSync(watchDir)
            .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
            .map(f => ({
                name: f,
                path: path.join(watchDir, f),
                time: fs.statSync(path.join(watchDir, f)).mtimeMs
            }))
            .sort((a, b) => b.time - a.time);

        if (files.length === 0) {
            return {
                success: false,
                error: 'Kamera klasöründe fotoğraf bulunamadı.'
            };
        }

        const latest = files[0];
        const buffer = fs.readFileSync(latest.path);
        const base64 = buffer.toString('base64');

        log('INFO', `Camera snap: ${latest.name}`, { size: buffer.length });

        return {
            success: true,
            image: `data:image/jpeg;base64,${base64}`,
            filename: latest.name,
            capturedAt: new Date().toISOString()
        };
    }

    /**
     * Scan barcode from latest camera image.
     * In production: uses barcode scanning library.
     * Prototype: extracts from filename convention (e.g., "barcode_123456.jpg").
     */
    async _barcodeScan(params = {}) {
        const snap = await this._cameraSnap(params);
        if (!snap.success) return snap;

        // Prototype: extract barcode from filename
        const match = snap.filename.match(/barcode[_-]?(\d+)/i);
        if (match) {
            return {
                success: true,
                barcode: match[1],
                format: 'CODE128',
                source: 'filename',
                image: snap.image
            };
        }

        // In production, this would use a barcode scanning library
        return {
            success: true,
            barcode: null,
            note: 'Barkod tespit edilemedi. Üretim sürümünde barkod kütüphanesi kullanılacak.',
            image: snap.image
        };
    }

    /**
     * Report node status / health.
     */
    _statusReport() {
        return {
            success: true,
            nodeId: this.id,
            name: this.name,
            connected: this.connected,
            uptime: process.uptime(),
            memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            capabilities: this.capabilities,
            platform: process.platform
        };
    }

    /**
     * Send response frame back to Gateway.
     */
    _sendResponse(requestId, result) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            log('WARN', 'Cannot send response, WebSocket not open');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'response',
            requestId,
            ...result
        }));
    }

    /**
     * Disconnect from Gateway.
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.connected = false;
        }
    }
}

export default WarehouseNode;
