// core/eia-monitor.js
import { getScheduler } from './scheduler.js';
import { TrendyolScraper } from './scrapers/TrendyolScraper.js'; // Example scraper
import { getEIABrain } from './eia-brain.js';
import dbPkg from './database.js'; // CommonJS uyumluluğu için default import
import { getVectorDB } from './vector-db.js'; // Import vector DB
import { log } from './ai-provider.js';

const { getDatabase } = dbPkg;

class EIAMonitor {
    constructor(config, env) {
        this.scheduler = getScheduler();
        this.eiaBrain = getEIABrain(config, env);
        this.db = getDatabase(); // Initialize database
        this.vectorDb = getVectorDB(); // Initialize vector DB
        this.config = config;
        this.env = env;
        this.productUrls = this._parseUrls(this.env.EIA_PRODUCT_URLS);
        this.competitorUrls = this._parseUrls(this.env.EIA_COMPETITOR_URLS);
        this.targetProfitMargin = parseFloat(this.env.EIA_TARGET_PROFIT_MARGIN || '15'); // Default 15%
        this.baselineData = {};
        this.scraperFactories = {
            trendyol: () => new TrendyolScraper() // Initialize other scrapers here
        };
        log('INFO', 'EIA Monitor initialized');
    }

    _parseUrls(urlsString) {
        return urlsString ? urlsString.split(',').map(url => url.trim()).filter(Boolean) : [];
    }

    async initMonitoringTasks() {
        // Ensure DB is initialized before registering tasks
        await this.db.init();

        const cronSchedule = '*/30 * * * *'; // Every 30 minutes, for example

        // Monitor product URLs
        for (const productUrl of this.productUrls) {
            // Assuming a way to extract productId and platform from URL
            const { productId, platform } = this._extractProductInfoFromUrl(productUrl);
            if (productId && platform) {
                // Register monitoring for various data types
                this.startMonitoring(productId, platform, productUrl, 'price_changes', cronSchedule);
                this.startMonitoring(productId, platform, productUrl, 'buybox_status', cronSchedule);
                this.startMonitoring(productId, platform, productUrl, 'stock_movements', cronSchedule);
                this.startMonitoring(productId, platform, productUrl, 'product_reviews', cronSchedule);
            } else {
                log('WARN', `Could not extract product info from URL: ${productUrl}`);
            }
        }

        // Monitor competitor URLs (for price changes and buybox status)
        for (const competitorUrl of this.competitorUrls) {
            const { productId, platform } = this._extractProductInfoFromUrl(competitorUrl);
            if (productId && platform) {
                this.startMonitoring(`comp-${productId}`, platform, competitorUrl, 'price_changes', cronSchedule);
                this.startMonitoring(`comp-${productId}`, platform, competitorUrl, 'buybox_status', cronSchedule);
            } else {
                log('WARN', `Could not extract product info from competitor URL: ${competitorUrl}`);
            }
        }

        // Load company rules into vector DB (placeholder)
        await this._loadCompanyRules();
    }

    _extractProductInfoFromUrl(url) {
        // Placeholder: Implement logic to extract product ID and platform from various marketplace URLs
        // This will be crucial for mapping URLs to specific scraper methods and DB entries
        // For Trendyol example: trendyol.com/s/product-id -> platform: 'trendyol', productId: 'product-id'
        if (url.includes('trendyol.com')) {
            const match = url.match(/\/s\/(.*?)(?:\?|$)/);
            return { platform: 'trendyol', productId: match ? match[1] : url };
        }
        // Add logic for Hepsiburada, Amazon, etc.
        return { platform: 'unknown', productId: url };
    }

    async _loadCompanyRules() {
        // Placeholder: Load company rules from a file or config and embed them into the vector DB
        const rules = [
            'Asla %10 marjın altına düşme.',
            'Müşteri şikayetlerine 24 saat içinde yanıt ver.',
            'Rakip fiyatı %5 düşürürse kendi fiyatını %2 düşür.'
        ];
        for (const rule of rules) {
            // This would require an embedding model to convert text to vector
            // For now, use a dummy vector
            const dummyVector = Array.from({ length: 1536 }, () => Math.random()); // Example: OpenAI embedding size
            await this.vectorDb.add('company_rules', dummyVector, { type: 'rule', text: rule });
        }
        log('INFO', `${rules.length} company rules loaded into vector DB.`);
    }

