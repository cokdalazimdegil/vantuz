// core/agent-loop.js
// The Heartbeat of Vantuz OS V2 — Autonomous Agent Loop
// Cron-driven cycle that orchestrates all intelligence modules.

import { log } from './ai-provider.js';
import { getLearning } from './learning.js';
import { getSelfHealer } from './self-healer.js';
import { CronJob } from 'cron';

// ═══════════════════════════════════════════════════════════════════════════
// AGENT LOOP
// ═══════════════════════════════════════════════════════════════════════════

class AgentLoop {
    constructor() {
        this.modules = new Map();  // name -> { fn, interval, enabled }
        this.cronJobs = new Map(); // name -> CronJob instance
        this.running = false;
        this.lastRun = {};         // name -> timestamp
        this.results = {};         // name -> last result
        this.healer = getSelfHealer();
        this.learning = getLearning();

        log('INFO', '🫀 AgentLoop initialized');
    }

    /**
     * Register a module to run in the loop.
     * @param {string} name - Module name (e.g., 'warroom', 'oracle').
     * @param {function} fn - Async function to execute.
     * @param {string} cronExpr - Cron expression (default: every 30 min).
     * @param {boolean} enabled - Start enabled? (default: true).
     */
    register(name, fn, cronExpr = '*/30 * * * *', enabled = true) {
        this.modules.set(name, { fn, cronExpr, enabled });
        log('INFO', `AgentLoop: registered "${name}" (${cronExpr}, ${enabled ? 'enabled' : 'disabled'})`);
    }

    /**
     * Start the loop — creates cron jobs for all registered modules.
     */
    start() {
        if (this.running) {
            log('WARN', 'AgentLoop already running');
            return;
        }

        for (const [name, mod] of this.modules) {
            if (!mod.enabled) continue;

            const job = new CronJob(mod.cronExpr, async () => {
                await this._executeModule(name);
            }, null, false, 'Europe/Istanbul');

            this.cronJobs.set(name, job);
            job.start();
        }

        this.running = true;
        log('INFO', `🫀 AgentLoop STARTED — ${this.cronJobs.size} modules active`);
    }

    /**
     * Stop the loop.
     */
    stop() {
        for (const [name, job] of this.cronJobs) {
            job.stop();
        }
        this.cronJobs.clear();
        this.running = false;
        log('INFO', '🫀 AgentLoop STOPPED');
    }

    /**
     * Enable/disable a module.
     */
    setEnabled(name, enabled) {
        const mod = this.modules.get(name);
        if (mod) {
            mod.enabled = enabled;
            const job = this.cronJobs.get(name);
            if (job) {
                enabled ? job.start() : job.stop();
            }
            log('INFO', `AgentLoop: "${name}" ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    /**
     * Manually trigger a module immediately.
     */
    async trigger(name) {
        if (!this.modules.has(name)) {
            return { error: `Module "${name}" not found` };
        }
        return await this._executeModule(name);
    }

    /**
     * Run all modules once (manual full cycle).
     */
    async runFullCycle() {
        log('INFO', '🫀 Full cycle triggered manually');
        const results = {};
        for (const [name, mod] of this.modules) {
            if (mod.enabled) {
                results[name] = await this._executeModule(name);
            }
        }
        return results;
    }

    getStatus() {
        const moduleStatus = {};
        for (const [name, mod] of this.modules) {
            moduleStatus[name] = {
                enabled: mod.enabled,
                cronExpr: mod.cronExpr,
                lastRun: this.lastRun[name] || null,
                lastResult: this.results[name] ? 'OK' : null
            };
        }

        return {
            running: this.running,
            autonomous: this.learning.isAutonomous(),
            netScore: this.learning.getNetScore(),
            activeModules: [...this.modules.entries()].filter(([_, m]) => m.enabled).length,
            totalModules: this.modules.size,
            modules: moduleStatus
        };
    }

    // ─────────────────────────────────────────────────────────────────────

    async _executeModule(name) {
        const mod = this.modules.get(name);
        if (!mod) return null;

        // Autonomy check
        if (!this.learning.isAutonomous()) {
            log('WARN', `AgentLoop: "${name}" skipped — otonom mod kapalı (skor: ${this.learning.getNetScore()})`);
            return { skipped: true, reason: 'Autonomous mode disabled' };
        }

        log('INFO', `AgentLoop: executing "${name}"`);
        const startTime = Date.now();

        try {
            // Execute with self-healing wrapper
            const result = await this.healer.withHealing(
                `agent-loop/${name}`,
                () => mod.fn(),
                `agent-loop-${name}`,
                { module: name, timestamp: new Date().toISOString() }
            );

            const duration = Date.now() - startTime;
            this.lastRun[name] = new Date().toISOString();
            this.results[name] = result;

            // Positive learning
            this.learning.record('successful_price_update', `${name} başarılı (${duration}ms)`, name);

            log('INFO', `AgentLoop: "${name}" completed in ${duration}ms`);
            return result;

        } catch (e) {
            const duration = Date.now() - startTime;

            // Negative learning
            this.learning.record('listing_error', `${name} hata: ${e.message}`, name);

            log('ERROR', `AgentLoop: "${name}" failed after ${duration}ms`, { error: e.message });
            return { error: e.message };
        }
    }
}

let loopInstance = null;

export function getAgentLoop() {
    if (!loopInstance) {
        loopInstance = new AgentLoop();
    }
    return loopInstance;
}

export default AgentLoop;
