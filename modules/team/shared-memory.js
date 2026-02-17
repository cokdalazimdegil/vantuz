// modules/team/shared-memory.js
import fs from 'fs';
import path from 'path';
import { log } from '../../core/ai-provider.js';

const TEAM_DIR = path.join(process.cwd(), 'workspace', 'team');

export class SharedMemory {
    constructor() {
        this.ensureStructure();
    }

    ensureStructure() {
        if (!fs.existsSync(TEAM_DIR)) {
            fs.mkdirSync(TEAM_DIR, { recursive: true });
        }

        // Standart dosyaların varlığını kontrol et
        const defaults = {
            'GOALS.md': '# Mevcut Hedefler & OKR\'lar\n\nHenüz bir hedef belirlenmedi.',
            'DECISIONS.md': '# Karar Günlüğü\n\nHenüz bir karar alınmadı.',
            'PROJECT_STATUS.md': '# Proje Durumu\n\nDurum: Başlatılıyor...'
        };

        for (const [file, content] of Object.entries(defaults)) {
            const filePath = path.join(TEAM_DIR, file);
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, content, 'utf-8');
            }
        }
    }

    getAgentDir(agentName) {
        const dir = path.join(TEAM_DIR, 'agents', agentName);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    readFile(filename) {
        try {
            const filePath = path.join(TEAM_DIR, filename);
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf-8');
            }
        } catch (e) {
            log('ERROR', `SharedMemory read failed: ${filename}`, { error: e.message });
        }
        return '';
    }

    writeFile(filename, content) {
        try {
            const filePath = path.join(TEAM_DIR, filename);
            fs.writeFileSync(filePath, content, 'utf-8');
            log('INFO', `SharedMemory updated: ${filename}`);
            return true;
        } catch (e) {
            log('ERROR', `SharedMemory write failed: ${filename}`, { error: e.message });
            return false;
        }
    }

    appendFile(filename, content) {
        try {
            const filePath = path.join(TEAM_DIR, filename);
            const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const formatted = `\n\n### [${timestamp}] Update\n${content}`;
            fs.appendFileSync(filePath, formatted, 'utf-8');
            return true;
        } catch (e) {
            log('ERROR', `SharedMemory append failed: ${filename}`, { error: e.message });
            return false;
        }
    }

    getEverything() {
        return {
            goals: this.readFile('GOALS.md'),
            decisions: this.readFile('DECISIONS.md'),
            status: this.readFile('PROJECT_STATUS.md')
        };
    }
}

export default new SharedMemory();
