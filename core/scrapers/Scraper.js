// core/scrapers/Scraper.js
import { chromium } from 'playwright';

export class Scraper {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async init() {
        if (!this.browser) {
            this.browser = await chromium.launch({ headless: true }); // headless: true for production
        }
        this.page = await this.browser.newPage();
    }

    async close() {
        if (this.page) {
            await this.page.close();
            this.page = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async goTo(url) {
        if (!this.page) {
            throw new Error('Scraper not initialized. Call init() first.');
        }
        await this.page.goto(url);
    }

    async extractText(selector) {
        if (!this.page) return null;
        return this.page.locator(selector).textContent();
    }

    async extractAttribute(selector, attribute) {
        if (!this.page) return null;
        return this.page.locator(selector).getAttribute(attribute);
    }

    async extractAllText(selector) {
        if (!this.page) return [];
        return this.page.locator(selector).allTextContents();
    }

    async type(selector, text) {
        if (!this.page) return;
        await this.page.locator(selector).type(text);
    }

    async click(selector) {
        if (!this.page) return;
        await this.page.locator(selector).click();
    }

    // You can add more generic scraping methods here
}
