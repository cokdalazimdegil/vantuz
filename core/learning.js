// core/learning.js
// Reinforcement Learning Module for Vantuz OS V2
// Weighted scoring system — tracks AI decisions and adjusts behavior.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from './ai-provider.js';

const LEARNING_FILE = path.join(os.homedir(), '.vantuz', 'memory', 'learning.json');

// ═══════════════════════════════════════════════════════════════════════════
// WEIGHTED SCORE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const SCORE_WEIGHTS = {
    // Positive Outcomes (Ödül)
    'successful_price_update': +1,
    'successful_stock_update': +1,
    'good_prediction': +2,
    'user_approval': +3,
    'successful_auto_reply': +1,
    'sale_after_optimization': +2,

    // Negative Outcomes (Ceza)
    'price_increase_rejected': -2,
    'stock_error': -5,           // Stok hataları kritik
    'user_rejection': -3,
    'wrong_prediction': -1,
    'listing_error': -2,
    'kill_switch_triggered': -4,
    'escalated_customer': -2,

    // Custom (Kullanıcı tanımlı)
    'custom_positive': +1,
    'custom_negative': -1
};

// ═══════════════════════════════════════════════════════════════════════════
// AUTONOMOUS MODE CONTROL
// ═══════════════════════════════════════════════════════════════════════════

const AUTONOMY_THRESHOLD = -10; // Below this → manual mode

// ═══════════════════════════════════════════════════════════════════════════
// LEARNING MODULE
// ═══════════════════════════════════════════════════════════════════════════

class LearningModule {
    constructor() {
        this.data = this._load();
        log('INFO', 'LearningModule initialized', {
            netScore: this.data.netScore,
            totalEvents: this.data.events.length,
            autonomousMode: this.isAutonomous()
        });
    }

    _load() {
        try {
            if (fs.existsSync(LEARNING_FILE)) {
                return JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf-8'));
            }
        } catch (e) { /* ignore */ }
        return {
            netScore: 0,
            events: [],
            autonomousModeOverride: null, // null = auto, true/false = manual override
            categoryScores: {} // per-category running totals
        };
    }

    _save() {
        const dir = path.dirname(LEARNING_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const tmp = LEARNING_FILE + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
        fs.renameSync(tmp, LEARNING_FILE);
    }

    /**
     * Record a learning event.
     * @param {string} eventType - Event type (must be in SCORE_WEIGHTS or 'custom_*').
     * @param {string} context - Human-readable context.
     * @param {string} category - Category for grouping (e.g., 'pricing', 'stock').
     */
    record(eventType, context = '', category = 'general') {
        const weight = SCORE_WEIGHTS[eventType];
        if (weight === undefined) {
            log('WARN', `Unknown learning event type: ${eventType}`);
            return;
        }

        const event = {
            type: eventType,
            weight,
            context,
            category,
            timestamp: new Date().toISOString()
        };

        this.data.events.push(event);
        this.data.netScore += weight;

        // Category scoring
        if (!this.data.categoryScores[category]) {
            this.data.categoryScores[category] = 0;
        }
        this.data.categoryScores[category] += weight;

        // Trim old events (keep last 500)
        if (this.data.events.length > 500) {
            this.data.events = this.data.events.slice(-500);
        }

        this._save();

        // Check autonomy
        if (!this.isAutonomous()) {
            log('WARN', `⚠️ OTONOM MOD KAPANDI! Net skor: ${this.data.netScore} (eşik: ${AUTONOMY_THRESHOLD}). Manuel onay gerekiyor.`);
        }

        log('INFO', `Learning: ${eventType} (${weight > 0 ? '+' : ''}${weight})`, {
            context, netScore: this.data.netScore
        });

        return event;
    }

    /**
     * Is the system in autonomous mode?
     */
    isAutonomous() {
        // Manual override takes precedence
        if (this.data.autonomousModeOverride !== null) {
            return this.data.autonomousModeOverride;
        }
        return this.data.netScore >= AUTONOMY_THRESHOLD;
    }

    /**
     * Force autonomous mode on/off (manual override).
     */
    setAutonomousMode(enabled) {
        this.data.autonomousModeOverride = enabled;
        this._save();
        log('INFO', `Autonomous mode manually set to: ${enabled}`);
    }

    /**
     * Clear the manual override (revert to score-based control).
     */
    clearOverride() {
        this.data.autonomousModeOverride = null;
        this._save();
        log('INFO', 'Autonomous mode override cleared — score-based control active');
    }

    /**
     * Get net score.
     */
    getNetScore() {
        return this.data.netScore;
    }

    /**
     * Get per-category breakdown.
     */
    getCategoryScores() {
        return { ...this.data.categoryScores };
    }

    /**
     * Get recent events.
     */
    getRecentEvents(limit = 20) {
        return this.data.events.slice(-limit);
    }

    /**
     * Reset score (nuclear option).
     */
    reset() {
        this.data.netScore = 0;
        this.data.events = [];
        this.data.categoryScores = {};
        this.data.autonomousModeOverride = null;
        this._save();
        log('INFO', 'Learning module reset');
    }

    getStatus() {
        return {
            netScore: this.data.netScore,
            autonomous: this.isAutonomous(),
            threshold: AUTONOMY_THRESHOLD,
            override: this.data.autonomousModeOverride,
            totalEvents: this.data.events.length,
            categoryScores: this.data.categoryScores
        };
    }
}

let learningInstance = null;

export function getLearning() {
    if (!learningInstance) {
        learningInstance = new LearningModule();
    }
    return learningInstance;
}

export { SCORE_WEIGHTS, AUTONOMY_THRESHOLD };
export default LearningModule;
