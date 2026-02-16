// modules/crm/sentiment-crm.js
// Sentiment CRM for Vantuz OS V2
// Analyzes reviews/questions, drafts brand-persona replies, escalates angry customers.

import fs from 'fs';
import path from 'path';
import { log } from '../../core/ai-provider.js';

// ═══════════════════════════════════════════════════════════════════════════
// SENTIMENT ANALYSIS (Local / AI-Enhanced)
// ═══════════════════════════════════════════════════════════════════════════

const SENTIMENT_KEYWORDS = {
    angry: [
        'rezalet', 'kötü', 'berbat', 'iade', 'şikayet', 'korkunç', 'sahtekarlık',
        'dolandırıcı', 'cevap yok', 'pişman', 'lütfen çözün', 'iğrenç', 'saygısız',
        'hala gelmedi', 'kırık', 'bozuk', 'yanlış ürün', 'parasını istiyorum'
    ],
    happy: [
        'mükemmel', 'harika', 'güzel', 'teşekkür', 'süper', 'hızlı', 'kaliteli',
        'memnun', 'tavsiye', 'beğendim', 'perfect', 'çok iyi', 'bravo', 'başarılı'
    ],
    confused: [
        'ne zaman', 'nerede', 'nasıl', 'anlamadım', 'bilgi', 'soruyorum', 'cevap bekliyorum',
        'açıklama', 'yardım', 'destek', 'merak ediyorum', 'ne oldu'
    ]
};

/**
 * Local sentiment detection (fast, no API call).
 * @param {string} text
 * @returns {{ sentiment: string, confidence: number, keywords: string[] }}
 */
