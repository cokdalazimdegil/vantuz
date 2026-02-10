// core/scheduler.js
import { CronJob } from 'cron';
import { log } from './ai-provider.js';

class Scheduler {
    constructor() {
        this.jobs = new Map();
        log('INFO', 'Scheduler initialized');
    }

    /**
     * Bir görevi belirli bir cron zamanlamasına göre kaydeder ve başlatır.
     * @param {string} name Görevin benzersiz adı.
     * @param {string} cronTime Cron zamanlama dizesi (örn. '0 * * * *' her saat başı).
     * @param {function} task Çalıştırılacak asenkron fonksiyon.
     * @param {boolean} startImmediately Hemen başlatılsın mı? (Varsayılan: true)
     */
    addJob(name, cronTime, task, startImmediately = true) {
        if (this.jobs.has(name)) {
            log('WARN', `Job with name "${name}" already exists. Skipping.`);
            return;
        }

        const job = new CronJob(cronTime, async () => {
            log('INFO', `Running scheduled job: ${name}`);
            try {
                await task();
                log('INFO', `Scheduled job "${name}" completed successfully.`);
            } catch (error) {
                log('ERROR', `Scheduled job "${name}" failed: ${error.message}`, { error });
            }
        }, null, startImmediately, 'UTC'); // UTC timezone for consistency

        this.jobs.set(name, job);
        log('INFO', `Scheduled job "${name}" added and started with cron: "${cronTime}"`);
    }

    /**
     * Kayıtlı bir görevi durdurur.
     * @param {string} name Durdurulacak görevin adı.
     */
    stopJob(name) {
        const job = this.jobs.get(name);
        if (job) {
            job.stop();
            this.jobs.delete(name);
            log('INFO', `Scheduled job "${name}" stopped and removed.`);
        } else {
            log('WARN', `Job with name "${name}" not found. Cannot stop.`);
        }
    }

    /**
     * Tüm kayıtlı görevleri durdurur.
     */
    stopAllJobs() {
        for (const [name, job] of this.jobs) {
            job.stop();
            log('INFO', `Scheduled job "${name}" stopped.`);
        }
        this.jobs.clear();
        log('INFO', 'All scheduled jobs stopped.');
    }

    /**
     * Tüm aktif görevlerin listesini döner.
     */
    listJobs() {
        return Array.from(this.jobs.keys());
    }
}

let schedulerInstance = null;

export function getScheduler() {
    if (!schedulerInstance) {
        schedulerInstance = new Scheduler();
    }
    return schedulerInstance;
}
