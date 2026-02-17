// modules/team/index.js
import { MiloAgent } from './agents/milo.js';
import { JoshAgent } from './agents/josh.js';
import { MarketingAgent } from './agents/marketing.js';
import { DevAgent } from './agents/dev.js';
import sharedMemory from './shared-memory.js';
import { log } from '../../core/ai-provider.js';

class TeamModule {
    constructor(api) {
        this.api = api;
        this.agents = {};
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        this.agents = {
            milo: new MiloAgent(this.api),
            josh: new JoshAgent(this.api),
            marketing: new MarketingAgent(this.api),
            dev: new DevAgent(this.api)
        };

        // Ensure shared memory structure
        sharedMemory.ensureStructure();

        this.initialized = true;
        log('INFO', 'Team Module initialized with agents: Milo, Josh, Marketing, Dev');
    }

    getAgent(name) {
        return this.agents[name.toLowerCase()];
    }

    async chat(agentName, message, depth = 0) {
        if (depth > 3) return "Hata: Çok fazla delegasyon döngüsü (max 3).";

        const agent = this.getAgent(agentName);
        if (!agent) {
            return `Agent '${agentName}' bulunamadı. Mevcut: ${Object.keys(this.agents).join(', ')}`;
        }

        let response = await agent.process(message);

        // Delegasyon Kontrolü: [DELEGATE: TargetAgent Message]
        const delegateMatch = response.match(/\[DELEGATE:\s*(\w+)\s+(.*?)\]/i);
        if (delegateMatch) {
            const targetAgentName = delegateMatch[1];
            const targetMessage = delegateMatch[2];

            log('INFO', `Delegasyon: ${agentName} -> ${targetAgentName}: ${targetMessage}`);

            const delegateResponse = await this.chat(targetAgentName, targetMessage, depth + 1);

            // Cevabı orijinal ajana geri bildir ve nihai cevabı al
            const followupMessage = `[SİSTEM]: ${targetAgentName} şu cevabı verdi: "${delegateResponse}". Buna göre kullanıcıya nihai cevabını ver.`;
            response = await agent.process(followupMessage);
        }

        return response;
    }

    async broadcast(message) {
        const results = {};
        for (const [name, agent] of Object.entries(this.agents)) {
            results[name] = await agent.process(message);
        }
        return results;
    }

    getSharedMemory() {
        return sharedMemory;
    }
}

export default TeamModule;
