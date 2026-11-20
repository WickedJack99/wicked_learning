import { defineConfig, mergeConfig } from 'vite';
import { resolve } from 'node:path';
import base from '../vite.config.ts';

const sourceRoot = resolve(import.meta.dirname, '../../resources/js');
export default mergeConfig(base, defineConfig({
    publicDir: resolve(import.meta.dirname, '../../public'),
    server: {
        hmr: false,
        proxy: {
            '/api': {
                target: 'http://localhost:8081',
                configure(proxy) {
                    // Evidence-only bridge to the real local deployment. Its
                    // native CSRF cookie/token verification remains in force.
                    proxy.on('proxyReq', (request) => request.setHeader('Origin', 'http://localhost:8081'));
                },
            },
        },
    },
    plugins: [{
        name: 'independent-original-journal-evidence',
        enforce: 'pre',
        transform(code, id) {
            // Original overlay/client use the original Laravel-shaped transport.
            // The canonical overlay separately resolves the typed Rust adapter.
            const path = id.split('?')[0];
            if (path === `${sourceRoot}/features/journal/journal-overlay.tsx`) {
                return code.replaceAll('@/features/journal/journal-client', `/@fs/${sourceRoot}/features/journal/journal-client.ts`);
            }
            if (path === `${sourceRoot}/features/journal/journal-client.ts`) {
                return code.replaceAll('@/features/world/api', '../world/api');
            }
        },
    }],
}));
