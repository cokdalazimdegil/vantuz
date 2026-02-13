// core/queue.js
// Critical Operation Queue (Lane Queue) for Vantuz AI
// Ensures write operations (price/stock updates) execute serially, never in parallel.

import { log } from './ai-provider.js';

class CriticalQueue {
    constructor() {
        this._queue = [];
        this._running = false;
        this._stats = { processed: 0, errors: 0, lastRun: null };
        log('INFO', 'CriticalQueue (Lane Queue) initialized');
    }

    /**
     * Enqueue a critical operation.
     * @param {string} label - Human readable label (e.g. "Fiyat güncelle: SKU-123")
     * @param {function} fn - Async function to execute.
     * @param {object} options - { priority: 'high'|'normal', dryRun: false }
     * @returns {Promise} Resolves when the operation completes.
     */
    enqueue(label, fn, options = {}) {
        const { priority = 'normal', dryRun = false } = options;

        return new Promise((resolve, reject) => {
            const task = { label, fn, resolve, reject, priority, dryRun, enqueuedAt: Date.now() };

            if (priority === 'high') {
                // Insert at the front (after any currently running task)
                this._queue.unshift(task);
            } else {
                this._queue.push(task);
            }

            log('INFO', `Operation queued: "${label}"`, {
                position: this._queue.length,
                dryRun,
                priority
            });

            this._processNext();
        });
    }

    /**
     * Process the next item in the queue.
     */
    async _processNext() {
        if (this._running || this._queue.length === 0) return;

        this._running = true;
        const task = this._queue.shift();

        log('INFO', `▶ Executing: "${task.label}"`, {
            waitedMs: Date.now() - task.enqueuedAt,
            remaining: this._queue.length
        });

        try {
            if (task.dryRun) {
                log('INFO', `[DRY RUN] Would execute: "${task.label}"`);
                task.resolve({ dryRun: true, label: task.label, status: 'skipped' });
            } else {
                const result = await task.fn();
                this._stats.processed++;
                this._stats.lastRun = new Date().toISOString();
                task.resolve(result);
            }
        } catch (error) {
            this._stats.errors++;
            log('ERROR', `✘ Failed: "${task.label}"`, { error: error.message });
            task.reject(error);
        } finally {
            this._running = false;
            // Process next in queue
            if (this._queue.length > 0) {
                // Small delay to prevent tight loops
                setTimeout(() => this._processNext(), 50);
            }
        }
    }

    /**
     * Get queue status.
     */
    getStatus() {
        return {
            queueLength: this._queue.length,
            isRunning: this._running,
            pendingLabels: this._queue.map(t => t.label),
            stats: { ...this._stats }
        };
    }

    /**
     * Drain the queue (cancel all pending, don't cancel running).
     */
    drain() {
        const cancelled = this._queue.length;
        this._queue.forEach(t => t.reject(new Error('Queue drained')));
        this._queue = [];
        log('WARN', `Queue drained, ${cancelled} operations cancelled`);
        return cancelled;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let queueInstance = null;

export function getCriticalQueue() {
    if (!queueInstance) {
        queueInstance = new CriticalQueue();
    }
    return queueInstance;
}

export default CriticalQueue;
