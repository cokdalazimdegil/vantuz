// core/memory.js
// Persistent Memory Module for Vantuz AI
// Provides long-term fact storage and recall via JSON files.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from './ai-provider.js';

const MEMORY_DIR = path.join(os.homedir(), '.vantuz', 'memory');
const FACTS_FILE = path.join(MEMORY_DIR, 'facts.json');
const STRATEGY_FILE = path.join(MEMORY_DIR, 'strategy.json');
const MAX_FACTS = 500;

/**
 * Ensures the memory directory exists.
 */
function ensureDir() {
    if (!fs.existsSync(MEMORY_DIR)) {
        fs.mkdirSync(MEMORY_DIR, { recursive: true });
        log('INFO', 'Memory directory created', { path: MEMORY_DIR });
    }
}

/**
 * Loads a JSON file safely.
 */
function loadJson(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
    } catch (e) {
        log('WARN', `Memory file corrupt or unreadable: ${filePath}`, { error: e.message });
    }
    return [];
}

/**
 * Saves data to a JSON file atomically.
 */
function saveJson(filePath, data) {
    ensureDir();
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, filePath);
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMORY CLASS
// ═══════════════════════════════════════════════════════════════════════════

class Memory {
    constructor() {
        ensureDir();
        this.facts = loadJson(FACTS_FILE);
        this.strategies = loadJson(STRATEGY_FILE);
        log('INFO', 'Memory loaded', {
            facts: this.facts.length,
            strategies: this.strategies.length
        });
    }

    /**
     * Remember a fact. Facts are timestamped entries.
     * @param {string} fact - The fact to remember.
     * @param {string} category - Category: 'general', 'customer', 'product', 'strategy'
     */
    remember(fact, category = 'general') {
        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            fact,
            category,
            createdAt: new Date().toISOString()
        };

        this.facts.push(entry);

        // Evict oldest if over limit
        if (this.facts.length > MAX_FACTS) {
            this.facts = this.facts.slice(-MAX_FACTS);
        }

        saveJson(FACTS_FILE, this.facts);
        log('INFO', 'Fact remembered', { id: entry.id, category });
        return entry;
    }

    /**
     * Recall facts matching a keyword query.
     * Simple substring search (can be upgraded to vector later).
     * @param {string} query - Search query.
     * @param {number} limit - Max results.
     * @returns {Array} Matching facts.
     */
    recall(query, limit = 10) {
        const q = query.toLowerCase();
        const matches = this.facts.filter(f =>
            f.fact.toLowerCase().includes(q) ||
            f.category.toLowerCase().includes(q)
        );
        return matches.slice(-limit);
    }

    /**
     * Save a strategic decision or rule.
     * @param {string} rule - The strategy rule.
     * @param {string} context - Why this decision was made.
     */
    addStrategy(rule, context = '') {
        const entry = {
            id: Date.now().toString(36),
            rule,
            context,
            createdAt: new Date().toISOString()
        };

        this.strategies.push(entry);
        saveJson(STRATEGY_FILE, this.strategies);
        log('INFO', 'Strategy recorded', { id: entry.id });
        return entry;
    }

    /**
     * Get all strategies.
     */
    getStrategies() {
        return this.strategies;
    }

    /**
     * Get recent facts for context injection.
     * @param {number} count - How many recent facts.
     */
    getRecentFacts(count = 20) {
        return this.facts.slice(-count);
    }

    /**
     * Get a summary string for AI injection.
     */
    getContextSummary() {
        const recentFacts = this.getRecentFacts(10);
        const strategies = this.getStrategies();

        let summary = '';

        if (strategies.length > 0) {
            summary += '\n--- STRATEJİK KURALLAR ---\n';
            strategies.forEach(s => {
                summary += `- ${s.rule}\n`;
            });
        }

        if (recentFacts.length > 0) {
            summary += '\n--- SON HATIRALAR ---\n';
            recentFacts.forEach(f => {
                summary += `- [${f.category}] ${f.fact}\n`;
            });
        }

        return summary;
    }

    /**
     * Full reset (dangerous).
     */
    clear() {
        this.facts = [];
        this.strategies = [];
        saveJson(FACTS_FILE, this.facts);
        saveJson(STRATEGY_FILE, this.strategies);
        log('WARN', 'Memory cleared');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════

let memoryInstance = null;

export function getMemory() {
    if (!memoryInstance) {
        memoryInstance = new Memory();
    }
    return memoryInstance;
}

export default Memory;
