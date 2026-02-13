// core/dashboard.js
// System Health Dashboard — Vantuz OS V2 Control Tower
// Aggregates status from all modules into a single real-time overview.

import os from 'os';
import { log } from './ai-provider.js';

// ═══════════════════════════════════════════════════════════════════════════
// UPTIME TRACKER
// ═══════════════════════════════════════════════════════════════════════════

const BOOT_TIME = Date.now();

function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}g`);
    if (hours > 0) parts.push(`${hours}s`);
    parts.push(`${minutes}dk`);
    return parts.join(' ');
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

class Dashboard {
    constructor() {
        this.moduleRefs = {};   // name -> getter function
        this.customMetrics = {}; // name -> { value, updatedAt }
        this.alerts = [];        // { level, message, timestamp }
        log('INFO', '📊 Dashboard initialized');
    }

    /**
     * Register a module for health reporting.
     * @param {string} name - Module name (e.g., 'warroom', 'oracle').
     * @param {function} statusFn - Function that returns module status object.
     */
    registerModule(name, statusFn) {
        this.moduleRefs[name] = statusFn;
    }

    /**
     * Set a custom metric (can be called from anywhere).
     */
    setMetric(name, value) {
        this.customMetrics[name] = { value, updatedAt: new Date().toISOString() };
    }

    /**
     * Push a dashboard alert.
     */
    pushAlert(level, message) {
        this.alerts.push({
            level, // 'info', 'warning', 'critical'
            message,
            timestamp: new Date().toISOString()
        });
        // Keep last 50
        if (this.alerts.length > 50) this.alerts = this.alerts.slice(-50);
    }

    /**
     * Get full system health report.
     * @returns {object} Complete health snapshot.
     */
    getHealth() {
        const uptimeMs = Date.now() - BOOT_TIME;

        // ── System Info ──
        const system = {
            uptime: formatUptime(uptimeMs),
            uptimeMs,
            bootTime: new Date(BOOT_TIME).toISOString(),
            memory: {
                total: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
                free: Math.round(os.freemem() / 1024 / 1024) + ' MB',
                usage: Math.round((1 - os.freemem() / os.totalmem()) * 100) + '%'
            },
            platform: os.platform(),
            nodeVersion: process.version
        };

        // ── Module Status ──
        const modules = {};
        for (const [name, statusFn] of Object.entries(this.moduleRefs)) {
            try {
                modules[name] = { status: 'online', ...statusFn() };
            } catch (e) {
                modules[name] = { status: 'error', error: e.message };
            }
        }

        // ── Overall Health Score ──
        const moduleCount = Object.keys(modules).length;
        const onlineCount = Object.values(modules).filter(m => m.status === 'online').length;
        const healthPercent = moduleCount > 0 ? Math.round((onlineCount / moduleCount) * 100) : 0;

        let overallStatus = '🟢 Healthy';
        if (healthPercent < 100) overallStatus = '🟡 Degraded';
        if (healthPercent < 50) overallStatus = '🔴 Critical';

        return {
            overallStatus,
            healthPercent,
            system,
            modules,
            metrics: this.customMetrics,
            recentAlerts: this.alerts.slice(-10),
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * Get a human-readable summary (for TUI / AI context).
     */
    getSummary() {
        const h = this.getHealth();
        const lines = [
            `${h.overallStatus} | Uptime: ${h.system.uptime} | RAM: ${h.system.memory.usage}`,
            `Modüller: ${h.healthPercent}% online (${Object.keys(h.modules).length} kayıtlı)`,
            ''
        ];

        for (const [name, mod] of Object.entries(h.modules)) {
            const icon = mod.status === 'online' ? '✅' : '❌';
            const details = [];

            // Module-specific summary lines
            if (mod.autonomous !== undefined) {
                details.push(mod.autonomous ? 'Otonom' : '⚠️ Manuel Mod');
            }
            if (mod.netScore !== undefined) {
                details.push(`Skor: ${mod.netScore}`);
            }
            if (mod.totalErrors !== undefined) {
                details.push(`Hata: ${mod.totalErrors}`);
            }
            if (mod.trackedProducts !== undefined) {
                details.push(`Takip: ${mod.trackedProducts} ürün`);
            }
            if (mod.critical !== undefined) {
                details.push(`Kritik: ${mod.critical}`);
            }
            if (mod.recentDecisions !== undefined) {
                details.push(`Karar: ${mod.recentDecisions}`);
            }
            if (mod.killSwitch?.active) {
                details.push('🛑 KILL SWITCH AKTİF');
            }
            if (mod.activeModules !== undefined) {
                details.push(`Aktif: ${mod.activeModules}/${mod.totalModules}`);
            }
            if (mod.running !== undefined) {
                details.push(mod.running ? '🫀 Çalışıyor' : '⏸️ Durdu');
            }
            if (mod.avgScore !== undefined) {
                details.push(`Sağlık: ${mod.avgScore}/100`);
            }
            if (mod.totalProcessed !== undefined) {
                details.push(`İşlenen: ${mod.totalProcessed}`);
            }
            if (mod.escalatedCount !== undefined && mod.escalatedCount > 0) {
                details.push(`🚨 Eskalasyon: ${mod.escalatedCount}`);
            }

            lines.push(`${icon} ${name}: ${details.join(' | ') || mod.status}`);
        }

        // Custom metrics
        if (Object.keys(h.metrics).length > 0) {
            lines.push('', '📈 Metrikler:');
            for (const [name, m] of Object.entries(h.metrics)) {
                lines.push(`   ${name}: ${m.value}`);
            }
        }

        // Recent alerts
        const criticalAlerts = h.recentAlerts.filter(a => a.level === 'critical');
        if (criticalAlerts.length > 0) {
            lines.push('', '🚨 Kritik Uyarılar:');
            for (const a of criticalAlerts.slice(-3)) {
                lines.push(`   ${a.message}`);
            }
        }

        return lines.join('\n');
    }
}

let dashboardInstance = null;

export function getDashboard() {
    if (!dashboardInstance) {
        dashboardInstance = new Dashboard();
    }
    return dashboardInstance;
}

/**
 * Helper: Wire up all V2 modules to the dashboard.
 * Call this after all modules are initialized.
 */
export function wireModulesToDashboard(refs = {}) {
    const dash = getDashboard();

    if (refs.agentLoop) dash.registerModule('AgentLoop', () => refs.agentLoop.getStatus());
    if (refs.pricingEngine) dash.registerModule('WarRoom', () => refs.pricingEngine.getStatus());
    if (refs.oracle) dash.registerModule('Oracle', () => refs.oracle.getStatus());
    if (refs.crm) dash.registerModule('CRM', () => refs.crm.getStatus());
    if (refs.healer) dash.registerModule('ListingHealer', () => refs.healer.getStatus());
    if (refs.selfHealer) dash.registerModule('SelfHealer', () => refs.selfHealer.getStatus());
    if (refs.learning) dash.registerModule('Learning', () => refs.learning.getStatus());
    if (refs.researcher) dash.registerModule('Researcher', () => refs.researcher.getStatus());
    if (refs.queue) dash.registerModule('Queue', () => refs.queue.getStatus());
    if (refs.memory) dash.registerModule('Memory', () => ({
        factsCount: refs.memory.facts?.length || 0,
        strategiesCount: refs.memory.strategies?.length || 0
    }));

    log('INFO', `📊 Dashboard wired: ${Object.keys(refs).length} modules`);
    return dash;
}

export default Dashboard;
