
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

// 4b. Inbound message (channels)
app.post('/api/inbound', async (req, res) => {
    const { message, channel, from } = req.body || {};
    if (!message) return res.status(400).json({ error: 'Mesaj gerekli' });

    try {
        const instance = await initEngine();
        const response = await instance.handleMessage(message, {
            channel: channel || 'local',
            from: from || 'unknown'
        });
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

// ═══════════════════════════════════════════════════════════════════════════
// 9. WEBHOOKS - Platform Event Receivers
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/webhooks/:platform', async (req, res) => {
    const { platform } = req.params;
    const secret = req.headers['x-webhook-secret'] || '';
    const expectedSecret = process.env.WEBHOOK_SECRET || '';

    if (expectedSecret && secret !== expectedSecret) {
        log('WARN', `Webhook rejected: invalid secret`, { platform });
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const event = req.body;
    log('INFO', `Webhook received from ${platform}`, {
        type: event.type || event.eventType || 'unknown'
    });

    try {
        const instance = await initEngine();
        const eventType = (event.type || event.eventType || '').toLowerCase();

        if (eventType.includes('order') || eventType.includes('siparis')) {
            await instance.chat(`📦 [${platform.toUpperCase()}] Yeni sipariş olayı: ${eventType}`);
        } else if (eventType.includes('stock') || eventType.includes('stok')) {
            await instance.chat(`📊 [${platform.toUpperCase()}] Stok olayı: ${eventType}`);
        } else if (eventType.includes('return') || eventType.includes('iade')) {
            await instance.chat(`🔄 [${platform.toUpperCase()}] İade talebi alındı`);
        }

        if (instance.memory) {
            instance.memory.remember(`${platform}: ${eventType}`, 'webhook');
        }

        res.json({ received: true, platform, eventType });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. VISION API
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/vision/analyze', async (req, res) => {
    const { image, checkDamage } = req.body;
    if (!image) return res.status(400).json({ error: 'image parametresi gerekli' });

    try {
        const { analyzeProductImage, checkReturnDamage } = await import('../core/vision-service.js');
        const instance = await initEngine();
        const aiConfig = {
            apiKey: instance.env?.OPENAI_API_KEY || instance.env?.GEMINI_API_KEY,
            model: 'gpt-4o'
        };

        const result = checkDamage
            ? await checkReturnDamage(image, aiConfig)
            : await analyzeProductImage(image, aiConfig);
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. QUEUE & MEMORY API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/queue', async (req, res) => {
    const instance = await initEngine();
    res.json(instance.queue ? instance.queue.getStatus() : { error: 'Queue not initialized' });
});

app.get('/api/memory', async (req, res) => {
    const instance = await initEngine();
    if (!instance.memory) return res.json({ error: 'Memory not initialized' });
    res.json({
        factsCount: instance.memory.facts.length,
        strategiesCount: instance.memory.strategies.length,
        recentFacts: instance.memory.getRecentFacts(10),
        strategies: instance.memory.getStrategies()
    });
});

app.post('/api/memory/remember', async (req, res) => {
    const { fact, category } = req.body;
    if (!fact) return res.status(400).json({ error: 'fact gerekli' });
    const instance = await initEngine();
    if (!instance.memory) return res.json({ error: 'Memory not initialized' });
    res.json(instance.memory.remember(fact, category || 'general'));
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. SYSTEM HEALTH DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/dashboard', async (req, res) => {
    try {
        const { getDashboard } = await import('../core/dashboard.js');
        const dash = getDashboard();
        const format = req.query.format;
        if (format === 'text') {
            res.type('text/plain').send(dash.getSummary());
        } else {
            res.json(dash.getHealth());
        }
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
