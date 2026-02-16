// core/self-healer.js
// Self-Healing Module for Vantuz OS V2
// Monitors errors, auto-repairs simple issues, and rolls back broken states.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from './ai-provider.js';

const SNAPSHOT_DIR = path.join(os.homedir(), '.vantuz', 'snapshots');
const ERROR_LOG_FILE = path.join(os.homedir(), '.vantuz', 'memory', 'error-log.json');

// ═══════════════════════════════════════════════════════════════════════════
// ERROR CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

const AUTO_FIXABLE = {
    'ETIMEDOUT': { fix: 'retry', description: 'Timeout — tekrar deneniyor' },
    'ECONNRESET': { fix: 'retry', description: 'Bağlantı koptu — tekrar deneniyor' },
    'ECONNREFUSED': { fix: 'retry_delay', description: 'Bağlantı reddedildi — gecikmeli tekrar' },
    'ERR_BAD_REQUEST': { fix: 'inspect', description: 'Hatalı istek — parametre kontrolü' },
    '401': { fix: 'refresh_token', description: 'Auth hatası — token yenileniyor' },
    '403': { fix: 'refresh_token', description: 'Yetki hatası — token yenileniyor' },
    '429': { fix: 'backoff', description: 'Rate limit — bekleniyor' },
    '500': { fix: 'retry_delay', description: 'Sunucu hatası — gecikmeli tekrar' },
    '503': { fix: 'retry_delay', description: 'Servis dışı — gecikmeli tekrar' },
    'SyntaxError': { fix: 'rollback', description: 'JSON parse hatası — rollback' },
};

// ═══════════════════════════════════════════════════════════════════════════
// SELF HEALER
// ═══════════════════════════════════════════════════════════════════════════

class SelfHealer {
    constructor() {
        this.errorLog = this._loadErrorLog();
        this.escalationCallbacks = [];
        this.maxRetries = 3;
        this._ensureDirs();
        log('INFO', 'SelfHealer initialized', { knownErrors: this.errorLog.length });
    }

    _ensureDirs() {
        if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
        const memDir = path.dirname(ERROR_LOG_FILE);
        if (!fs.existsSync(memDir)) fs.mkdirSync(memDir, { recursive: true });
    }

    /**
     * Register escalation handler for un-fixable errors.
     */
    onEscalation(callback) {
        this.escalationCallbacks.push(callback);
    }

    // ─────────────────────────────────────────────────────────────────────
    // STATE SNAPSHOTS (Rollback Support)
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Save a state snapshot before a risky operation.
     * @param {string} name - Snapshot name (e.g., 'pricing-run-2026-02-13').
     * @param {object} state - State data to snapshot.
     */
    saveSnapshot(name, state) {
        const file = path.join(SNAPSHOT_DIR, `${name}.json`);
        fs.writeFileSync(file, JSON.stringify({
            name,
            timestamp: new Date().toISOString(),
            state
        }, null, 2), 'utf-8');
        log('INFO', `Snapshot saved: ${name}`);
    }

    /**
     * Load a snapshot by name.
     */
    loadSnapshot(name) {
        const file = path.join(SNAPSHOT_DIR, `${name}.json`);
        if (!fs.existsSync(file)) return null;
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }

