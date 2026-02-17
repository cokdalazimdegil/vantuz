/**
 * 🧠 HIPPOCAMPUS - Gelişmiş Hafıza Sistemi
 * 
 * Beyin'in hippocampus bölgesinden ilham alınarak tasarlanmış,
 * uzun süreli hafıza yönetimi ve bağlamsal hatırlama sistemi.
 * 
 * Özellikler:
 * - Episodik hafıza (olaylar, kararlar)
 * - Semantik hafıza (ürün bilgileri, kurallar)
 * - Vektör tabanlı benzerlik araması
 * - Otomatik hafıza konsolidasyonu
 * - Önem bazlı unutma mekanizması
 */

import { Sequelize, DataTypes, Op } from 'sequelize';
import path from 'path';
import crypto from 'crypto';

export class Hippocampus {
    constructor(api) {
        this.api = api;
        this.logger = api.logger;
        this.db = null;
        this.models = {};
        this.initialized = false;
    }

    async initialize() {
        const dbPath = path.join(process.cwd(), '.vantuz', 'hippocampus.sqlite');

        this.db = new Sequelize({
            dialect: 'sqlite',
            storage: dbPath,
            dialectModule: require('better-sqlite3'),
            logging: false
        });

        // Hafıza Modelleri
        this.models.Memory = this.db.define('Memory', {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            type: {
                type: DataTypes.STRING,
                allowNull: false,
                // decision, price_change, product, conversation, insight, rule
            },
            content: {
                type: DataTypes.TEXT,
                allowNull: false
            },
            context: {
                type: DataTypes.JSON,
                // İlişkili veriler: productId, platform, userId, etc.
            },
            embedding: {
                type: DataTypes.TEXT,
                // Vektör gömme (JSON olarak saklanır)
            },
            importance: {
                type: DataTypes.FLOAT,
                defaultValue: 0.5,
                // 0-1 arası önem skoru
            },
            accessCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            lastAccessed: {
                type: DataTypes.DATE
            },
            expiresAt: {
                type: DataTypes.DATE,
                // null = kalıcı hafıza
            },
            tags: {
                type: DataTypes.JSON,
                defaultValue: []
            }
        });

        // Fiyat Karar Geçmişi
        this.models.PricingDecision = this.db.define('PricingDecision', {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            productId: DataTypes.STRING,
            barcode: DataTypes.STRING,
            platform: DataTypes.STRING,
            previousPrice: DataTypes.FLOAT,
            newPrice: DataTypes.FLOAT,
            reason: DataTypes.TEXT,
            factors: {
                type: DataTypes.JSON,
                // { competitorPrice, competitorStock, ourStock, margin, velocity }
            },
            outcome: {
                type: DataTypes.STRING,
                // applied, rejected, pending
            },
            profitImpact: DataTypes.FLOAT
        });

        // Ürün Bağlamı
        this.models.ProductContext = this.db.define('ProductContext', {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            barcode: {
                type: DataTypes.STRING,
                unique: true
            },
            name: DataTypes.STRING,
            category: DataTypes.STRING,
            avgSalePrice: DataTypes.FLOAT,
            avgCost: DataTypes.FLOAT,
            seasonality: DataTypes.JSON,
            competitorHistory: DataTypes.JSON,
            customerSentiment: {
                type: DataTypes.JSON,
                // { positive: 0.8, negative: 0.2, topComplaints: [] }
            },
            priceElasticity: DataTypes.FLOAT,
            optimalPriceRange: DataTypes.JSON
        });

        // Konuşma Geçmişi (Session bazlı)
        this.models.ConversationMemory = this.db.define('ConversationMemory', {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            sessionKey: DataTypes.STRING,
            userId: DataTypes.STRING,
            channel: DataTypes.STRING,
            role: {
                type: DataTypes.STRING,
                // user, assistant
            },
            content: DataTypes.TEXT,
            intent: DataTypes.STRING,
            entities: DataTypes.JSON,
            actionTaken: DataTypes.STRING
        });

        // Öğrenilen Kurallar
        this.models.LearnedRule = this.db.define('LearnedRule', {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true
            },
            trigger: DataTypes.TEXT,
            condition: DataTypes.JSON,
            action: DataTypes.TEXT,
            confidence: {
                type: DataTypes.FLOAT,
                defaultValue: 0.5
            },
            usageCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0
            },
            successRate: {
                type: DataTypes.FLOAT,
                defaultValue: 0.5
            }
        });

        await this.db.sync({ alter: true });
        this.initialized = true;
        this.logger.info('🧠 Hippocampus veritabanı hazır.');

        // Hafıza konsolidasyonu zamanlayıcısı (her gece)
        this._startConsolidation();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HAFIZA KAYDETME
    // ═══════════════════════════════════════════════════════════════════════════

    async remember(type, content, context = {}, options = {}) {
        const memory = await this.models.Memory.create({
            type,
            content: typeof content === 'string' ? content : JSON.stringify(content),
            context,
            importance: options.importance || this._calculateImportance(type, content),
            tags: options.tags || [],
            expiresAt: options.temporary ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null
        });

        this.logger.debug(`💾 Hafıza kaydedildi: ${type} - ${memory.id}`);
        return memory;
    }

    async recordPricingDecision(decision) {
        return await this.models.PricingDecision.create(decision);
    }

    async updateProductContext(barcode, updates) {
        const [context, created] = await this.models.ProductContext.findOrCreate({
            where: { barcode },
            defaults: { barcode, ...updates }
        });

        if (!created) {
            await context.update(updates);
        }

        return context;
    }

    async recordConversation(sessionKey, userId, channel, role, content, metadata = {}) {
        return await this.models.ConversationMemory.create({
            sessionKey,
            userId,
            channel,
            role,
            content,
            intent: metadata.intent,
            entities: metadata.entities,
            actionTaken: metadata.action
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HAFIZA ARAMA
    // ═══════════════════════════════════════════════════════════════════════════

    async search({ query, type, limit = 10, minImportance = 0 }) {
        const where = {};

        if (type && type !== 'all') {
            where.type = type;
        }

        if (minImportance > 0) {
            where.importance = { [Op.gte]: minImportance };
        }

        // Basit metin araması (ileride vektör araması eklenebilir)
        if (query) {
            where.content = { [Op.like]: `%${query}%` };
        }

        const memories = await this.models.Memory.findAll({
            where,
            order: [['importance', 'DESC'], ['createdAt', 'DESC']],
            limit
        });

        // Erişim sayacını güncelle
        for (const mem of memories) {
            await mem.update({
                accessCount: mem.accessCount + 1,
                lastAccessed: new Date()
            });
        }

        return memories.map(m => ({
            id: m.id,
            type: m.type,
            content: m.content,
            context: m.context,
            importance: m.importance,
            createdAt: m.createdAt
        }));
    }

    async getProductContext(barcode) {
        return await this.models.ProductContext.findOne({ where: { barcode } });
    }

    async getPricingHistory(barcode, limit = 10) {
        return await this.models.PricingDecision.findAll({
            where: { barcode },
            order: [['createdAt', 'DESC']],
            limit
        });
    }

    async getRecentConversations(sessionKey, limit = 20) {
        return await this.models.ConversationMemory.findAll({
            where: { sessionKey },
            order: [['createdAt', 'DESC']],
            limit
        });
    }

    async getLearnedRules(trigger) {
        return await this.models.LearnedRule.findAll({
            where: {
                trigger: { [Op.like]: `%${trigger}%` },
                confidence: { [Op.gte]: 0.6 }
            },
            order: [['confidence', 'DESC'], ['usageCount', 'DESC']]
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BAĞLAMSAL HATIRLATMA
    // ═══════════════════════════════════════════════════════════════════════════

    async getRelevantContext(input, options = {}) {
        const context = {
            recentDecisions: [],
            productHistory: null,
            relatedMemories: [],
            applicableRules: []
        };

        // Ürün barkodu varsa ürün bağlamını al
        if (options.barcode) {
            context.productHistory = await this.getProductContext(options.barcode);
            context.recentDecisions = await this.getPricingHistory(options.barcode, 5);
        }

        // İlgili hafızaları ara
        context.relatedMemories = await this.search({
            query: input,
            type: options.type || 'all',
            limit: 5,
            minImportance: 0.3
        });

        // Uygulanabilir kuralları bul
        context.applicableRules = await this.getLearnedRules(input);

        return context;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ÖĞRENME & KONSOLİDASYON
    // ═══════════════════════════════════════════════════════════════════════════

    async learnRule(trigger, condition, action) {
        const existing = await this.models.LearnedRule.findOne({
            where: { trigger, action }
        });

        if (existing) {
            await existing.update({
                usageCount: existing.usageCount + 1,
                confidence: Math.min(1, existing.confidence + 0.05)
            });
            return existing;
        }

        return await this.models.LearnedRule.create({
            trigger,
            condition,
            action,
            confidence: 0.5
        });
    }

    async recordRuleOutcome(ruleId, success) {
        const rule = await this.models.LearnedRule.findByPk(ruleId);
        if (!rule) return;

        const newSuccessRate = (rule.successRate * rule.usageCount + (success ? 1 : 0)) / (rule.usageCount + 1);
        const newConfidence = success
            ? Math.min(1, rule.confidence + 0.1)
            : Math.max(0, rule.confidence - 0.1);

        await rule.update({
            usageCount: rule.usageCount + 1,
            successRate: newSuccessRate,
            confidence: newConfidence
        });
    }

    _startConsolidation() {
        // Her gece saat 3'te çalış
        const now = new Date();
        const night = new Date(now);
        night.setHours(3, 0, 0, 0);
        if (night <= now) night.setDate(night.getDate() + 1);

        const delay = night - now;

        setTimeout(() => {
            this._consolidate();
            // Sonra her 24 saatte bir
            setInterval(() => this._consolidate(), 24 * 60 * 60 * 1000);
        }, delay);
    }

    async _consolidate() {
        this.logger.info('🧠 Hafıza konsolidasyonu başlıyor...');

        // 1. Süresi dolmuş hafızaları sil
        await this.models.Memory.destroy({
            where: {
                expiresAt: { [Op.lt]: new Date() }
            }
        });

        // 2. Düşük önemli ve erişilmeyen hafızaları "unut"
        const oldDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 gün
        await this.models.Memory.destroy({
            where: {
                importance: { [Op.lt]: 0.3 },
                accessCount: { [Op.lt]: 3 },
                lastAccessed: { [Op.lt]: oldDate }
            }
        });

        // 3. Düşük güvenilirlikli kuralları sil
        await this.models.LearnedRule.destroy({
            where: {
                confidence: { [Op.lt]: 0.2 },
                usageCount: { [Op.gt]: 10 }
            }
        });

        this.logger.info('🧠 Hafıza konsolidasyonu tamamlandı.');
    }

    _calculateImportance(type, content) {
        // Tip bazlı temel önem
        const baseImportance = {
            decision: 0.8,
            price_change: 0.7,
            insight: 0.6,
            rule: 0.9,
            product: 0.5,
            conversation: 0.3
        };

        return baseImportance[type] || 0.5;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // İSTATİSTİKLER
    // ═══════════════════════════════════════════════════════════════════════════

    async getStats() {
        const memoryCount = await this.models.Memory.count();
        const decisionCount = await this.models.PricingDecision.count();
        const productCount = await this.models.ProductContext.count();
        const ruleCount = await this.models.LearnedRule.count();

        return {
            memories: memoryCount,
            decisions: decisionCount,
            products: productCount,
            rules: ruleCount,
            initialized: this.initialized
        };
    }

    async close() {
        if (this.db) {
            await this.db.close();
        }
    }
}
