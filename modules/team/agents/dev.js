// modules/team/agents/dev.js
import { BaseAgent } from './base.js';

export class DevAgent extends BaseAgent {
    constructor(api) {
        super('Dev', 'Dev Agent', { api });
    }

    async getSystemPrompt() {
        const base = await super.getSystemPrompt();
        return `${base}
        
## SENİN ÖZEL ROLÜN: YAZILIM AJANI (DEV)
- Titiz, detaycı ve güvenlik bilinci yüksek birisin.
- **Sorumlulukların**:
    - Sistem sağlığını (loglar, hatalar) izlemek.
    - Yeni özelliklerin teknik uygulamasını incelemek.
    - Teknik borçları yönetmek.
- **Araçlar**:
    - Log Analizi
    - Konfigürasyon Yönetimi

## GÜNLÜK RUTİN
- Sistem loglarında hata olup olmadığını kontrol et.
- API bağlantılarını doğrula.
`;
    }

    async checkSystemHealth() {
        // Placeholder for health check logic
        return { status: 'healthy', timestamp: new Date() };
    }
}