    /**
     * List available snapshots.
     */
    listSnapshots() {
        if (!fs.existsSync(SNAPSHOT_DIR)) return [];
        return fs.readdirSync(SNAPSHOT_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const data = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, f), 'utf-8'));
                return { name: data.name, timestamp: data.timestamp };
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Rollback: restore state from the last snapshot.
     * @param {string} name - Snapshot name to restore.
     * @returns {object|null} The restored state, or null if not found.
     */
    rollback(name) {
        const snapshot = this.loadSnapshot(name);
        if (!snapshot) {
            log('WARN', `Rollback failed: snapshot "${name}" not found`);
            return null;
        }
        log('INFO', `🔄 ROLLBACK: "${name}" snapshot'ına geri dönüldü. Devam ediyorum.`, {
            snapshotTime: snapshot.timestamp
        });
        return snapshot.state;
    }

    // ─────────────────────────────────────────────────────────────────────
    // ERROR HANDLING + AUTO-REPAIR
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Attempt to heal an error.
     * @param {Error|object} error - The error object.
     * @param {string} module - Which module threw the error.
     * @param {function} retryFn - Function to retry if applicable.
     * @returns {{ healed: boolean, action: string, result?: any }}
     */
    async heal(error, module, retryFn = null) {
        const errorCode = this._classifyError(error);
        const fixEntry = AUTO_FIXABLE[errorCode];

        this._logError(error, module, errorCode);

        if (!fixEntry) {
            // Unfixable → escalate
            this._escalate(error, module, errorCode);
            return { healed: false, action: 'escalated', message: 'Manuel müdahale gerekiyor' };
        }

        log('INFO', `SelfHealer: ${fixEntry.description}`, { module, errorCode });

        switch (fixEntry.fix) {
            case 'retry':
                return await this._retry(retryFn, 1000);

            case 'retry_delay':
                return await this._retry(retryFn, 5000);

            case 'backoff':
                return await this._retry(retryFn, 30000); // 30 sec backoff

            case 'refresh_token':
                log('WARN', 'Token yenileme denemesi yapılıyor...', { module });
                return await this._retry(retryFn, 2000);

            case 'rollback':
                const snapshots = this.listSnapshots();
                if (snapshots.length > 0) {
                    const restored = this.rollback(snapshots[0].name);
                    return {
                        healed: !!restored,
                        action: 'rollback',
                        message: restored
                            ? `Geri aldım, devam ediyorum (${snapshots[0].name})`
                            : 'Rollback başarısız'
                    };
                }
                return { healed: false, action: 'rollback_failed', message: 'Snapshot bulunamadı' };

            case 'inspect':
                return { healed: false, action: 'needs_inspection', message: fixEntry.description };

            default:
                return { healed: false, action: 'unknown', message: 'Bilinmeyen fix tipi' };
        }
    }

    /**
     * Wrap an async operation with self-healing.
     * @param {string} module - Module name for logging.
     * @param {function} fn - Async function to execute.
     * @param {string} snapshotName - Optional: snapshot name for rollback support.
     * @param {object} snapshotState - Optional: state to snapshot before execution.
     */
    async withHealing(module, fn, snapshotName = null, snapshotState = null) {
        // Save snapshot if provided
        if (snapshotName && snapshotState) {
            this.saveSnapshot(snapshotName, snapshotState);
        }

        try {
            return await fn();
        } catch (error) {
            log('WARN', `Error caught by SelfHealer in ${module}`, { error: error.message });
            const healResult = await this.heal(error, module, fn);

            if (healResult.healed) {
                log('INFO', `✅ ${module}: Hata düzeltildi — ${healResult.message || healResult.action}`);
                return healResult.result;
            } else {
                log('ERROR', `❌ ${module}: Hata düzeltilemedi — ${healResult.message || healResult.action}`);
                throw error; // Re-throw if we can't fix
            }
        }
    }

    getStatus() {
        const recent = this.errorLog.slice(-20);
        return {
            totalErrors: this.errorLog.length,
            recentErrors: recent.length,
            snapshots: this.listSnapshots().length,
            autoFixable: recent.filter(e => AUTO_FIXABLE[e.code]).length,
            escalated: recent.filter(e => !AUTO_FIXABLE[e.code]).length
        };
    }

    // ─────────────────────────────────────────────────────────────────────

    _classifyError(error) {
        const msg = (error.message || error.toString()).toUpperCase();
        const status = error.response?.status || error.status || error.code;

        // Check status code first
        if (status && AUTO_FIXABLE[String(status)]) return String(status);

        // Check error code
        if (error.code && AUTO_FIXABLE[error.code]) return error.code;

        // Check message patterns
        if (msg.includes('ETIMEDOUT') || msg.includes('TIMEOUT')) return 'ETIMEDOUT';
        if (msg.includes('ECONNRESET')) return 'ECONNRESET';
        if (msg.includes('ECONNREFUSED')) return 'ECONNREFUSED';
        if (msg.includes('SYNTAXERROR') || msg.includes('UNEXPECTED TOKEN')) return 'SyntaxError';
        if (msg.includes('429') || msg.includes('RATE LIMIT')) return '429';

        return 'UNKNOWN';
    }

    async _retry(fn, delayMs) {
        if (!fn) return { healed: false, action: 'no_retry_fn', message: 'Retry fonksiyonu yok' };

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                await new Promise(r => setTimeout(r, delayMs * attempt));
                const result = await fn();
                return { healed: true, action: 'retry', attempt, result };
            } catch (e) {
                if (attempt === this.maxRetries) {
                    return { healed: false, action: 'retry_exhausted', message: `${this.maxRetries} deneme başarısız` };
                }
            }
        }
    }

    _logError(error, module, code) {
        this.errorLog.push({
            module,
            code,
            message: error.message || String(error),
            timestamp: new Date().toISOString()
        });

        if (this.errorLog.length > 500) {
            this.errorLog = this.errorLog.slice(-500);
        }

        this._saveErrorLog();
    }

    _loadErrorLog() {
        try {
            if (fs.existsSync(ERROR_LOG_FILE)) {
                return JSON.parse(fs.readFileSync(ERROR_LOG_FILE, 'utf-8'));
            }
        } catch (e) { /* ignore */ }
        return [];
    }

    _saveErrorLog() {
        try {
            const tmp = ERROR_LOG_FILE + '.tmp';
            fs.writeFileSync(tmp, JSON.stringify(this.errorLog, null, 2), 'utf-8');
            fs.renameSync(tmp, ERROR_LOG_FILE);
        } catch (e) { /* ignore */ }
    }

    _escalate(error, module, code) {
        const ticket = {
            type: 'SUPPORT_TICKET',
            severity: 'critical',
            module,
            errorCode: code,
            message: error.message || String(error),
            timestamp: new Date().toISOString(),
            note: `Kritik hata: ${module}. Otomatik düzeltme başarısız. Müdahale gerekli.`
        };

        log('ERROR', `🎫 SUPPORT TICKET: ${module} — ${code}`, ticket);

        for (const cb of this.escalationCallbacks) {
            try { cb(ticket); } catch (e) { /* swallow */ }
        }
    }
}

let healerInstance = null;

export function getSelfHealer() {
    if (!healerInstance) {
        healerInstance = new SelfHealer();
    }
    return healerInstance;
}

export default SelfHealer;
