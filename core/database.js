const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'vantuz.sqlite');
let db;

try {
    db = new Database(dbPath);
    console.log('✅ SQLite DB connected directly.');
} catch (e) {
    console.error('❌ SQLite connection failed:', e);
    process.exit(1);
}

// Simple Model Wrapper to mimic Sequelize API partially
class Model {
    constructor(tableName, schema) {
        this.tableName = tableName;
        this.schema = schema;
        this._initTable();
    }

    _initTable() {
        // Basic schema to SQL
        const cols = Object.entries(this.schema).map(([key, props]) => {
            let type = 'TEXT';
            if (props.type === 'INTEGER') type = 'INTEGER';
            if (props.type === 'FLOAT') type = 'REAL';
            if (props.type === 'BOOLEAN') type = 'INTEGER'; // SQLite uses 0/1
            
            let def = `${key} ${type}`;
            if (props.allowNull === false) def += ' NOT NULL';
            if (props.unique) def += ' UNIQUE';
            if (props.defaultValue !== undefined) {
                const val = typeof props.defaultValue === 'string' ? `'${props.defaultValue}'` : props.defaultValue;
                def += ` DEFAULT ${val}`;
            }
            return def;
        }).join(', ');

        const sql = `CREATE TABLE IF NOT EXISTS ${this.tableName} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${cols}, createdAt TEXT, updatedAt TEXT)`;
        db.prepare(sql).run();
    }

    async findAll(query = {}) {
        // Basic implementation
        const stmt = db.prepare(`SELECT * FROM ${this.tableName}`);
        const rows = stmt.all();
        return rows.map(r => this._parseRow(r));
    }

    async findOne(query = {}) {
        if (!query.where) return null;
        const keys = Object.keys(query.where);
        if (keys.length === 0) return null;
        
        const whereClause = keys.map(k => `${k} = ?`).join(' AND ');
        const values = keys.map(k => query.where[k]);
        
        const stmt = db.prepare(`SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1`);
        const row = stmt.get(...values);
        return row ? this._parseRow(row) : null;
    }

    async create(data) {
        const keys = Object.keys(data);
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map(k => {
            const val = data[k];
            return typeof val === 'object' ? JSON.stringify(val) : val;
        });
        
        const now = new Date().toISOString();
        // Add timestamps
        const allKeys = [...keys, 'createdAt', 'updatedAt'];
        const allPlaceholders = [...keys.map(() => '?'), '?', '?'];
        const allValues = [...values, now, now];

        const sql = `INSERT INTO ${this.tableName} (${allKeys.join(', ')}) VALUES (${allPlaceholders.join(', ')})`;
        const info = db.prepare(sql).run(...allValues);
        return { ...data, id: info.lastInsertRowid, createdAt: now, updatedAt: now };
    }
    
    async count() {
        const stmt = db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`);
        return stmt.get().count;
    }

    _parseRow(row) {
        // Convert JSON fields back to objects
        for (const [key, props] of Object.entries(this.schema)) {
            if (props.type === 'JSON' && row[key]) {
                try { row[key] = JSON.parse(row[key]); } catch {}
            }
            if (props.type === 'BOOLEAN') {
                row[key] = Boolean(row[key]);
            }
        }
        return row;
    }
}

// Define Models manually with simple types
const DataTypes = {
    STRING: 'TEXT',
    TEXT: 'TEXT', 
    INTEGER: 'INTEGER',
    FLOAT: 'FLOAT',
    BOOLEAN: 'BOOLEAN',
    JSON: 'JSON',
    DATE: 'TEXT'
};

const Store = new Model('Stores', {
    name: { type: DataTypes.STRING, allowNull: false },
    platform: { type: DataTypes.STRING, allowNull: false },
    credentials: { type: DataTypes.JSON, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: 1 }
});

const Product = new Model('Products', {
    name: { type: DataTypes.STRING, allowNull: false },
    barcode: { type: DataTypes.STRING, unique: true },
    sku: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    brand: { type: DataTypes.STRING },
    images: { type: DataTypes.JSON },
    marketData: { type: DataTypes.JSON },
    aiAnalysis: { type: DataTypes.TEXT }
});

const Order = new Model('Orders', {
    platform: { type: DataTypes.STRING, allowNull: false },
    orderNumber: { type: DataTypes.STRING, unique: true },
    customerName: { type: DataTypes.STRING },
    totalAmount: { type: DataTypes.FLOAT },
    currency: { type: DataTypes.STRING, defaultValue: 'TRY' },
    status: { type: DataTypes.STRING },
    orderDate: { type: DataTypes.DATE },
    items: { type: DataTypes.JSON }
});

const Insight = new Model('Insights', {
    type: { type: DataTypes.STRING },
    message: { type: DataTypes.TEXT },
    priority: { type: DataTypes.INTEGER },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: 0 }
});

async function initDB() {
    return true; // Tables created in constructor
}

function getDatabase() {
    return {
        Store,
        Product,
        Order,
        Insight,
        init: initDB,
        isAvailable: true
    };
}

module.exports = {
    Store,
    Product,
    Order,
    Insight,
    initDB,
    getDatabase
};
