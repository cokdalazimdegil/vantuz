// core/migrations/001-initial-schema.js
export async function up(db) {
    await db.exec(`
        CREATE TABLE products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price REAL,
            cost REAL,
            platform TEXT NOT NULL,
            lastUpdated TEXT
        );

        CREATE TABLE historical_prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId TEXT NOT NULL,
            price REAL NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
        );
    `);
}

export async function down(db) {
    await db.exec(`
        DROP TABLE IF EXISTS historical_prices;
        DROP TABLE IF EXISTS products;
    `);
}
