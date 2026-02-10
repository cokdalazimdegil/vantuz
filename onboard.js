#!/usr/bin/env node

/**
 * VANTUZ - Profesyonel Kurulum Sihirbazı
 * v3.2.7 - OpenClaw Gateway Entegrasyonlu
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VANTUZ_HOME = path.join(os.homedir(), '.vantuz');
const CONFIG_PATH = path.join(VANTUZ_HOME, '.env');

// Colors
const colors = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m'
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const LOGO = `
    V A N T U Z   A I
    -----------------
    Enterprise E-Ticaret Yönetimi
`;

const WELCOME_BOX = `
-----------------------------------------------------------------
  HOŞ GELDİNİZ - Vantuz AI Kurulumu
-----------------------------------------------------------------

  Bu sihirbaz kurulumu tamamlamanıza yardımcı olacak:
  
  [ ] AI Servis Seçimi
  [ ] Pazaryeri Bağlantıları
  [ ] İletişim Kanalları
  [ ] OpenClaw Gateway Yapılandırması

-----------------------------------------------------------------
`;

class OnboardingWizard {
    constructor() {
        this.envVars = {};
        this.step = 0;
        this.totalSteps = 6; // Updated total steps
    }

    async step_EIAConfig() {
        this.step = 5; // Adjust step number
        this.printHeader('E-TICARET YÖNETİM AJANSI (EIA) YAPILANDIRMASI');

        console.log('EIA\'nın operasyonlarını optimize etmek için bazı bilgiler sağlayın.\n');

        const competitorUrls = await this.prompt('Rakip Ürün URL\'leri (virgülle ayırarak): ');
        if (competitorUrls) {
            this.envVars.EIA_COMPETITOR_URLS = competitorUrls.trim();
            console.log(c('green', '[OK] Rakip URL\'leri kaydedildi.\n'));
        } else {
            console.log(c('yellow', '[BİLGİ] Rakip URL\'leri girilmedi.\n'));
        }

        const profitMargin = await this.prompt('Hedef Kar Marjı (%) [15]: ');
        if (profitMargin && !isNaN(parseFloat(profitMargin))) {
            this.envVars.EIA_TARGET_PROFIT_MARGIN = parseFloat(profitMargin);
            console.log(c('green', '[OK] Hedef Kar Marjı kaydedildi.\n'));
        } else {
            this.envVars.EIA_TARGET_PROFIT_MARGIN = 15; // Default if invalid
            console.log(c('yellow', '[BİLGİ] Geçersiz kar marjı, varsayılan %15 kullanılıyor.\n'));
        }
        await sleep(1000);
    }

    clear() { console.clear(); }

    async showLogo() {
        this.clear();
        console.log(c('cyan', LOGO));
        await sleep(500);
    }

    async run() {
        try {
            await this.showLogo();
            await this.showWelcome();
            console.log(c('green', '⚡ Geliştirici Modu: Lisans kontrolü atlandı.\n'));
            await this.step1_AIProvider();
            await this.step2_Platforms();
            await this.step3_Channels();
            await this.step4_Gateway();
            await this.step_EIAConfig(); // New step
            await this.step5_Save();
            await this.showSuccess();
        } catch (error) {
            console.error('\n' + c('red', `Beklenmeyen Hata: ${error.message}`));
            process.exit(1);
        }
    }

    printHeader(title) {
        this.clear();
        console.log(c('cyan', LOGO));
        console.log('\n' + c('bold', `ADIM ${this.step}/${this.totalSteps}: ${title}`));
        console.log('-'.repeat(50) + '\n');
    }

    async showWelcome() {
        console.log(WELCOME_BOX);
        await this.prompt(c('dim', 'Devam etmek için Enter\'a basın...'));
    }

    // ADIM 1: AI PROVIDER
    async step1_AIProvider() {
        this.step = 1;
        this.printHeader('YAPAY ZEKA SERVİSİ');

        console.log('Kullanılacak AI modelini seçin:\n');
        console.log('  1. Google Gemini (Önerilen/Ücretsiz)');
        console.log('  2. OpenAI GPT-4o');
        console.log('  3. Anthropic Claude 3.5');
        console.log('  4. DeepSeek V3');
        console.log('  5. Groq (Hızlı/Ücretsiz)');
        console.log(c('dim', '  S. Atla (Daha sonra ayarla)\n'));

        const choice = await this.prompt('Seçiminiz (1-5 veya S) [1]: ') || '1';

        if (choice.toLowerCase() === 's') {
            console.log(c('yellow', '\n[ATLANDI] AI yapılandırması geçildi.\n'));
            await sleep(1000);
            return;
        }

        const providers = {
            '1': { label: 'Google Gemini', env: 'GEMINI_API_KEY' },
            '2': { label: 'OpenAI', env: 'OPENAI_API_KEY' },
            '3': { label: 'Anthropic', env: 'ANTHROPIC_API_KEY' },
            '4': { label: 'DeepSeek', env: 'DEEPSEEK_API_KEY' },
            '5': { label: 'Groq', env: 'GROQ_API_KEY' }
        };

        const selected = providers[choice] || providers['1'];
        console.log(c('green', `\n[SEÇİLDİ] ${selected.label}\n`));

        const key = await this.prompt(`${selected.label} API Key: `);

        if (key && key.trim()) {
            this.envVars[selected.env] = key.trim();
            console.log(c('green', '\n[OK] API anahtarı kaydedildi.\n'));
        } else {
            console.log(c('yellow', '\n[BİLGİ] API anahtarı girilmedi, daha sonra ekleyebilirsiniz.\n'));
        }
        await sleep(1000);
    }

    // ADIM 2: PAZARYERLERİ
    async step2_Platforms() {
        this.step = 2;
        this.printHeader('PAZARYERİ ENTEGRASYONLARI');

        console.log('Hangi pazaryerini yapılandırmak istersiniz?\n');
        console.log('  1. Trendyol');
        console.log('  2. Hepsiburada');
        console.log('  3. N11');
        console.log('  4. Amazon');
        console.log(c('dim', '  S. Atla (Tümünü geç)\n'));

        const choice = await this.prompt('Seçiminiz (1-4 veya S) [1]: ') || '1';

        if (choice.toLowerCase() === 's') return;

        if (choice === '1') {
            console.log(c('cyan', '\nTrendyol Yapılandırması\n'));
            console.log(c('dim', '(Boş bırakıp Enter\'a basarak geçebilirsiniz)\n'));

            const supplierId = await this.prompt('Supplier ID: ');
            if (!supplierId) {
                console.log(c('yellow', '[ATLANDI] Trendyol ayarları yapılmadı.'));
                return;
            }

            const apiKey = await this.prompt('API Key: ');
            const apiSecret = await this.prompt('API Secret: ');

            this.envVars.TRENDYOL_SUPPLIER_ID = supplierId;
            this.envVars.TRENDYOL_API_KEY = apiKey;
            this.envVars.TRENDYOL_API_SECRET = apiSecret;

            console.log(c('green', '\n[OK] Trendyol bilgileri alındı.\n'));
            await sleep(1000);
        }
    }

    // ADIM 3: KANALLAR
    async step3_Channels() {
        this.step = 3;
        this.printHeader('İLETİŞİM KANALLARI');

        console.log('WhatsApp ve Telegram entegrasyonu.\n');

        const setup = await this.prompt('Telegram Bot Token eklemek ister misiniz? (e/H): ');

        if (setup.toLowerCase() === 'e' || setup.toLowerCase() === 'y') {
            const token = await this.prompt('Telegram Bot Token: ');
            if (token) {
                this.envVars.TELEGRAM_BOT_TOKEN = token;
                console.log(c('green', '\n[OK] Telegram token alındı.\n'));
            }
        }

        console.log(c('dim', '\nNot: WhatsApp bağlantısı "openclaw channels login" ile yapılır.\n'));
        await sleep(1500);
    }

    // ADIM 4: VANTUZ GATEWAY
    async step4_Gateway() {
        this.step = 4;
        this.printHeader('VANTUZ GATEWAY');

        console.log('Vantuz Gateway, AI ve kanal yönetimini güçlendirir.\n');

        // .openclaw/ klasörü kontrolü
        const openclawDir = path.join(process.cwd(), '.openclaw');
        const openclawConfig = path.join(openclawDir, 'openclaw.json');

        if (fs.existsSync(openclawConfig)) {
            console.log(c('green', '✔ Gateway yapılandırması bulundu.'));
            try {
                const config = JSON.parse(fs.readFileSync(openclawConfig, 'utf-8'));
                if (config.gateway?.auth?.token) {
                    console.log(c('green', '✔ Token ve güvenlik anahtarları hazır.'));
                }
            } catch (e) {
                console.log(c('yellow', '⚠ Config okunamadı.'));
            }
        } else {
            console.log(c('yellow', '⚠ Gateway yapılandırması eksik.'));
            console.log(c('dim', '\nOtomatik olarak oluşturulacak...\n'));
        }

        console.log(c('dim', '\nBaşlatmak için sadece: start.bat'));
        console.log(c('dim', 'Durum kontrolü:  vantuz gateway status\n'));

        await this.prompt(c('dim', 'Devam etmek için Enter\'a basın...'));
    }

    // KAYDET
    async step5_Save() {
        this.step = 5;
        this.printHeader('AYARLAR KAYDEDİLİYOR');

        console.log('Yapılandırma dosyası oluşturuluyor...');

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
        console.log(c('green', `[OK] Dosya kaydedildi: ${CONFIG_PATH}`));
        await sleep(500);

        // Klasörler
        ['logs', 'data', 'cache'].forEach(dir => {
            const p = path.join(VANTUZ_HOME, dir);
            if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        });
        console.log(c('green', '[OK] Veri klasörleri oluşturuldu.'));
        await sleep(1000);
    }

    async showSuccess() {
        this.clear();
        console.log('\n');
        console.log(c('green', '=================================================='));
        console.log(c('green', '           KURULUM BAŞARIYLA TAMAMLANDI           '));
        console.log(c('green', '=================================================='));
        console.log('\n');
        console.log('Vantuz AI kullanıma hazırdır.\n');
        console.log('Başlamak için şu komutları kullanabilirsiniz:');
        console.log(c('cyan', '  vantuz tui') + '        - Sohbet arayüzünü başlatır');
        console.log(c('cyan', '  vantuz status') + '     - Sistem durumunu gösterir');
        console.log(c('cyan', '  vantuz gateway') + '    - Gateway durumunu gösterir');
        console.log(c('cyan', '  vantuz doctor') + '     - Sistem sağlık kontrolü');
        console.log('\n');

        await this.prompt(c('dim', 'Çıkmak için Enter\'a basın...'));
    }

    // ARAÇLAR
    prompt(question) {
        return new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.question(question, (answer) => {
                rl.close();
                resolve(answer.trim());
            });
        });
    }
}

// BAŞLAT
const wizard = new OnboardingWizard();
wizard.run();
