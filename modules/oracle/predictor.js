// modules/oracle/predictor.js
// Oracle — Predictive Analytics for Vantuz OS V2
// Predicts stockout dates and generates reorder alerts.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from '../../core/ai-provider.js';

const SALES_HISTORY_FILE = path.join(os.homedir(), '.vantuz', 'memory', 'sales-velocity.json');

// ═══════════════════════════════════════════════════════════════════════════
// SALES VELOCITY TRACKER
// ═══════════════════════════════════════════════════════════════════════════

function loadVelocityData() {
    try {
        if (fs.existsSync(SALES_HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(SALES_HISTORY_FILE, 'utf-8'));
        }
    } catch (e) { /* ignore */ }
    return {};
}

function saveVelocityData(data) {
    const dir = path.dirname(SALES_HISTORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = SALES_HISTORY_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, SALES_HISTORY_FILE);
}

// ═══════════════════════════════════════════════════════════════════════════
// ORACLE
// ═══════════════════════════════════════════════════════════════════════════

class Oracle {
    constructor() {
        this.velocityData = loadVelocityData(); // barcode -> { snapshots: [{date, stock}], velocity }
        log('INFO', 'Oracle initialized', { trackedProducts: Object.keys(this.velocityData).length });
    }

    /**
     * Record a stock snapshot for velocity calculation.
     * @param {string} barcode
     * @param {number} stock - Current stock level.
     */
    recordSnapshot(barcode, stock) {
        if (!this.velocityData[barcode]) {
            this.velocityData[barcode] = { snapshots: [], velocity: 0 };
        }

        const entry = this.velocityData[barcode];
        entry.snapshots.push({
            date: new Date().toISOString(),
            stock: parseInt(stock, 10)
        });

        // Keep max 30 snapshots per product
        if (entry.snapshots.length > 30) {
            entry.snapshots = entry.snapshots.slice(-30);
        }

        // Recalculate velocity
        entry.velocity = this._calculateVelocity(entry.snapshots);

        saveVelocityData(this.velocityData);
    }

    /**
     * Record snapshots for multiple products.
     */
    recordBatch(products) {
        for (const p of products) {
            const barcode = p.barcode || p.sku;
            const stock = p.stock || p.quantity || 0;
            if (barcode) this.recordSnapshot(barcode, stock);
        }
    }

    /**
     * Predict stockout date for a product.
     * @param {string} barcode
     * @param {number} currentStock - Current stock (if not in history).
     * @returns {{ barcode, velocity, daysLeft, stockoutDate, severity }}
     */
    predictStockout(barcode, currentStock = null) {
        const entry = this.velocityData[barcode];
        if (!entry || entry.snapshots.length < 2) {
            return {
                barcode,
                velocity: 0,
                daysLeft: null,
                stockoutDate: null,
                severity: 'unknown',
                message: 'Yeterli veri yok — en az 2 snapshot gerekli'
            };
        }

        const stock = currentStock ?? entry.snapshots[entry.snapshots.length - 1].stock;
        const velocity = entry.velocity;

        if (velocity <= 0) {
            return {
                barcode, velocity: 0, daysLeft: Infinity,
                stockoutDate: null, severity: 'safe',
                message: 'Satış hızı sıfır veya negatif — stok azalmıyor'
            };
        }

        const daysLeft = Math.floor(stock / velocity);
        const stockoutDate = new Date();
        stockoutDate.setDate(stockoutDate.getDate() + daysLeft);

        let severity = 'safe';
        if (daysLeft <= 3) severity = 'critical';
        else if (daysLeft <= 7) severity = 'warning';
        else if (daysLeft <= 14) severity = 'attention';

        return {
            barcode,
            currentStock: stock,
            velocity: Math.round(velocity * 100) / 100,
            daysLeft,
            stockoutDate: stockoutDate.toISOString().split('T')[0],
            severity,
            message: this._formatMessage(barcode, daysLeft, velocity, severity)
        };
    }

    /**
     * Generate reorder report for all tracked products.
     * @param {number} criticalDays - Days threshold for "critical" (default: 7).
     * @returns {{ critical: array, warning: array, safe: number }}
     */
    generateReorderReport(criticalDays = 7) {
        const critical = [];
        const warning = [];
        let safe = 0;

        for (const barcode of Object.keys(this.velocityData)) {
            const prediction = this.predictStockout(barcode);

            if (prediction.daysLeft !== null && prediction.daysLeft <= criticalDays) {
                const reorderQty = Math.ceil(prediction.velocity * 30); // 30 days supply
                critical.push({
                    ...prediction,
                    reorderQty,
                    reorderMessage: `⚠️ ${barcode}: ${prediction.daysLeft} gün kaldı! ${reorderQty} adet sipariş ver.`
                });
            } else if (prediction.severity === 'attention') {
                warning.push(prediction);
            } else {
                safe++;
            }
        }

        // Sort by urgency
        critical.sort((a, b) => a.daysLeft - b.daysLeft);

        const report = { critical, warning, safe, generatedAt: new Date().toISOString() };
        log('INFO', 'Reorder report generated', {
            critical: critical.length, warning: warning.length, safe
        });

        return report;
    }

    getStatus() {
        return {
            trackedProducts: Object.keys(this.velocityData).length,
            critical: this.generateReorderReport().critical.length
        };
    }

    // ─────────────────────────────────────────────────────────────────────

    _calculateVelocity(snapshots) {
        if (snapshots.length < 2) return 0;

        const first = snapshots[0];
        const last = snapshots[snapshots.length - 1];
        const daysDiff = (new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24);

        if (daysDiff <= 0) return 0;

        const stockConsumed = first.stock - last.stock;
        return stockConsumed > 0 ? stockConsumed / daysDiff : 0;
    }

    _formatMessage(barcode, daysLeft, velocity, severity) {
        if (severity === 'critical') {
            return `🔴 KRİTİK: ${barcode} — ${daysLeft} gün içinde stok bitecek! (Günlük ${velocity.toFixed(1)} adet satılıyor)`;
        }
        if (severity === 'warning') {
            return `🟡 UYARI: ${barcode} — ${daysLeft} gün stok kaldı. Sipariş planla.`;
        }
        if (severity === 'attention') {
            return `🟠 DİKKAT: ${barcode} — ${daysLeft} gün stok kaldı.`;
        }
        return `🟢 ${barcode} — Stok yeterli (${daysLeft} gün)`;
    }
}

let oracleInstance = null;

export function getOracle() {
    if (!oracleInstance) {
        oracleInstance = new Oracle();
    }
    return oracleInstance;
}

export default Oracle;
