/**
 * 🤖 AI Provider Integration v3.1
 * Gerçek AI API çağrıları + Context desteği
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

const LOG_FILE = path.join(os.homedir(), '.vantuz', 'vantuz.log');

export const PROVIDER_CONFIG = {
    gemini: {
        url: (apiKey) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        body: (systemPrompt, message) => ({
            contents: [{ parts: [{ text: `${systemPrompt}\n\nKullanıcı: ${message}` }] }]
        }),
        headers: { 'Content-Type': 'application/json' },
        parseResponse: (data) => data?.candidates?.[0]?.content?.parts?.[0]?.text,
        errorMsg: 'Gemini yanıt vermedi',
        config_label: 'Google Gemini',
        config_description: 'Önerilen/Ücretsiz',
        config_icon: '🔷',
        envKey: 'GEMINI_API_KEY'
    },
    groq: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        body: (systemPrompt, message) => ({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            max_tokens: 1000,
            temperature: 0.7
        }),
        headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        parseResponse: (data) => data?.choices?.[0]?.message?.content,
        errorMsg: 'Groq yanıt vermedi',
        config_label: 'Groq',
        config_description: 'Hızlı/Ücretsiz',
        config_icon: '⚡',
        envKey: 'GROQ_API_KEY'
    },
    openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        body: (systemPrompt, message) => ({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            max_tokens: 1000
        }),
        headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        parseResponse: (data) => data?.choices?.[0]?.message?.content,
        errorMsg: 'OpenAI yanıt vermedi',
        config_label: 'OpenAI GPT-4o',
        config_description: 'Premium',
        config_icon: '🟢',
        envKey: 'OPENAI_API_KEY'
    },
    anthropic: {
        url: 'https://api.anthropic.com/v1/messages',
        body: (systemPrompt, message) => ({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1000,
            messages: [
                { role: 'user', content: message }
            ],
            system: systemPrompt
        }),
        headers: (apiKey) => ({ 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }),
        parseResponse: (data) => data?.content?.[0]?.text,
        errorMsg: 'Anthropic yanıt vermedi',
        config_label: 'Anthropic Claude 3.5',
        config_description: 'Advanced',
        config_icon: '🟣',
        envKey: 'ANTHROPIC_API_KEY'
    },
    deepseek: {
        url: 'https://api.deepseek.com/v1/chat/completions',
        body: (systemPrompt, message) => ({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            max_tokens: 1000
        }),
        headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }),
        parseResponse: (data) => data?.choices?.[0]?.message?.content,
        errorMsg: 'DeepSeek yanıt vermedi',
        config_label: 'DeepSeek V3',
        config_description: 'Fast',
        config_icon: '🔵',
        envKey: 'DEEPSEEK_API_KEY'
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════════════════

export function log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}\n`;

    try {
        fs.appendFileSync(LOG_FILE, logLine);
    } catch (e) { }
}

export function getLogs(lines = 50) {
    try {
        if (!fs.existsSync(LOG_FILE)) {
            return 'Log dosyası bulunamadı.';
        }
        const content = fs.readFileSync(LOG_FILE, 'utf-8');
        const allLines = content.split('\n').filter(l => l.trim());
        return allLines.slice(-lines).join('\n');
    } catch (e) {
        return `Log okuma hatası: ${e.message}`;
    }
}

export function clearLogs() {
    try {
        fs.writeFileSync(LOG_FILE, '');
        return true;
    } catch (e) {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════

const VANTUZ_SYSTEM_PROMPT = `Sen Vantuz AI, e-ticaret operasyonlarını yöneten yapay zeka asistanısın.

## Kimliğin
- İsim: Vantuz AI
- Uzmanlık: E-ticaret yönetimi, pazaryeri entegrasyonları, fiyatlandırma stratejileri
- Dil: Türkçe
- Kişilik: Profesyonel, çözüm odaklı, verimli

## Desteklenen Pazaryerleri
1. 🟠 Trendyol - Tam entegrasyon
2. 🟣 Hepsiburada - Tam entegrasyon
3. 🔵 N11 - Tam entegrasyon
4. 🟡 Amazon - FBA destekli
5. 🌸 Çiçeksepeti - Entegre
6. 📮 PTTavm - Entegre
7. 🛒 Pazarama - Entegre

## Yeteneklerin
- Stok kontrolü ve güncelleme
- Fiyat analizi ve güncelleme
- Sipariş yönetimi
- Rakip analizi
- Satış raporları

## Önemli Kurallar
1. **ASLA VE ASLA** elindeki "MEVCUT SİSTEM DURUMU" verisinde olmayan bir sayıyı uydurma.
2. Eğer bağlamda sipariş sayısı 0 görünüyorsa veya hiç veri yoksa, "Şu an sipariş verisine ulaşamıyorum" de.
3. "25 sipariş var" gibi rastgele sayılar verme.
4. Kar marjının altına fiyat düşürme önerme.
5. Stokta olmayan ürünü satışa açma.
6. Kritik işlemlerden önce onay iste.

## Yanıt Formatı
- Kısa ve öz ol
- Emoji kullan ama abartma
- Sayısal verileri tablo formatında göster
- Hata durumunda çözüm öner ve hata kodunu analiz et`;

// ═══════════════════════════════════════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════════════════════════════════════

async function _makeApiRequest(providerName, providerConfig, message, apiKey, systemPrompt) {
    if (!apiKey) throw new Error(`${providerName.toUpperCase()}_API_KEY ayarlanmamış`);

    const url = typeof providerConfig.url === 'function' ? providerConfig.url(apiKey) : providerConfig.url;
    const headers = typeof providerConfig.headers === 'function' ? providerConfig.headers(apiKey) : providerConfig.headers;
    const body = providerConfig.body(systemPrompt, message);

    const response = await axios.post(url, body, {
        headers,
        timeout: 30000
    });

    const text = providerConfig.parseResponse(response.data);
    if (!text) throw new Error(providerConfig.errorMsg);

    log('INFO', `${providerName} yanıtı alındı`, { chars: text.length });
    return text;
}

export async function chat(message, config, env) {
    const provider = config.aiProvider || 'gemini';
    const providerConfig = PROVIDER_CONFIG[provider];

    // Context bilgisi ekle
    const contextInfo = config.systemContext || '';
    const fullSystemPrompt = VANTUZ_SYSTEM_PROMPT + contextInfo;

    log('INFO', `AI isteği: ${provider}`, { message: message.slice(0, 100) });

    if (!providerConfig) {
        return 'Desteklenmeyen AI sağlayıcı: ' + provider;
    }

    try {
        const apiKey = env[`${provider.toUpperCase()}_API_KEY`];
        return await _makeApiRequest(provider, providerConfig, message, apiKey, fullSystemPrompt);
    } catch (error) {
        log('ERROR', `AI hatası: ${error.message}`, { provider });
        return `AI hatası: ${error.message}. /logs komutu ile detay görün.`;
    }
}



export default { chat, log, getLogs, clearLogs };