    /**
     * Start monitoring a product for a specific data type.
     * @param {string} productId Unique identifier for the product.
     * @param {string} platform Platform name (e.g., 'trendyol').
     * @param {string} productUrl URL of the product page.
     * @param {string} dataType Type of data to monitor (e.g., 'price_changes', 'buybox_status').
     * @param {string} cronSchedule Cron schedule for monitoring (e.g., '0 * * * *').
     */
    async startMonitoring(productId, platform, productUrl, dataType, cronSchedule) {
        const jobName = `monitor-${platform}-${productId}-${dataType}`;
        const createScraper = this.scraperFactories[platform];

        if (!createScraper) {
            log('ERROR', `No scraper found for platform: ${platform}`);
            return;
        }

        const task = async () => {
            log('INFO', `Monitoring ${dataType} for product ${productId} on ${platform}`);
            let rawData;
            const scraper = createScraper();
            try {
                // Scrape Data
                switch (dataType) {
                    case 'price_changes':
                        rawData = await scraper.getPriceChanges(productUrl);
                        break;
                    case 'buybox_status':
                        rawData = await scraper.getBuyboxStatus(productUrl);
                        break;
                    case 'stock_movements':
                        rawData = await scraper.getStockMovements(productUrl);
                        break;
                    case 'product_reviews':
                        rawData = await scraper.getProductReviewsAndRatings(productUrl);
                        break;
                    default:
                        log('WARN', `Unknown data type for monitoring: ${dataType}`);
                        return;
                }

                // Process Raw Data & Compare with Baseline (Placeholder)
                const insights = await this.eiaBrain.processRawData(rawData, dataType); // Use EIA Brain for processing
                const anomaly = this._detectAnomaly(productId, dataType, insights); // Implement anomaly detection

                if (anomaly) {
                    log('WARN', `Anomaly detected for ${dataType} on product ${productId}: ${JSON.stringify(anomaly)}`);
                    await this._alertUserViaLLM(productId, platform, dataType, anomaly, insights);
                } else {
                    log('INFO', `No anomaly detected for ${dataType} on product ${productId}.`);
                }

            } catch (error) {
                log('ERROR', `Error during monitoring job ${jobName}: ${error.message}`, { error });
            } finally {
                try {
                    await scraper.close();
                } catch (e) {
                    log('WARN', `Failed to close scraper for ${jobName}: ${e.message}`);
                }
            }
        };

        this.scheduler.addJob(jobName, cronSchedule, task);
        log('INFO', `Started monitoring job "${jobName}" for ${productUrl} every ${cronSchedule}`);
    }

    /**
     * Placeholder for anomaly detection logic.
     * This will involve comparing current data with historical baseline data.
     */
    _detectAnomaly(productId, dataType, currentInsights) {
        // For demonstration, let's say any new data is an "anomaly" if no baseline exists
        // In a real system, this would be a sophisticated comparison
        if (!this.baselineData[dataType]?.[productId]) {
            this.baselineData[dataType] = this.baselineData[dataType] || {};
            this.baselineData[dataType][productId] = currentInsights; // Store current as baseline
            return null; // No anomaly, first data point
        }

        // Simple example: if a price changes from baseline
        if (dataType === 'price_changes' && currentInsights.currentPrice !== this.baselineData[dataType][productId].currentPrice) {
            return {
                type: 'price_change',
                oldPrice: this.baselineData[dataType][productId].currentPrice,
                newPrice: currentInsights.currentPrice
            };
        }
        return null;
    }

    /**
     * Placeholder for alerting the user via LLM.
     */
    async _alertUserViaLLM(productId, platform, dataType, anomaly, insights) {
        let currentSituationDescription = `🚨 Anomali Tespiti!
Ürün ID: ${productId}
Platform: ${platform}
Veri Tipi: ${dataType}`;

        if (dataType === 'price_changes' && anomaly.type === 'price_change') {
            currentSituationDescription += `\nFiyat Değişikliği Tespit Edildi: Ürünün eski fiyatı ${anomaly.oldPrice} iken, yeni fiyatı ${anomaly.newPrice} oldu.`;
            currentSituationDescription += `\nİçgörü Özeti: ${insights.summary}`;
            currentSituationDescription += `\nİçgörü Detayları: ${insights.details.join('; ')}`;
        } else if (dataType === 'buybox_status') {
            currentSituationDescription += `\nBuybox Durumu: ${anomaly.status}.`;
            currentSituationDescription += `\nİçgörü Özeti: ${insights.summary}`;
        }
        // Add more specific descriptions for other anomaly types as needed

        // Fetch relevant company rules from vector DB (placeholder for actual embedding and search)
        const relevantRules = await this.vectorDb.search('company_rules', [/* dummy embedding */], 2); // Assume some query vector
        const companyRulesContext = relevantRules.map(r => r.metadata.text).join('\n- ');
        
        // Fetch past strategic decisions (placeholder)
        const pastDecisionsContext = "Daha önce benzer bir durumda fiyat düşürme kararı alınmıştı."; // Placeholder

        const llmResponse = await this.eiaBrain.analyzeAndDecide({
            currentSituation: currentSituationDescription,
            companyRules: companyRulesContext || 'Şirket kuralları bulunamadı.',
            pastDecisions: pastDecisionsContext
        });
        log('INFO', 'Alert sent via LLM', { llmResponse: llmResponse.slice(0, 100) });
    }
}

let eiaMonitorInstance = null;

export function getEIAMonitor(config, env) {
    if (!eiaMonitorInstance) {
        eiaMonitorInstance = new EIAMonitor(config, env);
    }
    return eiaMonitorInstance;
}
