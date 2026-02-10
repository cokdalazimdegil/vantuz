
import express from 'express';
import cors from 'cors';

import path from 'path';
import { fileURLToPath } from 'url';
import { getEngine } from '../core/engine.js';
import { getGateway } from '../core/gateway.js';
import { log } from '../core/ai-provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Engine Singleton
let engine = null;
const initEngine = async () => {
    if (!engine) {
        engine = await getEngine();
    }
    return engine;
};

// ═══════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// 1. Status & Health
app.get('/api/status', async (req, res) => {
    const instance = await initEngine();
    res.json(instance.getStatus());
});

// 2. Products & Stock
app.get('/api/products', async (req, res) => {
    try {
        const instance = await initEngine();
        const stocks = await instance.getStock();
        res.json(stocks);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Orders
app.get('/api/orders', async (req, res) => {
    try {
        const instance = await initEngine();
        const orders = await instance.getOrders({ size: 50 });
        res.json(orders);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. AI Chat
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mesaj gerekli' });

    try {
        const instance = await initEngine();
        const response = await instance.chat(message);
        res.json({ response });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 5. Logs
app.get('/api/logs', async (req, res) => {
    const { getLogs } = await import('../core/ai-provider.js');
    res.json({ logs: getLogs(100) });
});

// 6. Gateway Status
app.get('/api/gateway', async (req, res) => {
    try {
        const gw = await getGateway();
        const health = await gw.health();
        res.json({
            ...gw.getInfo(),
            health: health.success ? 'healthy' : 'unreachable',
            healthData: health.data || null
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 7. Channels Status
app.get('/api/channels', async (req, res) => {
    try {
        const instance = await initEngine();
        const status = instance.getStatus();
        res.json(status.channels || {});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 8. Doctor
app.get('/api/doctor', async (req, res) => {
    try {
        const instance = await initEngine();
        const report = await instance.doctor();
        res.json(report);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Frontend Serve
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not Found' });
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`\n🚀 Vantuz API Sunucusu: http://localhost:${PORT}`);
    log('INFO', `Sunucu ${PORT} portunda başlatıldı`);
});
