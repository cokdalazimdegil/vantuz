// core/scrapers/TrendyolScraper.js
import { Scraper } from './Scraper.js';

export class TrendyolScraper extends Scraper {
    constructor() {
        super();
        this.baseUrl = 'https://www.trendyol.com';
    }

    _normalizePrice(text) {
        if (!text) return null;
        const cleaned = text.replace(/[^\d,]/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return Number.isFinite(num) ? num : null;
    }

    async _extractFirstText(selectors) {
        for (const selector of selectors) {
            const text = await this.extractText(selector);
            if (text) return text.trim();
        }
        return null;
    }

    async getProductPrice(productUrl) {
        await this.init();
        await this.goTo(productUrl);

        const priceText = await this._extractFirstText([
            '.prc-dsc',
            '.prc-org',
            '.prc-slg',
            '.pr-new-price'
        ]);

        await this.close();
        return this._normalizePrice(priceText);
    }

    async searchProducts(query) {
        await this.init();
        await this.goTo(`${this.baseUrl}/sr?q=${encodeURIComponent(query)}`);

        // Example: Extract product titles and URLs from search results
        const productTitles = await this.extractAllText('.p-card-wrppr .prdct-desc-v2 a span');
        const productLinks = await this.page.locator('.p-card-wrppr .prdct-desc-v2 a').evaluateAll((links) => links.map(link => link.href));

        const products = productTitles.map((title, index) => ({
            title,
            url: productLinks[index]
        }));

        await this.close();
        return products;
    }

    async getPriceChanges(productUrl) {
        await this.init();
        await this.goTo(productUrl);

        const priceText = await this._extractFirstText([
            '.prc-dsc',
            '.prc-org',
            '.prc-slg',
            '.pr-new-price'
        ]);
        const currentPrice = this._normalizePrice(priceText);

        await this.close();
        return { productUrl, currentPrice, status: 'ok' };
    }

    async getBuyboxStatus(productUrl) {
        await this.init();
        await this.goTo(productUrl);
        // Attempt to read seller name and buybox indicator text.
        const sellerText = await this._extractFirstText([
            '[data-testid="seller-name"]',
            '.seller-name-text',
            '.merchant-name'
        ]);
        const buyboxText = await this._extractFirstText([
            '[data-testid="buybox"]',
            '.boutique-name',
            '.buybox'
        ]);
        await this.close();
        return {
            productUrl,
            seller: sellerText,
            buybox: buyboxText,
            won: !!sellerText,
            status: 'ok'
        };
    }

    async getStockMovements(productUrl) {
        await this.init();
        await this.goTo(productUrl);
        const stockText = await this._extractFirstText([
            '.out-of-stock',
            '.sold-out',
            '[data-testid="stock-info"]',
            '.product-stock'
        ]);
        const inStock = stockText ? !/tükendi|stokta yok|tuken/i.test(stockText) : true;
        await this.close();
        return { productUrl, status: 'ok', inStock, stockText };
    }

    async getProductReviewsAndRatings(productUrl) {
        await this.init();
        await this.goTo(productUrl);

        const ratingText = await this._extractFirstText([
            '[data-testid="rating-score"]',
            '.rating-score',
            '.pr-rnr-sm-p'
        ]);
        const rating = this._normalizePrice(ratingText);

        const reviewTexts = await this.extractAllText('.comment-text, .review-text, .rnr-com-tx');
        const reviews = reviewTexts
            .map(t => t?.trim())
            .filter(Boolean)
            .slice(0, 10);

        await this.close();
        return { productUrl, reviews, rating, status: 'ok' };
    }
}
