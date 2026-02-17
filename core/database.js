const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Veritabanı dosyasının yolu (Kullanıcının home dizininde veya proje klasöründe)
const dbPath = path.join(process.cwd(), 'vantuz.sqlite');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    dialectModule: require('better-sqlite3'),
    logging: false // Konsolu kirletmesin
});

// --- MODELLER ---

// Mağaza Ayarları (API Keyler vb.)
const Store = sequelize.define('Store', {
    name: { type: DataTypes.STRING, allowNull: false },
    platform: { type: DataTypes.STRING, allowNull: false }, // trendyol, amazon, etc.
    credentials: { type: DataTypes.JSON, allowNull: false }, // { apiKey: '...', apiSecret: '...' }
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

// Ürünler
const Product = sequelize.define('Product', {
    name: { type: DataTypes.STRING, allowNull: false },
    barcode: { type: DataTypes.STRING, unique: true },
    sku: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    brand: { type: DataTypes.STRING },
    images: { type: DataTypes.JSON }, // Resim URL'leri listesi
    marketData: { type: DataTypes.JSON }, // { trendyol: { price: 100, stock: 10 }, amazon: { ... } }
    aiAnalysis: { type: DataTypes.TEXT } // AI tarafından üretilen satış önerileri
});

// Siparişler
const Order = sequelize.define('Order', {
    platform: { type: DataTypes.STRING, allowNull: false },
    orderNumber: { type: DataTypes.STRING, unique: true },
    customerName: { type: DataTypes.STRING },
    totalAmount: { type: DataTypes.FLOAT },
    currency: { type: DataTypes.STRING, defaultValue: 'TRY' },
    status: { type: DataTypes.STRING },
    orderDate: { type: DataTypes.DATE },
    items: { type: DataTypes.JSON } // Sipariş içeriği
});

// Loglar ve AI Önerileri
const Insight = sequelize.define('Insight', {
    type: { type: DataTypes.STRING }, // 'pricing', 'stock', 'trend'
    message: { type: DataTypes.TEXT },
    priority: { type: DataTypes.INTEGER }, // 1: Düşük, 5: Kritik
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// Veritabanını Başlat
async function initDB() {
    try {
        await sequelize.sync({ alter: true }); // Tabloları güncelle
        return true;
    } catch (error) {
        console.error('Veritabanı hatası:', error);
        return false;
    }
}

module.exports = {
    sequelize,
    Store,
    Product,
    Order,
    Insight,
    initDB
};
