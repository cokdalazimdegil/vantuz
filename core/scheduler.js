// core/scheduler.js
// Persistent Scheduler for Vantuz AI
// Jobs survive restarts via JSON file persistence.

import { CronJob } from 'cron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { log } from './ai-provider.js';

const JOBS_FILE = path.join(os.homedir(), '.vantuz', 'cron', 'jobs.json');

function ensureDir() {
    const dir = path.dirname(JOBS_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function loadPersistedJobs() {
    try {
        if (fs.existsSync(JOBS_FILE)) {
            return JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'));
        }
    } catch (e) {
        log('WARN', 'Cron jobs file corrupt, starting fresh', { error: e.message });
    }
    return [];
}

function savePersistedJobs(jobs) {
    ensureDir();
    const data = jobs.map(j => ({
        name: j.name,
        cronTime: j.cronTime,
        message: j.message || '',
        createdAt: j.createdAt || new Date().toISOString()
    }));
    fs.writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

class Scheduler {
    constructor() {
        this.jobs = new Map(); // name -> { cronJob, cronTime, message, createdAt }
        this._persisted = loadPersistedJobs();
        log('INFO', 'Scheduler initialized', { persistedJobs: this._persisted.length });
    }

    /**
     * Get persisted job definitions (for restoration by AutomationManager).
     */
    getPersistedJobs() {
        return this._persisted;
    }

    /**
     * Register and start a cron job.
     * @param {string} name - Unique job name.
     * @param {string} cronTime - Cron expression (e.g. '0 * * * *').
     * @param {function} task - Async function to execute.
     * @param {boolean} startImmediately - Start right away (default: true).
     * @param {string} message - Original message (for persistence).
     */
    addJob(name, cronTime, task, startImmediately = true, message = '') {
        if (this.jobs.has(name)) {
            log('WARN', `Job "${name}" already exists. Replacing.`);
            this.stopJob(name, false); // Stop old, don't save yet
        }

        const cronJob = new CronJob(cronTime, async () => {
            log('INFO', `Running scheduled job: ${name}`);
            try {
                await task();
                log('INFO', `Job "${name}" completed.`);
            } catch (error) {
                log('ERROR', `Job "${name}" failed: ${error.message}`, { error });
            }
        }, null, startImmediately, 'Europe/Istanbul');

        this.jobs.set(name, {
            cronJob,
            cronTime,
            message,
            createdAt: new Date().toISOString()
        });

        // Persist
        this._updatePersistence();
        log('INFO', `Job "${name}" added: "${cronTime}"`, { message });
    }

    /**
     * Stop and remove a job.
     */
    stopJob(name, persist = true) {
        const entry = this.jobs.get(name);
        if (entry) {
            entry.cronJob.stop();
            this.jobs.delete(name);
            if (persist) this._updatePersistence();
            log('INFO', `Job "${name}" stopped.`);
        } else {
            log('WARN', `Job "${name}" not found.`);
        }
    }

    /**
     * Stop all jobs.
     */
    stopAllJobs() {
        for (const [name, entry] of this.jobs) {
            entry.cronJob.stop();
            log('INFO', `Job "${name}" stopped.`);
        }
        this.jobs.clear();
        this._updatePersistence();
    }

    /**
     * List active jobs with details.
     */
    listJobs() {
        const list = [];
        for (const [name, entry] of this.jobs) {
            list.push({
                name,
                cronTime: entry.cronTime,
                message: entry.message,
                createdAt: entry.createdAt,
                running: entry.cronJob.running
            });
        }
        return list;
    }

    /**
     * Persist current jobs to disk.
     */
    _updatePersistence() {
        const jobs = [];
        for (const [name, entry] of this.jobs) {
            jobs.push({
                name,
                cronTime: entry.cronTime,
                message: entry.message,
                createdAt: entry.createdAt
            });
        }
        savePersistedJobs(jobs);
    }
}

let schedulerInstance = null;

export function getScheduler() {
    if (!schedulerInstance) {
        schedulerInstance = new Scheduler();
    }
    return schedulerInstance;
}
