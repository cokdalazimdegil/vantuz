/**
 * 🩸 KAN EMİCİ (Blood Sucker) - Akıllı Fiyat Robotu
 * 
 * Rakip fiyatlarını 7/24 izler ama aptal değil:
 * - Rakip fiyat düşürdüyse körü körüne takip etmez
 * - Stok durumuna, kar marjına ve satış hızına bakar
 * - Rakip stoku bitiyorsa fiyatı yükseltir
 */

import platformHub from '../platforms/index.js';

export const repricerTool = {
    name: 'repricer',

    async execute(params, context) {
        const { api, memory, license } = context;
        const { barcode, platform = 'all', targetMargin = 20, action = 'analyze' } = params;

        // Lisans kontrolü (demo modda da çalışsın)
        const isDemo = license?.isDemo?.() ?? true;
        if (isDemo) {
            api?.logger?.info('🔓 Demo modda çalışıyor...');
        }

        // Ürün bilgilerini al
        const product = await this._getProduct(barcode, platform);
        if (!product) {
            return { success: false, error: 'Ürün bulunamadı.' };
        }

        // Hafızadan geçmiş bağlamı al
        let historyContext = { recentDecisions: [], productHistory: [] };
        if (memory?.getRelevantContext) {
            historyContext = await memory.getRelevantContext(barcode, {
                barcode,
                type: 'decision'
            });
        }

        // Rakip fiyatlarını topla
        const competitors = await this._fetchCompetitorPrices(barcode, platform);

        // Analiz yap
        const analysis = this._analyzeAndDecide({
            product,
            competitors,
            targetMargin,
            history: historyContext.recentDecisions,
            productContext: historyContext.productHistory
        });

        // Kararı hafızaya kaydet
        if (memory?.recordPricingDecision) {
            await memory.recordPricingDecision({
                productId: product.id,
                barcode,
                platform,
                previousPrice: product.price,
                newPrice: analysis.recommendedPrice,
                reason: analysis.reason,
                factors: analysis.factors,
                outcome: action === 'apply' ? 'applied' : 'pending',
                profitImpact: analysis.profitImpact
            });
        }

        // Eğer action = apply ise fiyatı güncelle
        if (action === 'apply' && analysis.shouldChange && !isDemo) {
            await this._applyPrice(product, analysis.recommendedPrice, platform);
        }

        return {
            success: true,
            product: {
                name: product.name,
                barcode,
                currentPrice: product.price,
                cost: product.cost
            },
            analysis: {
                recommendedPrice: analysis.recommendedPrice,
                reason: analysis.reason,
                shouldChange: analysis.shouldChange,
                profitImpact: analysis.profitImpact,
                competitorSummary: analysis.competitorSummary
            },
            applied: action === 'apply' && analysis.shouldChange && !isDemo
        };
    },

    _analyzeAndDecide({ product, competitors, targetMargin, history, productContext }) {
        const { price: currentPrice, cost } = product;
        const minPrice = cost * (1 + targetMargin / 100);

        // Rakip analizi
        const activeCompetitors = competitors.filter(c => c.stock > 0);
        const lowestCompetitorPrice = activeCompetitors.length > 0
            ? Math.min(...activeCompetitors.map(c => c.price))
            : null;

        // Rakip stok durumu
        const lowStockCompetitors = competitors.filter(c => c.stock > 0 && c.stock < 5);
        const outOfStockCompetitors = competitors.filter(c => c.stock === 0);

        let recommendedPrice = currentPrice;
        let reason = '';
        let shouldChange = false;

        // KARAR MANTIĞI

        // Senaryo 1: Rakiplerin çoğu stoksuz
        if (outOfStockCompetitors.length >= competitors.length * 0.6 && competitors.length > 0) {
            recommendedPrice = Math.round(currentPrice * 1.15);
            reason = `🔥 Rakiplerin %${Math.round(outOfStockCompetitors.length / competitors.length * 100)}'i stoksuz. Fiyat artışı önerilir.`;
            shouldChange = true;
        }
        // Senaryo 2: En yakın rakip düşük stoklu
        else if (lowStockCompetitors.length > 0 && lowestCompetitorPrice) {
            const lowestStockCompetitor = lowStockCompetitors.sort((a, b) => a.price - b.price)[0];
            if (lowestStockCompetitor && lowestStockCompetitor.price <= currentPrice) {
                recommendedPrice = Math.round(currentPrice * 1.05);
                reason = `⏳ Rakip fiyatı düşük ama stoku kritik (${lowestStockCompetitor.stock} adet). Bekleyince müşteri bize gelecek.`;
                shouldChange = currentPrice < recommendedPrice;
            }
        }
        // Senaryo 3: Rakip fiyatı bizden düşük ve stoku bol
        else if (lowestCompetitorPrice && lowestCompetitorPrice < currentPrice * 0.95) {
            if (lowestCompetitorPrice >= minPrice) {
                recommendedPrice = Math.round(lowestCompetitorPrice * 0.99);
                reason = `📉 Rakip fiyatı düşürmüş (${lowestCompetitorPrice} ₺). Kar marjı uygun, takip ediyoruz.`;
                shouldChange = true;
            } else {
                recommendedPrice = minPrice;
                reason = `⚠️ Rakip fiyatı çok düşük (${lowestCompetitorPrice} ₺) ama minimum marjın (${targetMargin}%) altına inemeyiz.`;
                shouldChange = currentPrice > minPrice;
            }
        }
        // Senaryo 4: Fiyatımız çok düşük, artırabiliriz
        else if (lowestCompetitorPrice && currentPrice < lowestCompetitorPrice * 0.9) {
            recommendedPrice = Math.round(lowestCompetitorPrice * 0.95);
            reason = `📈 Fiyatımız gereksiz düşük. Rakip fiyatına yaklaştırılıyor.`;
            shouldChange = true;
        }
        // Senaryo 5: Stabil piyasa veya rakip yok
        else {
            reason = competitors.length > 0
                ? `✅ Fiyat optimal seviyede. Değişiklik gerekmiyor.`
                : `ℹ️ Rakip verisi bulunamadı.`;
            shouldChange = false;
        }

        // Kar etkisi hesapla
        const currentProfit = currentPrice - cost;
        const newProfit = recommendedPrice - cost;
        const profitImpact = currentProfit > 0
            ? ((newProfit - currentProfit) / currentProfit * 100).toFixed(1)
            : 0;

        return {
            recommendedPrice,
            reason,
            shouldChange,
            profitImpact: parseFloat(profitImpact),
            competitorSummary: {
                total: competitors.length,
                active: activeCompetitors.length,
                lowStock: lowStockCompetitors.length,
                outOfStock: outOfStockCompetitors.length,
                lowestPrice: lowestCompetitorPrice
            },
            factors: {
                currentPrice,
                cost,
                minPrice,
                targetMargin,
                competitorCount: competitors.length,
                lowestCompetitorPrice
            }
        };
    },

    async analyzeCompetitors(barcode, context) {
        const competitors = await this._fetchCompetitorPrices(barcode, 'all');
        const product = await this._getProduct(barcode, 'all');

        return {
            product: product?.name || barcode,
            competitors: competitors.slice(0, 5),
            recommendation: this._generateRecommendation(competitors, product)
        };
    },

    async runAutoCycle(context) {
        const decisions = [];

        // Bağlı platformlardan ürünleri al
        const connected = platformHub.getConnected();
        if (connected.length === 0) return decisions;

        for (const platformName of connected) {
            const api = platformHub.resolve(platformName);
            if (!api) continue;

            try {
                const result = await api.getProducts({ size: 50 });
                if (!result?.success) continue;

                const products = result.data.content || result.data.products || result.data || [];

                for (const product of products.slice(0, 10)) {
                    const barcode = product.barcode || product.sku || product.merchantSku;
                    if (!barcode) continue;

                    const analysisResult = await this.execute({
                        barcode,
                        platform: platformName,
                        action: 'analyze'
                    }, context);

                    if (analysisResult.success && analysisResult.analysis.shouldChange) {
                        decisions.push({
                            barcode,
                            name: product.title || product.name,
                            platform: platformName,
                            ...analysisResult.analysis
                        });
                    }
                }
            } catch (err) {
                // Hata durumunda devam et
            }
        }

        return decisions;
    },

    // === Private Methods ===

    async _getProduct(barcode, platform) {
        // Platformlardan ürün bilgisi al
        const platforms = platform === 'all'
            ? platformHub.getConnected()
            : [platform];

        for (const p of platforms) {
            const api = platformHub.resolve(p);
            if (!api?.getProducts) continue;

            try {
                const result = await api.getProducts({ barcode });
                if (result?.success) {
                    const products = result.data.content || result.data.products || result.data || [];
                    const product = products.find(item =>
                        item.barcode === barcode ||
                        item.sku === barcode ||
                        item.merchantSku === barcode
                    );

                    if (product) {
                        return {
                            id: product.id || `${p}_${barcode}`,
                            barcode,
                            name: product.title || product.name || 'Ürün',
                            price: product.salePrice || product.price || product.salesPrice || 0,
                            cost: product.cost || (product.salePrice || product.price || 0) * 0.6, // Maliyet yoksa %60 varsay
                            stock: product.quantity || product.stock || product.availableStock || 0,
                            platform: p
                        };
                    }
                }
            } catch (e) {
                // Hata durumunda diğer platformu dene
            }
        }

        return null;
    },

    async _fetchCompetitorPrices(barcode, platform) {
        // Not: Rakip fiyat çekme genelde web scraping gerektirir
        // Bu versiyonda placeholder - ileride Brave Search veya özel scraper eklenebilir
        return [];
    },

    async _applyPrice(product, newPrice, platform) {
        const api = platformHub.resolve(platform);
        if (!api?.updatePrice) return false;

        try {
            const result = await api.updatePrice(product.barcode, newPrice);
            return result?.success || false;
        } catch (e) {
            return false;
        }
    },

    _generateRecommendation(competitors, product) {
        if (!product) return 'Ürün bulunamadı.';

        const activeCompetitors = competitors.filter(c => c.stock > 0);
        if (activeCompetitors.length === 0) {
            return competitors.length > 0
                ? '🔥 Tüm rakipler stoksuz! Fiyatı yükseltebilirsiniz.'
                : 'ℹ️ Rakip verisi bulunamadı.';
        }

        const lowestPrice = Math.min(...activeCompetitors.map(c => c.price));
        if (product.price < lowestPrice) {
            return `📈 Fiyatınız en düşük (${product.price} ₺). Artırabilirsiniz.`;
        }

        return `📊 Rakip fiyat aralığı: ${lowestPrice} - ${Math.max(...activeCompetitors.map(c => c.price))} ₺`;
    }
};
