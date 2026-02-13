

/**
 * VANTUZ - Profesyonel Kurulum Sihirbazı
 * v3.2.7 - Gateway Entegrasyonlu
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { fileURLToPath, pathToFileURL } from 'url';
import { PROVIDER_CONFIG } from './core/ai-provider.js'; // Import PROVIDER_CONFIG

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VANTUZ_HOME = path.join(os.homedir(), '.vantuz');
const CONFIG_PATH = path.join(VANTUZ_HOME, '.env');

// Enhanced Colors with background support
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    italic: '\x1b[3m',
    underscore: '\x1b[4m',

    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',

    // Bright foreground colors
    brightBlack: '\x1b[90m',
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',
    brightWhite: '\x1b[97m',

    // Background colors
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m'
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced box drawing characters
const box = {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    leftT: '╠',
    rightT: '╣',
    topT: '╦',
    bottomT: '╩',
    cross: '╬'
};

const LOGO = `
${colors.cyan}${colors.bold}
    ╦  ╦╔═╗╔╗╔╔╦╗╦ ╦╔═╗  ╔═╗╦
    ╚╗╔╝╠═╣║║║ ║ ║ ║╔═╝  ╠═╣║
     ╚╝ ╩ ╩╝╚╝ ╩ ╚═╝╚═╝  ╩ ╩╩
${colors.reset}
${colors.brightCyan}    Enterprise E-Ticaret Yönetimi${colors.reset}
`;

const createBox = (title, content, width = 65) => {
    const lines = content.split('\n');
    let result = '';

    // Top border with title
    result += c('brightCyan', box.topLeft + box.horizontal.repeat(3));
    result += c('bold', ` ${title} `);
    result += c('brightCyan', box.horizontal.repeat(width - title.length - 5) + box.topRight) + '\n';

    // Content
    lines.forEach(line => {
        const padding = ' '.repeat(Math.max(0, width - line.length - 2));
        result += c('brightCyan', box.vertical) + ' ' + line + padding + ' ' + c('brightCyan', box.vertical) + '\n';
    });

    // Bottom border
    result += c('brightCyan', box.bottomLeft + box.horizontal.repeat(width) + box.bottomRight) + '\n';

    return result;
};

const WELCOME_BOX = createBox('HOŞ GELDİNİZ', `
  Bu sihirbaz kurulumu tamamlamanıza yardımcı olacak:
  
  ${c('brightGreen', '✓')} AI Servis Seçimi
  ${c('brightGreen', '✓')} Pazaryeri Bağlantıları
  ${c('brightGreen', '✓')} İletişim Kanalları
  ${c('brightGreen', '✓')} Gateway Yapılandırması
`);

class Configurator {
    constructor() {
        this.envVars = Configurator.loadEnvFile();
        this.step = 0;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            crlfDelay: Infinity
        });
        this.platforms = []; // Initialize platforms array
    }

    async _loadPlatformMetadata() {
        const platformFiles = await fs.promises.readdir(path.join(__dirname, 'platforms'));
        const dynamicPlatforms = [];

        for (const file of platformFiles) {
            if (file.endsWith('.js') && !file.startsWith('_')) { // Exclude helper files
                const platformPath = path.join(__dirname, 'platforms', file);
                try {
                    // Dynamic import for ES Modules
                    const platformModule = await import(pathToFileURL(platformPath).href);
                    // Check if module.exports is present (CommonJS) or default export (ESM)
                    const platform = platformModule.default || platformModule;

                    if (platform.name && platform.requiredFields) {
                        dynamicPlatforms.push({
                            id: file.replace('.js', ''),
                            name: platform.name,
                            icon: platform.icon || '🛒', // Default icon if not specified
                            description: platform.description || '',
                            requiredFields: platform.requiredFields
                        });
                    }
                } catch (error) {
                    console.warn(this.warningMessage(`Platform dosyasını yüklerken hata oluştu: ${file} - ${error.message}`));
                }
            }
        }
        // Sort platforms alphabetically by name
        this.platforms = dynamicPlatforms.sort((a, b) => a.name.localeCompare(b.name));
    }

    static loadEnvFile() {
        const env = {};
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
                content.split('\n').forEach(line => {
                    const match = line.match(/^([^=]+)=(.*)$/);
                    if (match) env[match[1].trim()] = match[2].trim();
                });
            }
        } catch (e) {
            console.error(c('red', `✗ Config yükleme hatası: ${e.message}`));
        }
        return env;
    }

    async step_EIAConfig() {
        this.printHeader('E-TİCARET YÖNETİM AJANSI (EIA) YAPILANDIRMASI', '📊');

        console.log(c('brightWhite', 'EIA\'nın e-ticaret operasyonlarınızı optimize etmesi için kritik bilgiler sağlayın.\n'));
        console.log(this.infoMessage('Bu bilgiler, EIA\'nın pazar analizi ve stratejik kararlarında kullanılacaktır.'));

        await sleep(200);

        const currentCompetitorUrls = this.envVars.EIA_COMPETITOR_URLS || '';
        console.log(this.createInputBox('Rakip Ürün URL\'leri', 'Virgülle ayırarak birden fazla rakip ürün veya kategori URL\'si girebilirsiniz. (Örn: https://rakip.com/urun1, https://rakip.com/kategori)'));
        const competitorUrls = await this.prompt('', currentCompetitorUrls);

        // Basic validation for URLs
        const urls = competitorUrls.split(',').map(url => url.trim()).filter(url => url !== '');
        const invalidUrls = urls.filter(url => url && (!url.startsWith('http://') && !url.startsWith('https://')));

        if (competitorUrls && invalidUrls.length === 0) {
            this.envVars.EIA_COMPETITOR_URLS = competitorUrls.trim();
            console.log(this.successMessage('Rakip URL\'leri kaydedildi/güncellendi. EIA, bu kaynakları izleyecektir.'));
        } else if (competitorUrls && invalidUrls.length > 0) {
            console.log(this.errorMessage(`Geçersiz URL(ler) tespit edildi: ${invalidUrls.join(', ')}. Lütfen geçerli URL'ler girin.`));
            // Do not save invalid URLs, keep previous if any
            if (currentCompetitorUrls) { // If there were previous valid URLs, keep them.
                this.envVars.EIA_COMPETITOR_URLS = currentCompetitorUrls;
            } else { // If there were no previous valid URLs, clear it.
                delete this.envVars.EIA_COMPETITOR_URLS;
            }
            await sleep(2000); // Give user time to read error
        }
        else { // If competitorUrls is empty
            if (this.envVars.EIA_COMPETITOR_URLS) {
                delete this.envVars.EIA_COMPETITOR_URLS;
                console.log(this.infoMessage('Rakip URL\'leri temizlendi. EIA, rakip analizi yapmayacaktır.'));
            } else {
                console.log(this.infoMessage('Rakip URL\'leri girilmedi. EIA, rakip analizi yapmayacaktır.'));
            }
        }

        const currentProfitMargin = this.envVars.EIA_TARGET_PROFIT_MARGIN ? String(this.envVars.EIA_TARGET_PROFIT_MARGIN) : '15';
        console.log(this.createInputBox('Hedef Kar Marjı (%)', 'Ürünleriniz için ulaşmak istediğiniz ortalama kar marjı hedefi. (Örnek: 15)'));
        const profitMargin = await this.prompt('', currentProfitMargin);

        if (profitMargin && !isNaN(parseFloat(profitMargin)) && parseFloat(profitMargin) >= 0) {
            this.envVars.EIA_TARGET_PROFIT_MARGIN = parseFloat(profitMargin);
            console.log(this.successMessage('Hedef Kar Marjı kaydedildi/güncellendi. EIA, fiyatlandırma önerilerinde bu marjı dikkate alacaktır.'));
        } else {
            if (this.envVars.EIA_TARGET_PROFIT_MARGIN) {
                delete this.envVars.EIA_TARGET_PROFIT_MARGIN;
                console.log(this.infoMessage('Hedef Kar Marjı temizlendi. EIA, varsayılan bir kar marjı kullanabilir.'));
            } else {
                this.envVars.EIA_TARGET_PROFIT_MARGIN = 15; // Default if invalid and no previous value
                console.log(this.infoMessage('Geçersiz kar marjı girildi, varsayılan %15 kullanılacaktır.'));
            }
        }
        await sleep(1000);
    }

    clear() {
        console.clear();
    }

    async showLogo() {
        this.clear();
        console.log(LOGO);
        await sleep(500);
    }

    async runFullOnboarding() {
        try {
            await this.showLogo();
            await this.showWelcome();
            console.log(c('brightGreen', '⚡ Geliştirici Modu: Lisans kontrolü atlandı.\n'));
            await this._loadPlatformMetadata(); // Load platform data
            await this.step1_AIProvider();
            await this.step2_Platforms();
            await this.step3_Channels();
            await this.step4_Gateway();
            await this.step_EIAConfig();
            await this.step_RiskAcceptance(); // Add risk acceptance step
            await this.step5_Save();
            await this.showSuccess();
        } catch (error) {
            console.error('\n' + this.errorMessage(`Beklenmeyen Hata: ${error.message}`));
        } finally {
            this.close();
        }
    }

    async run() {
        try {
            await this.showLogo();
            await this._loadPlatformMetadata(); // Load platform data

            while (true) {
                this.printHeader('VANTUZ YAPILANDIRMA MENÜSÜ', '⚙️');

                console.log(c('brightWhite', 'Lütfen yapılandırmak istediğiniz alanı seçin:\n'));

                console.log(this.menuItem('1', '🤖 Yapay Zeka Servisi', 'AI Provider'));
                console.log(this.menuItem('2', '🛒 Pazaryeri Entegrasyonları', 'Platforms'));
                console.log(this.menuItem('3', '💬 İletişim Kanalları', 'Channels'));
                console.log(this.menuItem('4', '🌐 Vantuz Gateway', 'Gateway Configuration'));
                console.log(this.menuItem('5', '📊 E-Ticaret Yönetim Ajansı', 'EIA'));
                console.log('');
                console.log(this.menuItem('A', '🚀 Tümünü Yapılandır', 'Full Onboarding', 'dim'));
                console.log(this.menuItem('S', '💾 Kaydet ve Çık', 'Save & Exit', 'dim'));
                console.log(this.menuItem('İ', '❌ İptal Et', 'Cancel without saving', 'dim'));
                console.log('');

                const choice = await this.prompt(c('brightYellow', '❯ Seçiminiz (1-5, A, S, İ)'));

                switch (choice.toLowerCase()) {
                    case '1': await this.step1_AIProvider(); break;
                    case '2': await this.step2_Platforms(); break;
                    case '3': await this.step3_Channels(); break;
                    case '4': await this.step4_Gateway(); break;
                    case '5': await this.step_EIAConfig(); break;
                    case 'a': await this.runFullOnboarding(); return;
                    case 's':
                        await this.step5_Save();
                        await this.showSuccess();
                        return;
                    case 'i':
                    case 'İ':
                        console.log(this.warningMessage('Yapılandırma iptal edildi. Değişiklikler kaydedilmedi.'));
                        return;
                    default:
                        console.log(this.errorMessage('Geçersiz seçim. Lütfen tekrar deneyin.'));
                        await sleep(1000);
                }
            }
        } catch (error) {
            console.error('\n' + this.errorMessage(`Beklenmeyen Hata: ${error.message}`));
        } finally {
            this.close();
        }
    }

    close() {
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
    }

    printHeader(title, icon = '') {
        this.clear();
        console.log(LOGO);
        console.log('');
        const fullTitle = icon ? `${icon}  ${title}` : title;
        console.log(c('bold', c('brightWhite', fullTitle)));
        console.log(c('brightCyan', '─'.repeat(65)));
        console.log('');
    }

    async showWelcome() {
        console.log(WELCOME_BOX);
        await this.prompt(c('dim', '▶ Devam etmek için Enter\'a basın...'));
    }

    menuItem(key, title, subtitle = '', style = 'normal') {
        const keyStyle = style === 'dim' ? 'dim' : 'brightYellow';
        const titleStyle = style === 'dim' ? 'dim' : 'brightWhite';
        const subtitleStyle = 'dim';

        let line = `  ${c(keyStyle, c('bold', key))}. ${c(titleStyle, title)}`;
        if (subtitle) {
            line += ` ${c(subtitleStyle, `(${subtitle})`)}`;
        }
        return line;
    }

    createInputBox(label, hint = '') {
        let output = '\n' + c('brightCyan', '┌─ ') + c('bold', label);
        if (hint) {
            output += ' ' + c('dim', `(${hint})`);
        }
        output += '\n' + c('brightCyan', '│ ');
        return output;
    }

    successMessage(text) {
        return '\n' + c('brightGreen', '✓ ') + c('green', text) + '\n';
    }

    errorMessage(text) {
        return c('brightRed', '✗ ') + c('red', text);
    }

    warningMessage(text) {
        return '\n' + c('brightYellow', '⚠ ') + c('yellow', text) + '\n';
    }

    infoMessage(text) {
        return '\n' + c('brightBlue', 'ℹ ') + c('blue', text) + '\n';
    }

    // ADIM 1: AI PROVIDER
    async step1_AIProvider() {
        this.printHeader('YAPAY ZEKA SERVİSİ', '🤖');

        console.log(c('brightWhite', 'Kullanılacak AI modelini seçin:\n'));

        // Dynamically generate menu items from PROVIDER_CONFIG
        const providerKeys = Object.keys(PROVIDER_CONFIG);
        const providerOptions = providerKeys.map((key, index) => {
            const providerInfo = PROVIDER_CONFIG[key];
            const label = providerInfo.config_label || key.charAt(0).toUpperCase() + key.slice(1);
            const description = providerInfo.config_description || '';
            const icon = providerInfo.config_icon || '';
            return {
                choice: String(index + 1),
                label: `${icon} ${label}`,
                description: description,
                envKey: providerInfo.envKey, // Store the actual env key
                key: key // Store the provider key (e.g., 'gemini', 'groq')
            };
        });

        providerOptions.forEach(option => {
            console.log(this.menuItem(option.choice, option.label, option.description));
        });
        console.log(this.menuItem('S', 'Atla', 'Daha sonra ayarla', 'dim'));
        console.log('');

        await sleep(200);

        let currentAIChoice = '';
        for (const option of providerOptions) {
            if (this.envVars[option.envKey]) {
                currentAIChoice = option.choice;
                break;
            }
        }
        if (!currentAIChoice && this.envVars.GEMINI_API_KEY) { // Fallback to Gemini if no other is set but Gemini is.
            currentAIChoice = providerOptions.find(opt => opt.envKey === 'GEMINI_API_KEY')?.choice || '';
        }
        if (!currentAIChoice) currentAIChoice = '1'; // Default to first option if nothing is set

        const choice = await this.prompt(c('brightYellow', '❯ Seçiminiz (1-' + providerOptions.length + ' veya S)'), currentAIChoice);

        if (choice.toLowerCase() === 's') {
            console.log(this.warningMessage('AI yapılandırması geçildi'));
            await sleep(1000);
            return;
        }

        const selectedOption = providerOptions.find(option => option.choice === choice);

        if (!selectedOption) {
            console.log(this.errorMessage('Geçersiz seçim. Lütfen tekrar deneyin.'));
            await sleep(1000);
            return;
        }

        console.log(this.successMessage(`${selectedOption.label.trim()} seçildi`));

        const currentKey = this.envVars[selectedOption.envKey] || '';
        console.log(this.createInputBox(`${selectedOption.label.trim()} API Key`, 'Mevcut değeri değiştirmek için yeni değer girin'));
        const key = await this.prompt('', currentKey);

        if (key && key.trim()) {
            this.envVars[selectedOption.envKey] = key.trim();
            this.envVars.AI_PROVIDER = selectedOption.key; // Save the provider key (e.g., 'groq')

            // Clear other AI keys if one is selected
            providerOptions.forEach(option => {
                if (option.envKey !== selectedOption.envKey && this.envVars[option.envKey]) {
                    delete this.envVars[option.envKey];
                }
            });
            console.log(this.successMessage('API anahtarı ve sağlayıcı seçimi kaydedildi'));
        } else {
            if (this.envVars[selectedOption.envKey]) {
                delete this.envVars[selectedOption.envKey];
                console.log(this.infoMessage('API anahtarı temizlendi'));
            } else {
                console.log(this.infoMessage('API anahtarı girilmedi, daha sonra ekleyebilirsiniz'));
            }
        }
        await sleep(1000);
    }

    // ADIM 2: PAZARYERLERİ
    async step2_Platforms() {
        this.printHeader('PAZARYERİ ENTEGRASYONLARI', '🛒');

        console.log(c('brightWhite', 'Hangi pazaryerini yapılandırmak istersiniz?\n'));

        // Dynamically generate menu items from this.platforms
        this.platforms.forEach((platform, index) => {
            console.log(this.menuItem(String(index + 1), `${platform.icon} ${platform.name}`, platform.description));
        });
        console.log(this.menuItem('S', 'Atla', 'Tümünü geç', 'dim'));
        console.log('');

        await sleep(200);
        const choice = await this.prompt(c('brightYellow', '❯ Seçiminiz (1-' + this.platforms.length + ' veya S)'));

        if (choice.toLowerCase() === 's') {
            console.log(this.warningMessage('Pazaryeri yapılandırması geçildi'));
            return;
        }

        const selectedPlatform = this.platforms[parseInt(choice) - 1];

        if (!selectedPlatform) {
            console.log(this.errorMessage('Geçersiz seçim. Lütfen tekrar deneyin.'));
            await sleep(1000);
            return;
        }

        console.log(this.successMessage(`${selectedPlatform.icon} ${selectedPlatform.name} seçildi`));
        console.log(c('dim', 'Mevcut değerleri değiştirmek için yeni değer girin veya boş bırakın\n'));

        let allFieldsProvided = true;
        for (const field of selectedPlatform.requiredFields) {
            const currentVal = this.envVars[field.env] || '';
            console.log(this.createInputBox(field.label));
            const value = await this.prompt('', currentVal);

            if (value && value.trim()) {
                this.envVars[field.env] = value.trim();
            } else {
                // If a required field is left empty, consider it not fully configured
                allFieldsProvided = false;
                delete this.envVars[field.env]; // Clear it if left empty
            }
        }

        if (allFieldsProvided) {
            console.log(this.successMessage(`${selectedPlatform.name} bilgileri alındı/güncellendi`));
            // Clear keys for other platforms to ensure only one platform's config is active if not multiple
            // This logic might need refinement if multiple platforms can be configured simultaneously.
            // For now, assuming mutually exclusive configuration.
            this.platforms.forEach(platform => {
                if (platform.id !== selectedPlatform.id) {
                    platform.requiredFields.forEach(field => {
                        if (this.envVars[field.env]) {
                            delete this.envVars[field.env];
                        }
                    });
                }
            });
        } else {
            console.log(this.infoMessage(`${selectedPlatform.name} bilgileri eksik, kaydedilmedi/temizlenmedi`));
        }
        await sleep(1000);
    }

    // ADIM 3: KANALLAR
    async step3_Channels() {
        this.printHeader('İLETİŞİM KANALLARI', '💬');

        console.log(c('brightWhite', 'Hangi iletişim kanalını yapılandırmak istersiniz?\n'));

        console.log(this.menuItem('1', 'Telegram Bot', 'Anlık bildirimler ve sohbet için'));
        console.log(this.menuItem('2', 'WhatsApp', 'Gateway üzerinden yönetilir'));
        console.log(this.menuItem('S', 'Atla', 'Daha sonra ayarla', 'dim'));
        console.log('');

        await sleep(200);
        const choice = await this.prompt(c('brightYellow', '❯ Seçiminiz (1-2 veya S)'));

        if (choice.toLowerCase() === 's') {
            console.log(this.warningMessage('İletişim kanalları yapılandırması geçildi'));
            await sleep(1000);
            return;
        }

        if (choice === '1') { // Configure Telegram
            console.log('\n' + c('bold', 'Telegram Bot Yapılandırması'));
            console.log(c('dim', 'Mevcut değeri değiştirmek için yeni değer girin veya boş bırakın\n'));

            const currentTelegramToken = this.envVars.TELEGRAM_BOT_TOKEN || '';
            console.log(this.createInputBox('Telegram Bot Token', 'BotFather\'dan alınan token'));
            const token = await this.prompt('', currentTelegramToken);

            if (token && token.trim()) {
                this.envVars.TELEGRAM_BOT_TOKEN = token.trim();
                console.log(this.successMessage('Telegram token alındı/güncellendi'));
            } else {
                delete this.envVars.TELEGRAM_BOT_TOKEN;
                console.log(this.infoMessage('Telegram token temizlendi'));
            }
            await sleep(1000);
        } else if (choice === '2') { // Information about WhatsApp
            this.printHeader('WhatsApp Kurulum Bilgisi', '💬');
            console.log(this.infoMessage('WhatsApp entegrasyonu Vantuz Gateway üzerinden sağlanır.'));
            console.log(c('brightWhite', 'Gateway\'inizi yapılandırdıktan ve başlattıktan sonra, Gateway arayüzünden WhatsApp kanalını etkinleştirebilirsiniz.\n'));
            console.log(c('dim', '  Gateway durumunu kontrol etmek için:  ') + c('brightCyan', 'vantuz gateway status'));
            console.log(c('dim', '  Gateway\'i başlatmak için:         ') + c('brightCyan', 'start.bat') + '\n');
            await this.prompt(c('dim', '▶ Devam etmek için Enter\'a basın...'));
        } else {
            console.log(this.errorMessage('Geçersiz seçim. Lütfen tekrar deneyin.'));
            await sleep(1000);
            return;
        }
    }

    // ADIM 4: VANTUZ GATEWAY
    async step4_Gateway() {
        this.printHeader('VANTUZ GATEWAY', '🌐');

        console.log(c('brightWhite', 'Vantuz Gateway, AI ve kanal yönetimini güçlendirir.\n'));

        const setupChoice = await this.prompt('Gateway durumunu kontrol etmek ve yapılandırmak ister misiniz? (e/H)', 'e');

        if (setupChoice.toLowerCase() === 'h') {
            console.log(this.warningMessage('Gateway yapılandırması geçildi'));
            await sleep(1000);
            return;
        }

        // Dynamically import getGateway to avoid circular dependency if not already imported
        const { getGateway } = await import('./core/gateway.js');
        const gateway = await getGateway();
        const info = gateway.getInfo();

        console.log(c('brightYellow', '\n── Gateway Mevcut Durumu ──'));
        console.log(`  URL:       ${c('cyan', info.url)}`);
        console.log(`  Durum:     ${info.connected ? c('brightGreen', '● Bağlı') : c('brightRed', '○ Bağlı Değil')}`);
        console.log(`  Token:     ${info.hasToken ? c('brightGreen', '✔ Yapılandırılmış') : c('brightRed', '✘ Eksik/Geçersiz')}`);
        console.log(`  Config:    ${info.configFound ? c('brightGreen', '✔ Bulundu (gateway config)') : c('brightRed', '✘ Bulunamadı (gateway config)')}`);
        if (info.version) console.log(`  Sürüm:     ${c('dim', info.version)}`);
        console.log('');

        if (!info.configFound || !info.hasToken || !info.connected) {
            console.log(this.warningMessage('Gateway tam olarak yapılandırılmamış veya çalışmıyor.'));

            const startChoice = await this.prompt('Sistemi otomatik başlatmak ister misiniz? (E/h)', 'E');
            if (startChoice.toLowerCase() !== 'h') {
                console.log(c('dim', 'Sistem başlatılıyor (Gateway + Server)...'));
                const result = await gateway.startFullStack();

                if (result.success) {
                    console.log(this.successMessage('Başlatma komutları gönderildi.'));
                    console.log(c('dim', 'Servislerin açılması 10-15 saniye sürebilir.'));
                    await sleep(5000); // Wait a bit before re-checking

                    // Re-check status
                    const newInfo = (await gateway.health()).success;
                    if (newInfo) console.log(this.successMessage('Gateway bağlantısı sağlandı!'));
                    else console.log(c('yellow', 'Gateway henüz hazır değil, arka planda açılıyor...'));
                } else {
                    console.log(this.errorMessage('Başlatma sırasında hata oluştu.'));
                    if (result.gateway?.error) console.log(c('red', `Gateway Hatası: ${result.gateway.error}`));
                    if (result.server?.error) console.log(c('red', `Server Hatası: ${result.server.error}`));
                }
            } else {
                console.log(c('dim', 'Manuel başlatmak için `start.bat` kullanabilirsiniz.'));
            }
        } else {
            console.log(this.successMessage('Gateway başarılı bir şekilde yapılandırılmış ve çalışıyor.'));
            console.log(c('dim', 'Durumu kontrol etmek için: vantuz gateway status'));
        }
        await this.prompt(c('dim', '▶ Devam etmek için Enter\'a basın...'));
    }

    // KAYDET
    async step_RiskAcceptance() {
        if (this.envVars.RISK_ACCEPTED === 'true') return;

        this.printHeader('RİSK KABULÜ', '⚠️');
        console.log(c('brightWhite', 'Vantuz AI, sizin adınıza fiyat ve stok güncellemeleri yapabilir.\n'));
        console.log(c('yellow', 'Bazı işlemler geri alınamaz olabilir. Otonom kararlar için riskleri kabul ediyor musunuz?'));
        console.log(c('dim', '(Kabul ederseniz, yazma işlemlerinde sürekli onay sormayacaktır.)\n'));

        console.log(this.menuItem('E', 'Evet, kabul ediyorum', 'Otonom mod'));
        console.log(this.menuItem('H', 'Hayır, her işlemde sor', 'Güvenli mod'));
        console.log('');

        const choice = await this.prompt(c('brightYellow', '❯ Seçiminiz (E/H)'));
        if (choice.toLowerCase() === 'e') {
            this.envVars.RISK_ACCEPTED = 'true';
            console.log(this.successMessage('Risk kabul edildi. Otonom mod aktif.'));
        } else {
            this.envVars.RISK_ACCEPTED = 'false';
            console.log(this.infoMessage('Güvenli mod aktif. Kritik işlemlerde onay istenecektir.'));
        }
        await sleep(1000);
    }

    async step5_Save() {
        this.printHeader('AYARLAR KAYDEDİLİYOR', '💾');

        console.log(c('brightWhite', 'Yapılandırma dosyası oluşturuluyor...\n'));

        if (!fs.existsSync(VANTUZ_HOME)) {
            fs.mkdirSync(VANTUZ_HOME, { recursive: true });
        }

        let envContent = '# Vantuz AI Yapılandırması\n';
        envContent += `# Oluşturulma Tarihi: ${new Date().toISOString()}\n\n`;

        for (const [key, value] of Object.entries(this.envVars)) {
            if (value) {
                envContent += `${key}=${value}\n`;
            }
        }

        fs.writeFileSync(CONFIG_PATH, envContent);
        console.log(this.successMessage(`Dosya kaydedildi: ${CONFIG_PATH}`));
        await sleep(500);

        ['logs', 'data', 'cache'].forEach(dir => {
            const p = path.join(VANTUZ_HOME, dir);
            if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        });
        console.log(this.successMessage('Veri klasörleri oluşturuldu'));
        await sleep(1000);
    }

    async showSuccess() {
        this.clear();
        console.log('\n');

        const successBox = `
${colors.brightGreen}${box.topLeft}${box.horizontal.repeat(63)}${box.topRight}
${box.vertical}${' '.repeat(17)}KURULUM BAŞARIYLA TAMAMLANDI${' '.repeat(17)}${box.vertical}
${box.bottomLeft}${box.horizontal.repeat(63)}${box.bottomRight}${colors.reset}
`;

        console.log(successBox);
        console.log(c('brightWhite', '\nVantuz AI kullanıma hazırdır! 🎉\n'));

        console.log(c('bold', 'Başlamak için şu komutları kullanabilirsiniz:\n'));
        console.log(c('brightCyan', '  vantuz tui') + c('dim', '      - Sohbet arayüzünü başlatır'));
        console.log(c('brightCyan', '  vantuz status') + c('dim', '   - Sistem durumunu gösterir'));
        console.log(c('brightCyan', '  vantuz gateway') + c('dim', '  - Gateway durumunu gösterir'));
        console.log(c('brightCyan', '  vantuz doctor') + c('dim', '   - Sistem sağlık kontrolü'));
        console.log('\n');

        await this.prompt(c('dim', '▶ Çıkmak için Enter\'a basın...'));
    }

    async promptWithRetry(question, defaultValue = '', allowEmpty = false) {
        while (true) {
            const answer = await this.prompt(question, defaultValue);
            if (answer) return answer;
            if (allowEmpty) return '';

            console.log(this.warningMessage('Boş giriş algılandı. Lütfen değeri girin (veya iptal için "iptal" yazın)'));
            const check = await this.prompt('Tekrar denensin mi? (E/h): ');
            if (check.toLowerCase() === 'h' || check.toLowerCase() === 'iptal') return '';
            await sleep(200);
        }
    }

    prompt(question, defaultValue = '') {
        const displayQuestion = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
        return new Promise((resolve) => {
            this.rl.question(displayQuestion, (answer) => {
                resolve(answer.trim() || defaultValue);
            });
        });
    }
}

export { Configurator };