function detectSentimentLocal(text) {
    const lower = text.toLowerCase();
    const found = { angry: [], happy: [], confused: [] };

    for (const [sentiment, keywords] of Object.entries(SENTIMENT_KEYWORDS)) {
        for (const kw of keywords) {
            if (lower.includes(kw)) found[sentiment].push(kw);
        }
    }

    // Score: angry keywords weigh more
    const scores = {
        angry: found.angry.length * 2,
        happy: found.happy.length * 1.5,
        confused: found.confused.length * 1
    };

    const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

    if (winner[1] === 0) {
        return { sentiment: 'neutral', confidence: 0.5, keywords: [] };
    }

    return {
        sentiment: winner[0],
        confidence: Math.min(winner[1] / 5, 1),
        keywords: found[winner[0]]
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// BRAND PERSONA LOADER
// ═══════════════════════════════════════════════════════════════════════════

function loadBrandTone() {
    const brandPath = path.join(process.cwd(), 'workspace', 'BRAND.md');
    try {
        if (fs.existsSync(brandPath)) {
            const content = fs.readFileSync(brandPath, 'utf-8').toLowerCase();
            if (content.includes('samimi') || content.includes('friendly') || content.includes('emoji')) {
                return 'friendly';
            }
            if (content.includes('premium') || content.includes('lüks') || content.includes('formal')) {
                return 'formal';
            }
        }
    } catch (e) { /* ignore */ }
    return 'professional'; // default
}

// ═══════════════════════════════════════════════════════════════════════════
// CRM ENGINE
// ═══════════════════════════════════════════════════════════════════════════

class SentimentCRM {
    constructor() {
        this.tone = loadBrandTone();
        this.escalationCallbacks = []; // for angry customer alerts
        this.processed = [];           // recent analysis log
        log('INFO', 'SentimentCRM initialized', { tone: this.tone });
    }

    /**
     * Register an escalation handler (webhook, Slack, WhatsApp).
     */
    onEscalation(callback) {
        this.escalationCallbacks.push(callback);
    }

    /**
     * Analyze a customer message/review.
     * @param {object} params
     * @param {string} params.text - The message/review text.
     * @param {string} params.customerName - Customer name.
     * @param {string} params.platform - Source platform.
     * @param {string} params.productBarcode - Related product barcode.
     * @returns {{ sentiment, confidence, suggestedReply, escalated }}
     */
    async analyze({ text, customerName = '', platform = '', productBarcode = '' }) {
        const analysis = detectSentimentLocal(text);

        // Generate reply suggestion
        const suggestedReply = this._generateReply(analysis.sentiment, customerName, text);

        // Escalate angry customers
        let escalated = false;
        if (analysis.sentiment === 'angry' && analysis.confidence >= 0.5) {
            escalated = true;
            this._escalate({
                customerName,
                platform,
                text,
                sentiment: analysis.sentiment,
                confidence: analysis.confidence,
                productBarcode
            });
        }

        const result = {
            ...analysis,
            customerName,
            platform,
            productBarcode,
            suggestedReply,
            escalated,
            analyzedAt: new Date().toISOString()
        };

        this.processed.push(result);
        if (this.processed.length > 100) this.processed = this.processed.slice(-100);

        return result;
    }

    /**
     * Batch analyze reviews.
     */
    async analyzeBatch(reviews) {
        const results = [];
        for (const review of reviews) {
            results.push(await this.analyze(review));
        }

        const summary = {
            total: results.length,
            angry: results.filter(r => r.sentiment === 'angry').length,
            happy: results.filter(r => r.sentiment === 'happy').length,
            confused: results.filter(r => r.sentiment === 'confused').length,
            neutral: results.filter(r => r.sentiment === 'neutral').length,
            escalated: results.filter(r => r.escalated).length
        };

        log('INFO', 'CRM batch analysis complete', summary);
        return { results, summary };
    }

    getRecent(limit = 20) {
        return this.processed.slice(-limit);
    }

    getStatus() {
        const all = this.processed;
        return {
            tone: this.tone,
            totalProcessed: all.length,
            angryCount: all.filter(r => r.sentiment === 'angry').length,
            escalatedCount: all.filter(r => r.escalated).length
        };
    }

    // ─────────────────────────────────────────────────────────────────────

    _generateReply(sentiment, customerName, originalText) {
        const name = customerName ? ` ${customerName} Bey/Hanım` : '';

        const replies = {
            friendly: {
                angry: `Merhaba${name} 🙏 Yaşadığınız bu sorun için çok üzgünüz! Hemen çözmek istiyoruz. Sipariş numaranızı paylaşır mısınız?`,
                happy: `Teşekkürler${name} 🎉 Böyle güzel yorumlar bizi çok mutlu ediyor! Tekrar bekleriz 💜`,
                confused: `Merhaba${name} 👋 Yardımcı olmak isteriz! Detayları paylaşır mısınız?`,
                neutral: `Merhaba${name}, yorumunuz için teşekkürler! Başka sorunuz olursa yazabilirsiniz 😊`
            },
            formal: {
                angry: `Sayın${name}, yaşadığınız olumsuzluktan dolayı özür dileriz. Konuyu derhal incelemeye alıyoruz. En kısa sürede size dönüş yapacağız.`,
                happy: `Sayın${name}, değerli görüşleriniz için teşekkür ederiz. Memnuniyetiniz bizim için büyük önem taşımaktadır.`,
                confused: `Sayın${name}, sorularınız için teşekkür ederiz. Konuyla ilgili size detaylı bilgi sunmak isteriz.`,
                neutral: `Sayın${name}, yorumunuz için teşekkür ederiz.`
            },
            professional: {
                angry: `Merhaba${name}, yaşadığınız sorun için özür dileriz. Konuyu inceliyoruz ve en kısa sürede dönüş yapacağız.`,
                happy: `Merhaba${name}, güzel yorumunuz için teşekkürler! Tekrar bekleriz.`,
                confused: `Merhaba${name}, yardımcı olmak isteriz. Lütfen detayları paylaşın.`,
                neutral: `Merhaba${name}, yorumunuz için teşekkürler.`
            }
        };

        return (replies[this.tone] || replies.professional)[sentiment] || replies.professional.neutral;
    }

    _escalate(data) {
        log('WARN', `🚨 ESCALATION: Kızgın müşteri — ${data.customerName || 'Anonim'} (${data.platform})`, data);

        for (const cb of this.escalationCallbacks) {
            try { cb(data); } catch (e) { /* swallow */ }
        }
    }
}

let crmInstance = null;

export function getSentimentCRM() {
    if (!crmInstance) {
        crmInstance = new SentimentCRM();
    }
    return crmInstance;
}

export default SentimentCRM;
