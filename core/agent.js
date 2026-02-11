import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import https from 'https';
import http from 'http';

const DEFAULT_ALLOW_CMDS = [
    'dir', 'ls', 'rg', 'cat', 'type', 'node', 'npm', 'git', 'curl'
];

function isAllowedCommand(command, allowList = []) {
    const trimmed = String(command || '').trim();
    if (!trimmed) return false;
    const cmd = trimmed.split(/\s+/)[0].toLowerCase();
    const allowed = allowList.length > 0 ? allowList : DEFAULT_ALLOW_CMDS;
    return allowed.includes(cmd);
}

function runCommand(command, timeoutMs = 15000) {
    return new Promise((resolve) => {
        exec(command, { timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
            if (err) {
                resolve({ success: false, output: stderr || err.message });
                return;
            }
            resolve({ success: true, output: stdout || stderr || '' });
        });
    });
}

function readFileSafe(filePath, maxBytes = 200000) {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) return { success: false, output: 'Dosya bulunamadı.' };
    const stat = fs.statSync(resolved);
    if (stat.size > maxBytes) return { success: false, output: 'Dosya çok büyük.' };
    return { success: true, output: fs.readFileSync(resolved, 'utf-8') };
}

function listDirSafe(dirPath = '.') {
    const resolved = path.resolve(dirPath);
    if (!fs.existsSync(resolved)) return { success: false, output: 'Klasör bulunamadı.' };
    const entries = fs.readdirSync(resolved, { withFileTypes: true })
        .map(d => (d.isDirectory() ? `[D] ${d.name}` : `[F] ${d.name}`));
    return { success: true, output: entries.join('\n') };
}

function httpGet(url, timeoutMs = 15000) {
    return new Promise((resolve) => {
        const lib = url.startsWith('https') ? https : http;
        const req = lib.get(url, { timeout: timeoutMs }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ success: true, output: data.slice(0, 200000) }));
        });
        req.on('error', (e) => resolve({ success: false, output: e.message }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ success: false, output: 'Timeout' });
        });
    });
}

export async function executeTool(tool, args = {}, config = {}) {
    switch (tool) {
        case 'exec': {
            const command = args.command || '';
            const allowList = config.agentAllowCommands || [];
            if (!isAllowedCommand(command, allowList)) {
                return { success: false, output: 'Komut izinli değil.' };
            }
            return await runCommand(command, config.agentCommandTimeoutMs || 15000);
        }
        case 'readFile':
            return readFileSafe(args.path);
        case 'listDir':
            return listDirSafe(args.path);
        case 'httpGet':
            return await httpGet(args.url || '');
        default:
            return { success: false, output: 'Bilinmeyen araç.' };
    }
}
