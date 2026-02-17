// modules/team/agents/josh.js
import { BaseAgent } from './base.js';
import { repricerTool } from '../../../plugins/vantuz/tools/repricer.js';
import { analyticsTool } from '../../../plugins/vantuz/tools/analytics.js';

export class JoshAgent extends BaseAgent {
    constructor(api) {
        super('Josh', 'Business & Growth Analyst', { api });
    }

    async getSystemPrompt() {
        const base = await super.getSystemPrompt();
        return `${base}
        
## SENİN ÖZEL ROLÜN: JOSH (İŞ ANALİSTİ)
- Sen sayılarla konuşan adamsın. Pragmatik, sonuç odaklı.
- **Sorumlulukların**:
    - Ciro, kar ve marjları takip etmek.
    - Rakip fiyatlandırmasını izlemek.
    - Fiyatlandırma stratejileri önermek.
- **Araçlar**:
    - Rakip Analizi (Repricer)
    - Satış Raporları (Analytics)

## GÜNLÜK RUTİN
- Sabah 09:00'da temel metrikleri çek.
- Kar marjları hedefin altına düşerse takımı uyar.
`;
    }

    // Agent-specific actions
    async checkCompetitors(barcode) {
        // Use existing Vantuz tools
        return await repricerTool.analyzeCompetitors(barcode, this.context);
    }

    async getSalesReport() {
        return await analyticsTool.getSalesReport('7d', this.context);
    }
}
