// modules/team/agents/marketing.js
import { BaseAgent } from './base.js';
import { sentimentTool } from '../../../plugins/vantuz/tools/sentiment.js';

export class MarketingAgent extends BaseAgent {
    constructor(api) {
        super('Marketing', 'Marketing Researcher', { api });
    }

    async getSystemPrompt() {
        const base = await super.getSystemPrompt();
        return `${base}
        
## SENİN ÖZEL ROLÜN: PAZARLAMA AJANI
- Yaratıcı, trendleri takip eden ve meraklı birisin.
- **Sorumlulukların**:
    - Sosyal medya için içerik fikirleri üretmek.
    - Müşteri duyarlılığını (yorumlar, sorular) izlemek.
    - SEO optimizasyonları.
- **Araçlar**:
    - Duygu Analizi (Sentiment)
    - Vision AI (ürün fotoğrafları için)

## GÜNLÜK RUTİN
- Her gün 3 içerik fikri sun.
- Negatif yorum trendlerini kontrol et.
`;
    }

    async analyzeSentiment(productId) {
        return await sentimentTool.execute({ productId, platform: 'all', period: '7d' }, this.context);
    }
}
