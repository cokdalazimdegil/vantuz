#!/usr/bin/env node

const fs = require('fs');
const clear = require('console-clear');
const figlet = require('figlet');
const chalk = require('chalk');
const inquirer = require('inquirer');
const boxen = require('boxen');
const ora = require('ora');
const Conf = require('conf');
const db = require('./core/database');
const licenseManager = require('./core/license-manager');

// ... (Diğer importlar aynı) ...
const productManager = require('./core/product-manager');
const brandAnalyst = require('./core/brand-analyst');
const platforms = {
    trendyol: require('./platforms/trendyol')
};

const config = new Conf({ projectName: 'vantuz' });

// --- GİZLİ ADMIN MODU ---
// KODDAN SİLİNDİ. Lisans üretimi harici araçla yapılır.

const printHeader = () => {
    clear();
    console.log(chalk.cyan(figlet.textSync('VANTUZ', { horizontalLayout: 'full' })));
    console.log(chalk.grey('   🐙 E-Ticaretin Yapay Zeka Beyni | v2.2 Enterprise\n'));
};

async function main() {
    printHeader();

    // 1. Karşılama ve İlk Kurulum Kontrolü
    const isFirstRun = !config.get('installed');

    if (isFirstRun) {
        await welcomeScreen();
    }

    // 2. Lisans Kontrolü
    let licenseKey = config.get('licenseKey');
    let licenseStatus = licenseKey ? licenseManager.verifyLicense(licenseKey) : { valid: false };

    if (!licenseStatus.valid) {
        if (licenseKey) console.log(chalk.red(`⚠️  Lisans Hatası: ${licenseStatus.reason}`));

        console.log(boxen(chalk.white('🔒 VANTUZ Lisans Aktivasyonu\nDevam etmek için satıcınızdan aldığınız anahtarı girin.'), { padding: 1, borderColor: 'cyan', borderStyle: 'classic' }));
        await activateLicense();
    } else {
        const daysLeft = Math.floor((new Date(licenseStatus.data.expiry) - new Date()) / (1000 * 60 * 60 * 24));
        console.log(chalk.green(`✅ Lisanslı: ${licenseStatus.data.customer} (Kalan Süre: ${daysLeft} Gün)`));
        await new Promise(r => setTimeout(r, 1000));
    }

    // 3. Veritabanı ve Sistem
    const spinner = ora('Sistem nöronları başlatılıyor...').start();
    await db.initDB();
    spinner.succeed('Çekirdek Aktif');

    // 4. Mağaza Kontrolü
    const storeCount = await db.Store.count();
    if (storeCount === 0) {
        console.log(chalk.yellow('\n⚠️  Hiçbir mağaza bağlı değil.'));
        await setupWizard();
    }

    // 5. Ana Döngü
    while (true) {
        printHeader();
        await showDashboard(licenseStatus.data);

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Komut Merkezi:',
                choices: [
                    { name: '📦 Sipariş Yönetimi', value: 'orders' },
                    { name: '🛍️  Ürün & Stok (Vision AI)', value: 'products' },
                    { name: '🧠 Pazar Analizi', value: 'ai' },
                    { name: '➕ Mağaza Ekle', value: 'add_store' },
                    { name: '⚙️  Ayarlar', value: 'settings' },
                    { name: '🚪 Çıkış', value: 'exit' }
                ]
            }
        ]);

        if (action === 'exit') process.exit(0);
        await handleAction(action);
    }
}

async function welcomeScreen() {
    clear();
    console.log(chalk.cyan(figlet.textSync('Merhaba!', { horizontalLayout: 'full' })));
    console.log(boxen(chalk.white(`
    VANTUZ'a Hoşgeldiniz.

    Bu yazılım, e-ticaret operasyonlarınızı yapay zeka ile yönetmenizi sağlar.
    Kuruluma başlamadan önce lütfen şunları hazırlayın:

    1. Lisans Anahtarınız
    2. Pazaryeri API Bilgileriniz (Trendyol, Hepsiburada vb.)
    3. (Opsiyonel) OpenAI API Anahtarı - Vision özelliği için

    Başlamaya hazır mısınız?
    `), { padding: 1, borderStyle: 'double', borderColor: 'green' }));

    const { ready } = await inquirer.prompt([{ type: 'confirm', name: 'ready', message: 'Kuruluma Başla', default: true }]);
    if (!ready) {
        console.log(chalk.yellow('Kurulum iptal edildi. Çıkılıyor...'));
        process.exit(0);
    }
    config.set('installed', true);
}

