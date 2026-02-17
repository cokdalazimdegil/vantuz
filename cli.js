#!/usr/bin/env node

/**
 * 🐙 VANTUZ CLI v3.2
 * Vantuz Gateway entegrasyonlu komut satırı arayüzü
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import readline from 'readline';
import { log, getLogs, clearLogs } from './core/ai-provider.js';
import { getEngine } from './core/engine.js';
import { getGateway } from './core/gateway.js';
import { licenseManager } from './core/license.js'; // Lisans yöneticisi
import { Configurator } from './config.js'; // Import the new Configurator

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const VANTUZ_HOME = path.join(os.homedir(), '.vantuz');
const CONFIG_PATH = path.join(VANTUZ_HOME, '.env');
const CONFIG_JSON = path.join(VANTUZ_HOME, 'config.json');

if (!fs.existsSync(VANTUZ_HOME)) {
    fs.mkdirSync(VANTUZ_HOME, { recursive: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const colors = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    cyan: '\x1b[36m', blue: '\x1b[34m', magenta: '\x1b[35m'
};
const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

function loadEnv() {
    const env = {};
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) env[match[1].trim()] = match[2].trim();
            });
        }
    } catch (e) { }
    return env;
}

function loadConfigJson() {
    try {
        if (fs.existsSync(CONFIG_JSON)) {
            return JSON.parse(fs.readFileSync(CONFIG_JSON, 'utf-8'));
        }
    } catch (e) {
        console.log(c('red', `Config okunamadı: ${e.message}`));
    }
    return {};
}

function saveConfigJson(config) {
    try {
        fs.writeFileSync(CONFIG_JSON, JSON.stringify(config, null, 2));
        return true;
    } catch (e) {
        console.log(c('red', `Config yazılamadı: ${e.message}`));
        return false;
    }
}

function clearScreen() {
    process.stdout.write('\x1Bc');
}

async function promptInput(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => rl.question(question, resolve));
    rl.close();
    return answer.trim();
}

function normalizePhone(input) {
    if (!input) return '';
    const cleaned = input.replace(/[\s-]/g, '');
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

function loadOpenclawConfig(configPath) {
    try {
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
    } catch (e) {
        console.log(c('red', `Gateway config okunamadı: ${e.message}`));
    }
    return {};
}

function saveOpenclawConfig(configPath, config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (e) {
        console.log(c('red', `Gateway config yazılamadı: ${e.message}`));
        return false;
    }
}

function printHeader() {
    const version = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8')).version;
    console.log(c('cyan', `
    ██╗   ██╗ █████╗ ███╗   ██╗████████╗██╗   ██╗███████╗
    ██║   ██║██╔══██╗████╗  ██║╚══██╔══╝██║   ██║╚══███╔╝
    ██║   ██║███████║██╔██╗ ██║   ██║   ██║   ██║  ███╔╝ 
    ╚██╗ ██╔╝██╔══██║██║╚██╗██║   ██║   ██║   ██║ ███╔╝  
     ╚████╔╝ ██║  ██║██║ ╚████║   ██║   ╚██████╔╝███████╗
      ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝ ╚══════╝
    `));
    console.log(c('magenta', `    Enterprise E-Commerce Management System v${version}`));
    console.log(c('dim', '    Powered by nca'));
    console.log(c('dim', '    ----------------------------------------------------------\n'));
}

async function showSpinner(text, duration = 1000) {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const interval = setInterval(() => {
        process.stdout.write(`\r${c('cyan', frames[i])} ${text}...`);
        i = (i + 1) % frames.length;
    }, 80);
    await new Promise(r => setTimeout(r, duration));
    clearInterval(interval);
    process.stdout.write(`\r${c('green', '✔')} ${text} Tamamlandı\n`);
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

async function runTUI() {
    clearScreen();
    printHeader();

    // Lisans Kontrolü
    const license = licenseManager.check();
    if (!license.valid) {
        console.log(c('red', `\n🛑 ERİŞİM ENGELLENDİ: ${license.message}`));
        console.log(c('yellow', 'Lütfen geçerli bir lisans anahtarı girin.'));
        
        const key = await promptInput(c('cyan', 'Lisans Anahtarı (VTZ-XXXX): '));
        const result = licenseManager.activate(key);
        
        if (!result.success) {
            console.log(c('red', `Hata: ${result.message}`));
            process.exit(1);
        }
        console.log(c('green', `✔ ${result.message}`));
        await new Promise(r => setTimeout(r, 1000));
        clearScreen();
        printHeader();
    }

    await showSpinner('Sistem çekirdeği yükleniyor', 500);
    await showSpinner('Vantuz Gateway kontrol ediliyor', 400);
    await showSpinner('Pazaryeri bağlantıları kontrol ediliyor', 800);

    const engine = await getEngine();
    const status = engine.getStatus();

    // Gateway durumu
    if (status.gateway?.connected) {
        console.log(`${c('green', '●')} Vantuz Gateway ${c('green', 'Bağlı')} ${c('dim', `(${status.gateway.url})`)}`);
    } else {
        console.log(`${c('yellow', '○')} Vantuz Gateway ${c('yellow', 'Bağlı Değil')} ${c('dim', '(direkt mod)')}`);
    }

    console.log(`${c('green', '●')} Sistem Aktif ${c('dim', `(${status.connectedCount}/${status.totalPlatforms} Platform Bağlı)`)}`);
    console.log(`${c('blue', 'ℹ')} AI Sağlayıcı: ${c('bold', status.aiProvider || 'Gemini')}`);
    console.log(`${c('yellow', '⚡')} Komutlar: ${c('cyan', '/stok, /siparis, /rapor, /analiz, /durum, /temizle, /exit')}\n`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: c('magenta', 'Vantuz> ')
    });

    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();
        if (input === '/exit') process.exit(0);
        if (input === '/temizle') {
            clearScreen();
            printHeader();
            rl.prompt();
            return;
        }

        if (input) {
            try {
                if (input.startsWith('/')) {
                    const [cmd, ...cmdArgs] = input.split(' ');
                    switch (cmd) {
                        case '/help':
                            console.log(c('yellow', '\nKullanılabilir Komutlar:'));
                            console.log(`  ${c('cyan', '/stok')}     - Tüm pazaryerlerindeki stok durumunu gösterir`);
                            console.log(`  ${c('cyan', '/siparis')}  - Son siparişleri listeler`);
                            console.log(`  ${c('cyan', '/durum')}    - Sistem durumunu gösterir`);
                            console.log(`  ${c('cyan', '/temizle')} - Ekranı temizler`);
                            console.log(`  ${c('cyan', '/exit')}     - Çıkış\n`);
                            break;
                        case '/stok':
                            console.log(c('dim', 'Stok verileri çekiliyor...'));
                            const stocks = await engine.getStock();
                            if (stocks.length === 0) console.log(c('yellow', 'Bağlı platform bulunamadı.'));
                            stocks.forEach(s => {
                                console.log(`\n${s.icon} ${c('bold', s.platform.toUpperCase())}`);
                                s.products.slice(0, 5).forEach(p => {
                                    console.log(`  - ${p.title}: ${c('green', p.stock)} Adet | ${c('yellow', p.price)} TL`);
                                });
                            });
                            break;
                        case '/analiz':
                            process.stdout.write(c('dim', 'Analiz hazırlanıyor... '));
                            const analysis = await engine.chat('satış ve stok analiz raporu hazırla');
                            process.stdout.write('\r' + ' '.repeat(30) + '\r');
                            console.log(`\n${analysis}\n`);
                            break;
                        case '/siparis':
                            console.log(c('dim', 'Siparişler çekiliyor...'));
                            const orders = await engine.getOrders({ size: 50, allStatuses: true });
                            const activeOrders = Array.isArray(orders)
                                ? orders.filter(o => ['Created', 'Picking', 'UnPacked'].includes(String(o.status || o.shipmentPackageStatus || o.orderStatus)))
                                : [];
                            const visible = activeOrders.slice(0, 5);
                            if (!Array.isArray(orders) || visible.length === 0) {
                                console.log(c('yellow', 'Son sipariş bulunamadı.'));
                                break;
                            }
                            visible.forEach(o => {
                                const names = Array.isArray(o.lines)
                                    ? o.lines.map(l => l?.productName || l?.name).filter(Boolean)
                                    : [];
                                const namePart = names.length > 0 ? ` | ${names.join(', ')}` : '';
                                console.log(`${o._icon} [#${o.orderNumber || o.id}] ${c('bold', o.customerName || 'Müşteri')}: ${c('green', o.totalPrice ?? o.totalAmount ?? o.total ?? '—')} TL (${o._platform})${namePart}`);
                            });
                            break;
                        case '/durum':
                            const s = engine.getStatus();
                            console.log(c('yellow', '\n── Sistem Durumu ──'));
                            console.log(`  Engine: ${s.engine === 'active' ? c('green', '● Aktif') : c('red', '○ Pasif')}`);
                            console.log(`  Gateway: ${s.gateway?.connected ? c('green', '● Bağlı') : c('yellow', '○ Bağlı Değil')}`);
                            console.log(`  AI: ${c('cyan', s.aiProvider || 'gemini')}`);
                            console.log(`  Platformlar: ${c('bold', `${s.connectedCount}/${s.totalPlatforms}`)}`);
                            console.log('');
                            break;
                        default:
                            console.log(c('red', `[HATA] Bilinmeyen komut: ${cmd}. /help yazın.`));
                    }
                } else {
                    process.stdout.write(c('dim', 'Düşünüyor... '));
                    const response = await engine.handleMessage(input, { channel: 'local', from: 'local' });
                    process.stdout.write('\r' + ' '.repeat(20) + '\r');
                    console.log(`\n${c('cyan', '🐙 Vantuz:')}\n${response}\n`);
                }
            } catch (e) {
                console.log(c('red', `\n[HATA] ${e.message}`));
            }
        }
        rl.prompt();
    });
}

async function runConfig(args) {
    const sub = args[1]?.toLowerCase();
    const config = loadConfigJson(); // config.json operations

    if (sub === 'init') {
        const configurator = new Configurator();
        await configurator.run();
        return;
    }

    if (sub === 'init' || !sub) { // If sub is 'init' OR no sub-command is provided
        const configurator = new Configurator();
        await configurator.run();
        return; // IMPORTANT: Return after running the configurator
    }

    if (sub === 'get') { // Handle 'get' sub-command
        printHeader();
        if (args[2]) {
            const key = args[2];
            const value = config?.[key];
            console.log(value === undefined ? '' : String(value));
            return;
        }
        console.log(JSON.stringify(config, null, 2));
        return;
    }

    if (sub === 'set') {
        const key = args[2];
        const value = args.slice(3).join(' ');
        if (!key) {
            console.log(c('red', 'Kullanım: vantuz config set <key> <value>'));
            process.exitCode = 2;
            return;
        }
        config[key] = value;
        const ok = saveConfigJson(config);
        if (ok) {
            console.log(c('green', '[OK] Config güncellendi'));
        } else {
            process.exitCode = 1;
        }
        return;
    }

    console.log(c('red', 'Geçersiz config komutu. Kullanım: vantuz config [init | get [key] | set <key> <value>]'));
    process.exitCode = 2;
}

async function runLogs(args) {
    const sub = args[1]?.toLowerCase();
    if (sub === 'clear' || sub === 'temizle') {
        const ok = clearLogs();
        if (ok) console.log(c('green', '[OK] Loglar temizlendi'));
        else {
            console.log(c('red', '[HATA] Loglar temizlenemedi'));
            process.exitCode = 1;
        }
        return;
    }

    const nRaw = args[1];
    const n = nRaw && /^\d+$/.test(nRaw) ? Number(nRaw) : 50;
    printHeader();
    console.log(getLogs(n));
}

async function runGateway(args) {
    const sub = args[1]?.toLowerCase();
    const gw = await getGateway();
    const info = gw.getInfo();

    if (!sub || sub === 'status') {
        printHeader();
        console.log(c('yellow', '── Vantuz Gateway ──\n'));
        console.log(`  URL:       ${c('cyan', info.url)}`);
        console.log(`  Durum:     ${info.connected ? c('green', '● Bağlı') : c('red', '○ Bağlı Değil')}`);
        console.log(`  Token:     ${info.hasToken ? c('green', '✔ Yapılandırılmış') : c('yellow', '✘ Eksik')}`);
        console.log(`  Config:    ${info.configFound ? c('green', '✔ Bulundu') : c('yellow', '✘ Bulunamadı')}`);
        if (info.version) console.log(`  Sürüm:     ${c('dim', info.version)}`);
        console.log('');

        if (!info.connected) {
            console.log(c('dim', '  Gateway başlatmak için: vantuz gateway run'));
            console.log(c('dim', '  Veya: start.bat\n'));
        }
        return;
    }

    if (sub === 'health') {
        const result = await gw.health();
        if (result.success) {
            console.log(c('green', '✔ Gateway sağlıklı'));
            if (result.data) console.log(JSON.stringify(result.data, null, 2));
        } else {
            console.log(c('red', `✘ Gateway erişilemez: ${result.error}`));
        }
        return;
    }

    if (sub === 'models') {
        const result = await gw.getModels();
        if (result.success) {
            console.log(c('yellow', '── AI Modelleri ──\n'));
            const models = result.data?.data || result.data || [];
            if (Array.isArray(models)) {
                models.forEach(m => {
                    console.log(`  ${c('cyan', m.id || m.name)} ${c('dim', m.description || '')}`);
                });
            } else {
                console.log(JSON.stringify(models, null, 2));
            }
        } else {
            console.log(c('red', `Modeller alınamadı: ${result.error}`));
        }
        return;
    }

    if (sub === 'run' || sub === 'start') {
        console.log(c('cyan', 'Gateway başlatılıyor...'));
        const result = await gw.start();
        if (result.success) {
            console.log(c('green', '✔ Gateway arka planda başlatıldı.'));
            console.log(c('dim', 'Birkaç saniye içinde hazır olacak.'));
            console.log(c('dim', 'Kontrol için: vantuz gateway status'));
        } else {
            console.log(c('red', result.error || 'Gateway başlatılamadı'));
        }
        return;
    }

    console.log(c('red', 'Kullanım: vantuz gateway [status|health|models|run]'));
}

async function runDoctor() {
    printHeader();
    console.log(c('yellow', '── Sistem Sağlık Kontrolü ──\n'));

    await showSpinner('Kontroller yapılıyor', 800);

    const engine = await getEngine();
    const report = await engine.doctor();

    // Engine
    console.log(`  Engine:    ${report.engine ? c('green', '● Aktif') : c('red', '○ Pasif')}`);

    // Gateway
    const gw = report.gateway;
    const gwIcon = gw.status === 'healthy' ? c('green', '●') :
        gw.status === 'not_configured' ? c('yellow', '○') : c('red', '○');
    console.log(`  Gateway:   ${gwIcon} ${gw.status === 'healthy' ? 'Sağlıklı' : gw.status === 'not_configured' ? 'Yapılandırılmamış' : 'Erişilemez'}`);

    // AI
    const ai = report.ai;
    console.log(`  AI:        ${c('cyan', ai.provider)} ${ai.keyConfigured ? c('green', '✔ Key OK') : c('red', '✘ Key Eksik')} ${ai.gatewayFallback ? c('dim', '(gateway fallback var)') : ''}`);

    // Platformlar
    const platformEntries = Object.entries(report.platforms).filter(([k]) => k !== 'openclaw-gateway');
    if (platformEntries.length > 0) {
        console.log(`\n  ${c('bold', 'Platformlar:')}`);
        platformEntries.forEach(([name, connected]) => {
            console.log(`    ${connected ? c('green', '●') : c('red', '○')} ${name}`);
        });
    } else {
        console.log(`  Platformlar: ${c('yellow', 'Hiçbiri bağlı değil')}`);
    }

    // Kanallar
    const ch = report.channels;
    if (ch) {
        console.log(`\n  ${c('bold', 'Kanallar:')}`);
        for (const [name, data] of Object.entries(ch)) {
            console.log(`    ${data.connected ? c('green', '●') : c('yellow', '○')} ${name}: ${data.info || ''}`);
        }
    }

    console.log('');
}

async function runChannels(args) {
    const sub = args[1]?.toLowerCase();
    if (sub === 'login') {
        printHeader();
        console.log(c('yellow', '── WhatsApp Login ──\n'));

        const openclawDir = path.join(os.homedir(), '.openclaw');
        const configPath = path.join(openclawDir, 'openclaw.json');

        if (!fs.existsSync(openclawDir)) {
            fs.mkdirSync(openclawDir, { recursive: true });
        }

        const rawPhone = await promptInput('WhatsApp numaranız (E.164, örn: +905551112233): ');
        const phone = normalizePhone(rawPhone);
        if (!phone || phone === '+') {
            console.log(c('red', 'Geçerli bir numara girilmedi.'));
            process.exitCode = 2;
            return;
        }

        const config = loadOpenclawConfig(configPath);
        if (!config.channels) config.channels = {};
        if (!config.channels.whatsapp) config.channels.whatsapp = {};

        if (!config.channels.whatsapp.dmPolicy) {
            config.channels.whatsapp.dmPolicy = 'allowlist';
        }

        const allowFrom = Array.isArray(config.channels.whatsapp.allowFrom)
            ? config.channels.whatsapp.allowFrom
            : [];
        if (!allowFrom.includes(phone)) {
            allowFrom.push(phone);
        }
        config.channels.whatsapp.allowFrom = allowFrom;

        const saved = saveOpenclawConfig(configPath, config);
        if (!saved) {
            process.exitCode = 1;
            return;
        }

        console.log(c('green', '✔ Gateway config güncellendi.'));
        console.log(c('dim', 'Şimdi QR için login başlatılıyor...\n'));

        try {
            const { spawn } = await import('child_process');
            const child = spawn('openclaw', ['channels', 'login'], {
                stdio: 'inherit',
                shell: true
            });
            await new Promise((resolve, reject) => {
                child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`gateway exit ${code}`))));
                child.on('error', reject);
            });
            console.log(c('green', '\n✔ QR eşleştirme tamamlandı.'));
            console.log(c('dim', 'Gateway başlatmak için: vantuz gateway run'));
        } catch (e) {
            console.log(c('red', `Login çalıştırılamadı: ${e.message}`));
        }
        return;
    }

    printHeader();
    console.log(c('yellow', '── İletişim Kanalları ──\n'));

    const engine = await getEngine();
    const status = engine.getStatus();
    const channels = status.channels || {};

    for (const [name, data] of Object.entries(channels)) {
        const icon = data.connected ? c('green', '●') : c('yellow', '○');
        const mode = data.mode === 'gateway' ? c('dim', '[gateway]') : c('dim', '[local]');
        console.log(`  ${icon} ${c('bold', name.toUpperCase())} ${mode}`);
        if (data.info) console.log(`    ${c('dim', data.info)}`);
        console.log('');
    }

    if (!status.gateway?.connected) {
        console.log(c('dim', '  WhatsApp bağlantısı için gateway gereklidir.'));
        console.log(c('dim', '  Gateway başlatmak için: start.bat\n'));
    }
}

async function runTeam(args) {
    const sub = args[1]?.toLowerCase();
    const engine = await getEngine();
    
    if (!engine.initialized) {
        await showSpinner('AI Takımı hazırlanıyor', 500);
        await engine.initialize();
    }

    if (!engine.team) {
         console.log(c('red', 'Multi-Agent Team modülü aktif değil.'));
         return;
    }

    if (!sub || sub === 'status') {
        printHeader();
        console.log(c('yellow', '── Yapay Zeka Takımı ──\n'));
        const agents = engine.team.agents;
        
        if (Object.keys(agents).length === 0) {
             console.log(c('dim', '  Henüz ajan yüklenmedi.'));
        } else {
            for (const [name, agent] of Object.entries(agents)) {
                 console.log(`  ${c('green', '●')} ${c('bold', agent.displayName)}: ${c('dim', agent.role)}`);
            }
        }
        console.log('');
        console.log(c('dim', '  Komutlar:'));
        console.log(c('dim', '    vantuz team chat <isim> "mesaj"'));
        console.log(c('dim', '    vantuz team broadcast "duyuru"'));
        console.log('');
        return;
    }

    if (sub === 'chat') {
        const agentName = args[2];
        const message = args.slice(3).join(' ');
        if (!agentName || !message) {
             console.log(c('red', 'Kullanım: vantuz team chat <agent> <mesaj>'));
             return;
        }
        console.log(c('dim', `${agentName} düşünüyor...`));
        try {
            const response = await engine.team.chat(agentName, message);
            console.log(`\n${c('cyan', agentName + ':')} ${response}\n`);
        } catch (e) {
            console.log(c('red', `Hata: ${e.message}`));
        }
    }

    if (sub === 'broadcast') {
        const message = args.slice(2).join(' ');
        if (!message) {
             console.log(c('red', 'Kullanım: vantuz team broadcast <mesaj>'));
             return;
        }
        console.log(c('dim', 'Tüm takıma iletiliyor...'));
        try {
            const results = await engine.team.broadcast(message);
            for (const [name, resp] of Object.entries(results)) {
                console.log(`\n${c('bold', name.toUpperCase())}: ${resp}`);
            }
        } catch (e) {
            console.log(c('red', `Hata: ${e.message}`));
        }
        console.log('');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

async function main() {
    switch (command) {
        case 'tui':
        case 'chat':
            await runTUI();
            break;

        case 'config':
            await runConfig(args);
            break;

        case 'logs':
            await runLogs(args);
            break;

        case 'gateway':
        case 'gw':
            await runGateway(args);
            break;

        case 'doctor':
        case 'check':
            await runDoctor();
            break;

        case 'channels':
        case 'ch':
            await runChannels(args);
            break;

        case 'status':
            printHeader();
            const lic = licenseManager.getInfo();
            if (lic.valid) {
                console.log(`Lisans Durumu: ${c('green', 'Aktif')} (${lic.type})`);
                console.log(`Kalan Süre:  ${c('yellow', lic.daysLeft + ' Gün')}`);
            } else {
                console.log(`Lisans Durumu: ${c('red', 'Pasif/Süresi Dolmuş')}`);
            }
            const gw = await getGateway();
            const gwInfo = gw.getInfo();
            console.log(`Vantuz Gateway: ${gwInfo.connected ? c('green', '● Bağlı') : c('yellow', '○ Bağlı Değil')}`);
            break;

        case 'team':
            await runTeam(args);
            break;

        default:
            printHeader();
            console.log('Kullanım:\n');
            console.log(`  ${c('cyan', 'vantuz tui')}       - Sohbet arayüzü`);
            console.log(`  ${c('cyan', 'vantuz status')}    - Durum kontrolü`);
            console.log(`  ${c('cyan', 'vantuz team')}      - Yapay Zeka Takımı`);
            console.log(`  ${c('cyan', 'vantuz gateway')}   - Gateway yönetimi`);
            console.log(`  ${c('cyan', 'vantuz doctor')}    - Sistem sağlık kontrolü`);
            console.log(`  ${c('cyan', 'vantuz channels')}  - İletişim kanalları`);
            console.log(`  ${c('cyan', 'vantuz channels login')}  - WhatsApp QR login`);
            console.log(`  ${c('cyan', 'vantuz config')}    - Ayarları göster/güncelle`);
            console.log(`  ${c('cyan', 'vantuz logs')}      - Logları göster`);
            console.log(`\nKurulum ve başlangıç ayarları için: ${c('cyan', 'vantuz config init')}`);
            process.exitCode = command ? 2 : 0;
    }
}

main();
