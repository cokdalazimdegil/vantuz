// modules/researcher/agent.js
// Research Agent for Vantuz OS V2
// Performs web research on demand, summarizes findings, stores in memory.

import axios from 'axios';
import { log } from '../../core/ai-provider.js';
import { getMemory } from '../../core/memory.js';

// ═══════════════════════════════════════════════════════════════════════════
// WEB SEARCH PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════

async function searchBrave(query, apiKey) {
    const response = await axios.get('https://api.search.brave.com/res/v1/web/search', {
        params: { q: query, count: 5 },
        headers: { 'X-Subscription-Token': apiKey }
    });
    return (response.data.web?.results || []).map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.description
    }));
}

async function searchGoogle(query, apiKey, cx) {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: { q: query, key: apiKey, cx, num: 5 }
    });
    return (response.data.items || []).map(r => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet
    }));
}

// Fallback: No API — use AI's existing knowledge
async function searchFallback(query) {
    return [{
        title: 'AI Bilgi Tabanı',
        url: 'internal',
        snippet: `"${query}" hakkında web araması yapılamadı. API anahtarı eksik. AI bilgisiyle yanıt veriliyor.`
    }];
}

// ═══════════════════════════════════════════════════════════════════════════
// RESEARCH AGENT
// ═══════════════════════════════════════════════════════════════════════════

class ResearchAgent {
    constructor(config = {}) {
        this.braveApiKey = config.braveApiKey || process.env.BRAVE_SEARCH_API_KEY || null;
        this.googleApiKey = config.googleApiKey || process.env.GOOGLE_SEARCH_API_KEY || null;
        this.googleCx = config.googleCx || process.env.GOOGLE_SEARCH_CX || null;
        this.aiChat = config.aiChat || null; // AI chat function for summarization
        this.history = [];
        log('INFO', 'ResearchAgent initialized', {
            brave: !!this.braveApiKey,
            google: !!this.googleApiKey
        });
    }

    /**
     * Set the AI chat function for summarization.
     */
    setAiChat(fn) {
        this.aiChat = fn;
    }

    /**
     * Perform a research query.
     * @param {string} query - The research question.
     * @returns {{ query, results, summary, savedToMemory }}
     */
    async research(query) {
        log('INFO', `🔍 Researching: "${query}"`);

        // Step 1: Web search
        let results;
        try {
            if (this.braveApiKey) {
                results = await searchBrave(query, this.braveApiKey);
            } else if (this.googleApiKey && this.googleCx) {
                results = await searchGoogle(query, this.googleApiKey, this.googleCx);
            } else {
                results = await searchFallback(query);
            }
        } catch (e) {
            log('ERROR', 'Web search failed', { error: e.message });
            results = await searchFallback(query);
        }

        // Step 2: AI summarization
        let summary = '';
        if (this.aiChat && results.length > 0) {
            const context = results.map((r, i) =>
                `${i + 1}. ${r.title}\n   ${r.snippet}\n   Kaynak: ${r.url}`
            ).join('\n\n');

            const prompt = `Şu araştırma sorusu için web sonuçlarını analiz et ve 3 maddelik özet yap. Türkçe yanıtla.

Soru: "${query}"

Web Sonuçları:
${context}

Formatın:
1. [Ana bulgu]
2. [Ana bulgu]  
3. [Ana bulgu]

Kaynak: [URL listesi]`;

            try {
                summary = await this.aiChat(prompt);
            } catch (e) {
                summary = `Özet oluşturulamadı: ${e.message}`;
            }
        } else {
            summary = results.map(r => `• ${r.title}: ${r.snippet}`).join('\n');
        }

        // Step 3: Save to memory
        let savedToMemory = false;
        try {
            const memory = getMemory();
            memory.remember(`Araştırma: "${query}" — ${summary.substring(0, 200)}...`, 'research');
            savedToMemory = true;
        } catch (e) { /* ignore */ }

        const report = {
            query,
            results,
            summary,
            savedToMemory,
            timestamp: new Date().toISOString()
        };

        this.history.push(report);
        if (this.history.length > 50) this.history = this.history.slice(-50);

        log('INFO', `Research complete: "${query}"`, { resultCount: results.length });
        return report;
    }

    /**
     * Get previous research results.
     */
    getHistory(limit = 10) {
        return this.history.slice(-limit);
    }

    getStatus() {
        return {
            provider: this.braveApiKey ? 'Brave' : this.googleApiKey ? 'Google' : 'Fallback (AI)',
            researchCount: this.history.length
        };
    }
}

let researcherInstance = null;

export function getResearchAgent(config = {}) {
    if (!researcherInstance) {
        researcherInstance = new ResearchAgent(config);
    }
    return researcherInstance;
}

export default ResearchAgent;
