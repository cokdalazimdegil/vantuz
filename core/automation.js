// core/automation.js
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { log, chat as aiChat } from './ai-provider.js';
import { getScheduler } from './scheduler.js';

const VANTUZ_HOME = path.join(os.homedir(), '.vantuz');
const CONFIG_JSON = path.join(VANTUZ_HOME, 'config.json');

const RISKY_KEYWORDS = [
    'güncelle', 'update', 'yayınla', 'publish', 'yayından kaldır', 'unpublish',
    'değiştir', 'change', 'sil', 'kaldır', 'delete', 'remove',
    'fiyatı yap', 'stoğu yap'
];

const APPROVE_KEYWORDS = ['onay', 'onayla', 'kabul', 'evet', 'tamam'];
const REJECT_KEYWORDS = ['hayır', 'iptal', 'vazgeç', 'reddet'];

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_JSON)) {
            return JSON.parse(fs.readFileSync(CONFIG_JSON, 'utf-8'));
        }
    } catch (e) {
        log('WARN', 'Config okunamadı', { error: e.message });
    }
    return {};
}

function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_JSON, JSON.stringify(config, null, 2));
        return true;
    } catch (e) {
        log('WARN', 'Config yazılamadı', { error: e.message });
        return false;
    }
}

function normalizePhone(input) {
    if (!input) return '';
    const cleaned = String(input).replace(/[\s-]/g, '');
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

function messageHasAny(message, keywords) {
    const lower = message.toLowerCase();
    return keywords.some(k => lower.includes(k));
}

function normalizeTr(input) {
    return String(input || '')
        .toLowerCase()
        .replace(/[çÇ]/g, 'c')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[ıİ]/g, 'i')
        .replace(/[öÖ]/g, 'o')
        .replace(/[şŞ]/g, 's')
        .replace(/[üÜ]/g, 'u');
}

