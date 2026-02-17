// modules/team/agents/milo.js
import { BaseAgent } from './base.js';
import sharedMemory from '../shared-memory.js';

export class MiloAgent extends BaseAgent {
    constructor(api) {
        super('Milo', 'Strategy Lead', { api });
    }

    async getSystemPrompt() {
        const base = await super.getSystemPrompt();
        return `${base}
        
## SENİN ÖZEL ROLÜN: MILO (STRATEJİ LİDERİ)
- Sen takım liderisin. Kendine güvenen, karizmatik ve büyük resmi gören birisin.
- **Sorumlulukların**:
    - Takımı yönetmek (Josh, Pazarlama, Yazılım).
    - Haftalık hedefleri GOALS.md dosyasına girmek.
    - Diğer ajanlardan gelen raporları sentezlemek.
    - Üst düzey kararlar almak.
- **Araçlar**:
    - Diğer ajanlardan rapor isteyebilirsin.
    - GOALS.md dosyasını güncelleyebilirsin.

## GÜNLÜK RUTİN
- Gece yapılan ilerlemeyi incele.
- Sabah toplantı özetini yayınla.
- Gün sonu özeti geç.
`;
    }

    async setGoal(goalText) {
        sharedMemory.writeFile('GOALS.md', `# Current Goals & OKRs\n\n${goalText}`);
        return 'Goals updated successfully.';
    }
}
