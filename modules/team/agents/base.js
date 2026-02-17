// modules/team/agents/base.js
import fs from 'fs';
import path from 'path';
import { chat, log } from '../../../core/ai-provider.js';
import sharedMemory from '../shared-memory.js';

export class BaseAgent {
    constructor(name, role, context = {}) {
        this.name = name.toLowerCase();
        this.displayName = name;
        this.role = role;
        this.context = context; // API, config, etc.
        this.agentDir = sharedMemory.getAgentDir(this.name);

        this.ensureSoul();
    }

    ensureSoul() {
        const soulPath = path.join(this.agentDir, 'SOUL.md');
        if (!fs.existsSync(soulPath)) {
            const defaultSoul = `# SOUL.md — ${this.displayName}

Sen ${this.displayName}, ${this.role} rolündesin.

## Sorumlulukların
- [Buraya sorumlulukları girin]

## Kişilik
- Profesyonel, verimli.

## Kanal
- Telegram/CLI (@${this.name} yanıt verir)
`;
            fs.writeFileSync(soulPath, defaultSoul, 'utf-8');
        }
    }

    getSoul() {
        return fs.readFileSync(path.join(this.agentDir, 'SOUL.md'), 'utf-8');
    }

    async getSystemPrompt() {
        const shared = sharedMemory.getEverything();
        const soul = this.getSoul();

        return `${soul}

## TAKIM PAYLAŞILAN BAĞLAMI
Sen çoklu-ajan takımının bir parçasısın. Aşağıdaki paylaşılan belgelere erişimin var:

### HEDEFLER (GOALS)
${shared.goals}

### PROJE DURUMU (STATUS)
${shared.status}

### KARAR GÜNLÜĞÜ (DECISIONS)
${shared.decisions}

## TALİMATLAR
1. SOUL.md ve Rolüne uygun hareket et.
2. Önemli bir karar alırsan, DECISIONS.md dosyasını güncellemeyi talep et.
3. Eğer başka bir ajanın uzmanlığına ihtiyacın varsa, yanıtında şu formatı kullan:
   \`[DELEGATE: AjanIsmi Soru veya Görev]\`
   Örnek: \`[DELEGATE: Josh iPhone kılıflarının kar marjını kontrol et]\`
4. Kısa ve öz ol.`;
    }

    async think(userMessage, conversationHistory = []) {
        try {
            const systemPrompt = await this.getSystemPrompt();

            // Format history for the AI provider if needed, or just append to prompt
            // For now, we rely on the provider's handling or just send the current message + context

            const response = await chat(userMessage, {
                aiProvider: process.env.VANTUZ_AI_PROVIDER || 'gemini',
                systemContext: systemPrompt
            }, process.env);

            return response;
        } catch (error) {
            log('ERROR', `Agent ${this.displayName} crashed`, { error: error.message });
            return `I encountered an error: ${error.message}`;
        }
    }

    async process(message) {
        log('INFO', `Agent ${this.displayName} processing message`);
        return await this.think(message);
    }
}