function summarizeOrdersByStatus(orders = []) {
    if (!Array.isArray(orders) || orders.length === 0) return '';
    const counts = {};
    orders.forEach(o => {
        const s = (o.status || o.shipmentPackageStatus || o.orderStatus || 'UNKNOWN').toString();
        counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => `${s}:${n}`)
        .join(', ');
}

function isActiveStatus(status) {
    const s = String(status || '').toLowerCase();
    return s === 'created' || s === 'picking' || s === 'unpacked' || s === 'shipped';
}

function extractProductNames(order) {
    const lines = Array.isArray(order?.lines) ? order.lines : [];
    const names = lines
        .map(l => l?.productName || l?.name)
        .filter(Boolean);
    return names;
}

function getOrderTimestamp(order) {
    const candidates = [
        order?.lastModifiedDate,
        order?.agreedDeliveryDate,
        order?.createdDate,
        order?.orderDate
    ];
    for (const value of candidates) {
        if (!value) continue;
        const num = Number(value);
        if (Number.isFinite(num) && num > 0) return num;
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
}

function formatOrderLine(order) {
    const number = order.orderNumber || order.id || 'N/A';
    const name = order.customerName || order.customerfullName || order.customerFullName || 'Müşteri';
    const total = order.totalPrice ?? order.totalAmount ?? order.total ?? '?';
    const status = order.status || order.shipmentPackageStatus || order.orderStatus || 'UNKNOWN';
    return `#${number} - ${name} - ${total} TL - ${status}`;
}

function getTenantId(channel, from) {
    if (channel === 'whatsapp' && from) return normalizePhone(from);
    return 'default';
}

function ensureConfigShape(config) {
    if (!config.tenants) config.tenants = {};
    if (!config.automation) config.automation = {};
    if (!config.automation.approvals) config.automation.approvals = [];
    if (!config.automation.cronJobs) config.automation.cronJobs = [];
    return config;
}

function ensureTenantState(config, tenantId) {
    if (!config.tenants[tenantId]) {
        config.tenants[tenantId] = { riskAccepted: false };
    }
    if (!config.tenants[tenantId].session) {
        config.tenants[tenantId].session = {};
    }
    return config.tenants[tenantId];
}

function toSessionOrder(order) {
    return {
        orderNumber: order.orderNumber || order.id || 'N/A',
        status: order.status || order.shipmentPackageStatus || order.orderStatus || 'UNKNOWN',
        productNames: extractProductNames(order)
    };
}

function storeLastOrders(config, tenantId, orders) {
    const tenant = ensureTenantState(config, tenantId);
    const list = Array.isArray(orders) ? orders.map(toSessionOrder) : [];
    tenant.session.lastOrders = list.slice(0, 20);
    tenant.session.lastOrderAt = new Date().toISOString();
    saveConfig(config);
}

function newApproval(message, meta, kind = 'action') {
    return {
        id: crypto.randomUUID(),
        channel: meta.channel,
        from: meta.from || 'unknown',
        message,
        kind,
        createdAt: new Date().toISOString()
    };
}

function findPendingApproval(config, meta) {
    const approvals = config.automation?.approvals || [];
    const from = meta.from || 'unknown';
    return approvals.find(a => a.from === from && a.channel === meta.channel);
}

function removeApproval(config, approvalId) {
    config.automation.approvals = (config.automation.approvals || []).filter(a => a.id !== approvalId);
}

async function planWithAI(message, engine) {
    const systemPrompt = [
        'Sen Vantuz otomasyon planlayıcısısın.',
        'Kullanıcı mesajını tek bir otomasyon planına çevir ve sadece JSON döndür.',
        'Şema:',
        '{ "intent": "report|analysis|change|schedule|other", "risk": "low|high", "schedule": "", "action": "" }',
        'risk = SADECE veri değiştiren/silen işlemler (update/delete/create) varsa "high" olmalı. Listeleme/okuma işlemleri her zaman "low".',
        'schedule = cron ifadesi (boş olabilir).',
        'action = yapılacak işi kısa Türkçe özetle.'
    ].join('\n');

    const response = await aiChat(message, {
        aiProvider: engine.config.aiProvider || 'gemini',
        systemContext: systemPrompt
    }, engine.env);

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
        return JSON.parse(jsonMatch[0]);
    } catch {
        return null;
    }
}

function fallbackPlan(message) {
    const risky = messageHasAny(message, RISKY_KEYWORDS);
    // Explicitly safe keywords check
    const safeKeywords = ['listele', 'göster', 'nedir', 'kaç', 'ne kadar', 'durum', 'rapor'];
    const safe = messageHasAny(message, safeKeywords);

    const schedule = message.includes('cron ') ? message.split('cron ')[1].trim() : '';
    return {
        intent: schedule ? 'schedule' : (risky ? 'change' : 'analysis'),
        risk: (risky && !safe) ? 'high' : 'low',
        schedule,
        action: message
    };
}

export class AutomationManager {
    constructor(engine) {
        this.engine = engine;
        this.scheduler = getScheduler();
        this.config = ensureConfigShape(loadConfig());
    }

    init() {
        this._restoreCronJobs();
    }

    _restoreCronJobs() {
        const jobs = this.config.automation?.cronJobs || [];
        for (const job of jobs) {
            this._scheduleJob(job, false);
        }
    }

    _scheduleJob(job, persist = true) {
        if (!job?.name || !job?.cron || !job?.message) return;

        this.scheduler.addJob(job.name, job.cron, async () => {
            log('INFO', `Cron job executing: ${job.name}`, { message: job.message });
            await this.engine.chat(job.message);
        }, true);

        if (persist) {
            const exists = this.config.automation.cronJobs.find(j => j.name === job.name);
            if (!exists) {
                this.config.automation.cronJobs.push(job);
                saveConfig(this.config);
            }
        }
    }

    _deleteJob(name) {
        this.scheduler.removeJob(name);
        this.config.automation.cronJobs = this.config.automation.cronJobs.filter(j => j.name !== name && j.name !== `auto-${name}`);
        saveConfig(this.config);
        return true;
    }

    _listJobs() {
        return this.config.automation.cronJobs || [];
    }


    async handleMessage(message, meta = { channel: 'local', from: 'local' }) {
        this.config = ensureConfigShape(loadConfig());

        const lower = String(message || '').toLowerCase();
        const normalized = normalizeTr(message);
        const hasOrderKeyword = lower.includes('sipari?') || normalized.includes('siparis');
        const asksApproved = lower.includes('onaylanan') || normalized.includes('onaylanan');
        const asksUnshipped = lower.includes('kargoya verilmemi?') || lower.includes('hen?z kargoya') || lower.includes('kargoya verilmedi') || normalized.includes('kargoya verilmemis');
        const asksPickingWhich = lower.includes('picking') || normalized.includes('picking');
        const asksOrderNames = lower.includes('sipari?lerin ad?') || normalized.includes('siparislerin adi') || lower.includes('?r?n ad?') || normalized.includes('urun adi') || lower.includes('?r?n?n ad?') || normalized.includes('urunun adi');
        const asksToday = lower.includes('bug?n') || normalized.includes('bugun');
        const asksLast24h = lower.includes('son 24') || normalized.includes('son 24');
        const asksYesterday = lower.includes('d?n') || normalized.includes('dun');
        const asksNeedShipment = lower.includes('kargoya ??kmas?') || lower.includes('kargoya cikmasi') || normalized.includes('kargoya cikmasi');
        const asksWhichProduct = lower.includes('hangi ?r?n') || normalized.includes('hangi urun');

        const tenantId = getTenantId(meta.channel, meta.from);
        ensureTenantState(this.config, tenantId);

        if (asksApproved) {
            const orders = await this.engine.getOrders({ size: 100, status: 'Picking' });
            storeLastOrders(this.config, tenantId, orders);
            return {
                handled: true,
                response: `?u an onaylanan (Picking) ${orders.length} sipari? var.`
            };
        }

        if (asksUnshipped) {
            const orders = await this.engine.getOrders({ size: 100, status: 'Created' });
            storeLastOrders(this.config, tenantId, orders);
            return {
                handled: true,
                response: `?u an kargoya verilmemi? (Created) ${orders.length} sipari? var.`
            };
        }

        if (asksPickingWhich) {
            const orders = await this.engine.getOrders({ size: 100, status: 'Picking' });
            if (!orders || orders.length === 0) {
                return { handled: true, response: 'Picking stat?s?nde sipari? yok.' };
            }
            storeLastOrders(this.config, tenantId, orders);
            const lines = orders.slice(0, 5).map(formatOrderLine).join('\n');
            return { handled: true, response: `Picking sipari?leri:\n${lines}` };
        }

        if (asksNeedShipment) {
            const orders = await this.engine.getOrders({ size: 100, status: 'Created' });
            if (!orders || orders.length === 0) {
                return { handled: true, response: 'Kargoya ??kmas? gereken (Created) sipari? yok.' };
            }
            storeLastOrders(this.config, tenantId, orders);
            const lines = orders.slice(0, 5).map(formatOrderLine).join('\n');
            return { handled: true, response: `Kargoya ??kmas? gereken sipari?ler:\n${lines}` };
        }

        if (asksWhichProduct) {
            const tenant = ensureTenantState(this.config, tenantId);
            const last = tenant.session?.lastOrders || [];
            if (last.length === 1 && last[0].productNames?.length) {
                return { handled: true, response: `?r?n: ${last[0].productNames.join(', ')}` };
            }
            if (last.length > 1) {
                const lines = last.slice(0, 5).map(o => `#${o.orderNumber} - ${o.productNames?.join(', ') || '?r?n ad? yok'}`).join('\n');
                return { handled: true, response: `Hangi sipari?i kastediyorsun?\n${lines}` };
            }
            return { handled: true, response: '?nce sipari?leri g?rmem gerekiyor. "/siparis" yazabilir misin?' };
        }

        if (asksOrderNames) {
            const orders = await this.engine.getOrders({ size: 50, allStatuses: true });
            if (!orders || orders.length === 0) {
                return { handled: true, response: 'Sipari? verisine ula??lamad?.' };
            }
            const active = orders.filter(o => isActiveStatus(o.status || o.shipmentPackageStatus || o.orderStatus));
            const target = active.length > 0 ? active : orders;
            storeLastOrders(this.config, tenantId, target);
            if (target.length === 1) {
                const only = target[0];
                const names = extractProductNames(only);
                if (names.length > 0) {
                    return { handled: true, response: `?r?n adlar?: ${names.join(', ')}` };
                }
            }
            const productLines = target
                .map(o => {
                    const names = extractProductNames(o);
                    const number = o.orderNumber || o.id || 'N/A';
                    if (names.length === 0) return null;
                    return `#${number} - ${names.join(', ')}`;
                })
                .filter(Boolean)
                .slice(0, 10)
                .join('\n');
            if (!productLines) {
                const fallback = target.slice(0, 10).map(formatOrderLine).join('\n');
                return { handled: true, response: `Sipari?ler:\n${fallback}` };
            }
            return { handled: true, response: `?r?n adlar?:\n${productLines}` };
        }

        if (asksYesterday) {
            const orders = await this.engine.getOrders({ size: 200, allStatuses: true });
            if (!orders || orders.length === 0) {
                return { handled: true, response: 'Sipari? verisine ula??lamad?.' };
            }
            const now = Date.now();
            const end = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
            const start = end - 24 * 60 * 60 * 1000;
            const filtered = orders.filter(o => {
                const ts = getOrderTimestamp(o);
                return ts && ts >= start && ts < end;
            });
            if (filtered.length === 0) {
                return { handled: true, response: 'D?n sipari? yok.' };
            }
            const wantsShipped = lower.includes('g?nder') || normalized.includes('gonder') || lower.includes('kargoya') || normalized.includes('kargoya');
            const shippedOnly = wantsShipped ? filtered.filter(o => {
                const s = String(o.status || o.shipmentPackageStatus || o.orderStatus || '').toLowerCase();
                return s === 'shipped' || s === 'delivered';
            }) : filtered;
            const target = shippedOnly.length > 0 ? shippedOnly : filtered;
            storeLastOrders(this.config, tenantId, target);
            const productLines = target
                .map(o => {
                    const names = extractProductNames(o);
                    const number = o.orderNumber || o.id || 'N/A';
                    if (names.length === 0) return null;
                    return `#${number} - ${names.join(', ')}`;
                })
                .filter(Boolean)
                .slice(0, 10)
                .join('\n');
            if (productLines) {
                return { handled: true, response: `D?nk? ?r?nler:\n${productLines}` };
            }
            const lines = target.slice(0, 10).map(formatOrderLine).join('\n');
            return { handled: true, response: `D?nk? sipari?ler:\n${lines}` };
        }

        if (asksToday || asksLast24h) {
            const orders = await this.engine.getOrders({ size: 200, allStatuses: true });
            if (!orders || orders.length === 0) {
                return { handled: true, response: 'Sipari? verisine ula??lamad?.' };
            }
            const now = Date.now();
            const start = asksToday
                ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
                : now - 24 * 60 * 60 * 1000;
            const filtered = orders.filter(o => {
                const ts = getOrderTimestamp(o);
                return ts && ts >= start && ts <= now;
            });
            if (filtered.length === 0) {
                return { handled: true, response: 'Belirtilen aral?kta sipari? yok.' };
            }
            storeLastOrders(this.config, tenantId, filtered);
            const lines = filtered.slice(0, 10).map(formatOrderLine).join('\n');
            return { handled: true, response: `Sipari?ler:\n${lines}` };
        }

        if (lower.includes('sipari? var m?') || normalized.includes('siparis var mi') || lower.includes('sipari? varmi') || normalized.includes('siparis varmi')) {
            const orders = await this.engine.getOrders({ size: 100, allStatuses: true });
            if (!orders || orders.length === 0) {
                return { handled: true, response: 'Sipari? verisine ula??lamad?. L?tfen platform API ba?lant?lar?n? kontrol edin.' };
            }
            const active = orders.filter(o => isActiveStatus(o.status || o.shipmentPackageStatus || o.orderStatus));
            if (active.length === 0) {
                return { handled: true, response: '?u an aktif (Created/Picking/UnPacked) sipari? yok.' };
            }
            const summary = summarizeOrdersByStatus(active);
            storeLastOrders(this.config, tenantId, active);
            return { handled: true, response: `?u an ba?l? platformlardan gelen toplam ${active.length} aktif sipari? var.${summary ? ` Durum k?r?l?m?: ${summary}` : ''}` };
        }

        if (hasOrderKeyword) {
            const orders = await this.engine.getOrders({ size: 100, allStatuses: true });
            if (!orders || orders.length === 0) {
                return {
                    handled: true,
                    response: 'Sipari? verisine ula??lamad?. L?tfen platform API ba?lant?lar?n? kontrol edin.'
                };
            }
            const active = orders.filter(o => isActiveStatus(o.status || o.shipmentPackageStatus || o.orderStatus));
            const summary = summarizeOrdersByStatus(active);
            storeLastOrders(this.config, tenantId, active);
            return {
                handled: true,
                response: `?u an ba?l? platformlardan gelen toplam ${active.length} sipari? var.${summary ? ` Durum k?r?l?m?: ${summary}` : ''}`
            };
        }

        const tenant = ensureTenantState(this.config, tenantId);

        const pending = findPendingApproval(this.config, meta);
        if (pending) {
            if (messageHasAny(message, APPROVE_KEYWORDS)) {
                removeApproval(this.config, pending.id);
                if (pending.kind === 'risk-accept') {
                    tenant.riskAccepted = true;
                    saveConfig(this.config);
                    const approval = newApproval(pending.message, meta, 'action');
                    this.config.automation.approvals.push(approval);
                    saveConfig(this.config);
                    return {
                        handled: true,
                        response: 'Risk kabul edildi. ??lemi onaylamak i?in "Evet" yaz.'
                    };
                }
                saveConfig(this.config);
                const result = await this.engine.chat(pending.message);
                return { handled: true, response: `Onay al?nd?.\n\n${result}` };
            }
            if (messageHasAny(message, REJECT_KEYWORDS)) {
                removeApproval(this.config, pending.id);
                saveConfig(this.config);
                return { handled: true, response: '??lem iptal edildi.' };
            }
        }

        const plan = (await planWithAI(message, this.engine)) || fallbackPlan(message);
        const risky = plan.risk === 'high';

        if (risky && !tenant.riskAccepted) {
            const approval = newApproval(message, meta, 'risk-accept');
            this.config.automation.approvals.push(approval);
            saveConfig(this.config);
            return {
                handled: true,
                response: 'Bu i?lem pazaryerlerinde de?i?iklik yapabilir ve risklidir. Riskleri kabul ediyor musun? "Evet" yaz.'
            };
        }

        if (risky) {
            const approval = newApproval(message, meta, 'action');
            this.config.automation.approvals.push(approval);
            saveConfig(this.config);
            return {
                handled: true,
                response: `Bu i?lem riskli g?r?n?yor.\nOnaylamak i?in "Evet" yaz.`
            };
        }

        if (plan.intent === 'schedule' && plan.schedule) {
            const job = {
                name: `auto-${crypto.randomUUID().slice(0, 8)}`,
                cron: plan.schedule,
                message: plan.action || message
            };
            this._scheduleJob(job, true);
            return {
                handled: true,
                response: `Zamanl? g?rev olu?turuldu: ${job.name}\nCron: ${job.cron}`
            };
        }

        return { handled: false };
    }
}

export default AutomationManager;
