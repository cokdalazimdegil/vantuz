// core/database.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url'; // Import fileURLToPath
import { log } from './ai-provider.js';

const __filename = fileURLToPath(import.meta.url); // Define __filename
const __dirname = path.dirname(__filename); // Define __dirname

const DB_PATH = path.join(os.homedir(), '.vantuz', 'eia_data.db');

class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        if (this.db) return this.db;

        try {
            this.db = await open({
                filename: DB_PATH,
                driver: sqlite3.Database
            });
            await this.db.migrate({
                migrationsPath: path.join(__dirname, 'migrations')
            });
            log('INFO', 'SQLite database initialized and migrated');
            return this.db;
        } catch (error) {
            log('ERROR', `Failed to initialize database: ${error.message}`, { error });
            throw error;
        }
    }

    async close() {
        if (this.db) {
            await this.db.close();
            this.db = null;
            log('INFO', 'SQLite database closed');
        }
    }

    // Example: Save product data
    async saveProduct(product) {
        const { id, name, price, cost, platform } = product;
        await this.db.run(
            `INSERT OR REPLACE INTO products (id, name, price, cost, platform, lastUpdated) VALUES (?, ?, ?, ?, ?, ?)`,
            id, name, price, cost, platform, new Date().toISOString()
        );
        log('INFO', `Product ${name} saved/updated`);
    }

    // Example: Get product by ID
    async getProduct(id) {
        return this.db.get(`SELECT * FROM products WHERE id = ?`, id);
    }

    // Example: Save historical price
    async saveHistoricalPrice(productId, price, timestamp) {
        await this.db.run(
            `INSERT INTO historical_prices (productId, price, timestamp) VALUES (?, ?, ?)`,
            productId, price, timestamp
        );
        log('INFO', `Historical price for product ${productId} saved`);
    }

    // Example: Get historical prices for a product
    async getHistoricalPrices(productId) {
        return this.db.all(`SELECT * FROM historical_prices WHERE productId = ? ORDER BY timestamp ASC`, productId);
    }
}

let dbInstance = null;

export function getDatabase() {
    if (!dbInstance) {
        dbInstance = new Database();
    }
    return dbInstance;
}