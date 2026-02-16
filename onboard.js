#!/usr/bin/env node

import { Configurator } from './config.js';

try {
    const configurator = new Configurator();
    await configurator.run();
} catch (e) {
    console.error('[HATA] Onboarding basarisiz:', e?.message || e);
    process.exitCode = 1;
}
