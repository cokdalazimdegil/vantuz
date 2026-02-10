/**
 * ⏰ CRON ZAMANLAYICI
 * Vantuz cron entegrasyonu ile otomatik görevler
 */

const PRESETS = {
    '15dk': '*/15 * * * *',      // Her 15 dakikada
    '30dk': '*/30 * * * *',      // Her 30 dakikada
    'saatlik': '0 * * * *',      // Her saat başı
    'gunluk-9': '0 9 * * *',     // Her gün 09:00
    'gunluk-18': '0 18 * * *',   // Her gün 18:00
    'haftalik': '0 9 * * 1',     // Pazartesi 09:00
    'aylik': '0 9 1 * *'         // Ayın 1'i 09:00
};

const TASK_TEMPLATES = {
    'rakip-kontrol': {
        prompt: 'Tüm ürünlerin rakip fiyatlarını kontrol et ve avantaj/dezavantaj durumunu raporla',
        defaultSchedule: '*/15 * * * *'
    },
    'stok-uyari': {
        prompt: 'Stoku 5 ve altına düşen ürünleri tespit et ve kritik olanları bildir',
        defaultSchedule: '0 */2 * * *'
    },
    'gunluk-rapor': {
        prompt: 'Günlük satış özeti hazırla: toplam ciro, sipariş sayısı, en çok satanlar',
        defaultSchedule: '0 18 * * *'
    },
    'haftalik-analiz': {
        prompt: 'Haftalık performans analizi: satış trendi, kar marjı, en iyi/kötü ürünler',
        defaultSchedule: '0 9 * * 1'
    },
    'fiyat-optimizasyon': {
        prompt: 'Düşük satış hızlı ürünlerde fiyat optimizasyonu öner',
        defaultSchedule: '0 10 * * *'
    },
    'yorum-analiz': {
        prompt: 'Son 24 saatteki olumsuz yorumları analiz et ve aksiyon öner',
        defaultSchedule: '0 9 * * *'
    }
};

export class SchedulerService {
    constructor(api) {
        this.api = api;
        this.jobs = new Map();
    }

    /**
     * Hazır şablon ekle
     */
    async addPreset(taskName, customSchedule = null) {
        const template = TASK_TEMPLATES[taskName];
        if (!template) {
            return { success: false, error: `Bilinmeyen görev: ${taskName}` };
        }

        const schedule = customSchedule || template.defaultSchedule;
        return await this.addJob({
            id: `vantuz-${taskName}`,
            schedule,
            prompt: template.prompt
        });
    }

    /**
     * Özel görev ekle
     */
    async addJob(job) {
        const { id, schedule, prompt, enabled = true } = job;

        // Cron ifadesini çöz
        const cronSchedule = PRESETS[schedule] || schedule;

        try {
            if (this.api.cron) {
                await this.api.cron.add({
                    id,
                    schedule: cronSchedule,
                    action: {
                        type: 'agent',
                        prompt: prompt
                    },
                    enabled
                });
            }

            this.jobs.set(id, { ...job, cronSchedule });
            return { success: true, jobId: id };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Görev sil
     */
    async removeJob(jobId) {
        try {
            if (this.api.cron) {
                await this.api.cron.remove({ jobId });
            }
            this.jobs.delete(jobId);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Görevi hemen çalıştır
     */
    async runNow(jobId) {
        try {
            if (this.api.cron) {
                await this.api.cron.run({ jobId });
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Görevi duraklat/devam ettir
     */
    async toggleJob(jobId, enabled) {
        try {
            if (this.api.cron) {
                await this.api.cron.update({ jobId, patch: { enabled } });
            }
            const job = this.jobs.get(jobId);
            if (job) {
                job.enabled = enabled;
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Tüm görevleri listele
     */
    async listJobs() {
        try {
            if (this.api.cron) {
                const result = await this.api.cron.list();
                return { success: true, jobs: result };
            }
            return { success: true, jobs: Array.from(this.jobs.values()) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Mevcut şablonları listele
     */
    getTemplates() {
        return Object.entries(TASK_TEMPLATES).map(([key, val]) => ({
            name: key,
            description: val.prompt,
            schedule: val.defaultSchedule,
            scheduleHuman: this.cronToHuman(val.defaultSchedule)
        }));
    }

    /**
     * Cron ifadesini insan diline çevir
     */
    cronToHuman(cron) {
        const mappings = {
            '*/15 * * * *': 'Her 15 dakikada bir',
            '*/30 * * * *': 'Her 30 dakikada bir',
            '0 * * * *': 'Her saat başı',
            '0 9 * * *': 'Her gün 09:00',
            '0 10 * * *': 'Her gün 10:00',
            '0 18 * * *': 'Her gün 18:00',
            '0 9 * * 1': 'Her Pazartesi 09:00',
            '0 */2 * * *': 'Her 2 saatte bir'
        };
        return mappings[cron] || cron;
    }
}

export const schedulerTool = {
    name: 'schedule',

    async execute(params, context) {
        const { action, task, schedule, jobId, enabled } = params;
        const scheduler = new SchedulerService(context.api);

        switch (action) {
            case 'add':
            case 'ekle':
                if (TASK_TEMPLATES[task]) {
                    return await scheduler.addPreset(task, schedule);
                } else {
                    return await scheduler.addJob({ id: jobId || `vantuz-${Date.now()}`, schedule, prompt: task });
                }

            case 'remove':
            case 'sil':
                return await scheduler.removeJob(jobId);

            case 'run':
            case 'calistir':
                return await scheduler.runNow(jobId);

            case 'toggle':
            case 'degistir':
                return await scheduler.toggleJob(jobId, enabled);

            case 'list':
            case 'listele':
                return await scheduler.listJobs();

            case 'templates':
            case 'sablonlar':
                return { success: true, templates: scheduler.getTemplates() };

            default:
                return {
                    success: false,
                    error: 'Geçersiz action. Kullanım: add, remove, run, toggle, list, templates'
                };
        }
    }
};

export default SchedulerService;
