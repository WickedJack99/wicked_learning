import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

const directory = fileURLToPath(new URL('.', import.meta.url));
const frontendRoot = resolve(directory, '..');

export default defineConfig({
    testDir: directory,
    testMatch: 'npc-dialogue-direct-editor-*.spec.ts',
    use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4178',
    },
    webServer: {
        command:
            'npm exec vite -- --host 127.0.0.1 --port 4178 --config e2e/vite.activity-editor.config.ts',
        cwd: frontendRoot,
        reuseExistingServer: false,
    },
    workers: 1,
});