async function activateLicense() {
    const { key } = await inquirer.prompt([{ type: 'password', name: 'key', message: 'Lisans Anahtarı:', mask: '*' }]);
    const spinner = ora('Anahtar doğrulanıyor...').start();
    await new Promise(r => setTimeout(r, 1500)); // Dramatik bekleme

    const status = licenseManager.verifyLicense(key);

    if (status.valid) {
        spinner.succeed(`Lisans Aktif: ${status.data.customer}`);
        config.set('licenseKey', key);
        await new Promise(r => setTimeout(r, 1000));
    } else {
        spinner.fail(`Hata: ${status.reason}`);
        console.log(chalk.yellow('Lütfen geçerli bir anahtar girin veya satıcınızla görüşün.'));
        process.exit(1);
    }
}

// ... (setupWizard, showDashboard, handleAction fonksiyonları aynı kalacak, sadece ufak revizyonlar) ...

// setupWizard fonksiyonunu güncelleme (Mağaza kurulumu)
async function setupWizard() {
    console.log(chalk.bold('\n🛒 Mağaza Bağlantı Sihirbazı\n'));
    const { storeName } = await inquirer.prompt([{ type: 'input', name: 'storeName', message: 'Mağaza Adı:' }]);

    const { platform } = await inquirer.prompt([
        {
            type: 'list',
            name: 'platform',
            message: 'Pazaryeri Seçin:',
            choices: [
                { name: '🟧 Trendyol', value: 'trendyol' },
                { name: '🟧 Hepsiburada', value: 'hepsiburada' },
                { name: '🐞 N11', value: 'n11' },
                { name: '📦 Amazon (SP-API)', value: 'amazon' }
            ]
        }
    ]);

    let creds = {};

    if (platform === 'trendyol') {
        console.log(chalk.cyan('\n👉 Trendyol Entegrasyonu:'));
        creds = await inquirer.prompt([
            { type: 'password', name: 'supplierId', message: 'Supplier ID:', mask: '*' },
            { type: 'password', name: 'apiKey', message: 'API Key:', mask: '*' },
            { type: 'password', name: 'apiSecret', message: 'API Secret:', mask: '*' }
        ]);
    } else if (platform === 'hepsiburada') {
        console.log(chalk.cyan('\n👉 Hepsiburada Entegrasyonu:'));
        creds = await inquirer.prompt([
            { type: 'input', name: 'merchantId', message: 'Merchant ID:' },
            { type: 'password', name: 'username', message: 'Username (MP):', mask: '*' },
            { type: 'password', name: 'password', message: 'Password:', mask: '*' }
        ]);
    } else if (platform === 'n11') {
        console.log(chalk.cyan('\n👉 N11 Entegrasyonu:'));
        creds = await inquirer.prompt([
            { type: 'password', name: 'apiKey', message: 'API Key:', mask: '*' },
            { type: 'password', name: 'apiSecret', message: 'API Secret:', mask: '*' }
        ]);
    } else if (platform === 'amazon') {
        console.log(chalk.cyan('\n👉 Amazon SP-API Entegrasyonu:'));
        creds = await inquirer.prompt([
            { type: 'input', name: 'sellerId', message: 'Seller ID:' },
            { type: 'password', name: 'clientId', message: 'Client ID:', mask: '*' },
            { type: 'password', name: 'clientSecret', message: 'Client Secret:', mask: '*' },
            { type: 'password', name: 'refreshToken', message: 'Refresh Token:', mask: '*' },
            { type: 'list', name: 'region', message: 'Bölge:', choices: ['eu', 'na', 'tr'], default: 'tr' }
        ]);
    }

    await db.Store.create({ name: storeName, platform, credentials: creds });
    console.log(chalk.green(`\n✅ ${storeName} (${platform}) Başarıyla Bağlandı!`));

    // AI Brand Analysis
    await brandAnalyst.analyzeAndSave(storeName, config);

    await new Promise(r => setTimeout(r, 1500));
}

async function showDashboard(licenseData) {
    const stores = await db.Store.findAll();
    const orders = await db.Order.count();

    console.log(chalk.bold(`🏢 Lisans Sahibi: ${chalk.cyan(licenseData.customer)}`));
    console.log(`📦 Aktif Mağazalar: ${stores.length} | Toplam Sipariş: ${orders}`);
    console.log(chalk.grey('----------------------------------------'));
}

async function handleAction(action) {
    if (action === 'products') await productManager.manageProducts();
    if (action === 'add_store') await setupWizard();
    // Diğer aksiyonlar...
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
