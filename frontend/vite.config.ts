import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: [
            {
                find: '@/routes/login',
                replacement: resolve(import.meta.dirname, 'src/platform/auth-routes.ts'),
            },
            {
                find: '@/routes/password',
                replacement: resolve(import.meta.dirname, 'src/platform/auth-routes.ts'),
            },
            {
                find: '@inertiajs/react',
                replacement: resolve(import.meta.dirname, 'src/platform/welcome-inertia.tsx'),
            },
            {
                find: '@/routes',
                replacement: resolve(import.meta.dirname, 'src/platform/welcome-routes.ts'),
            },
            {
                find: '@',
                replacement: resolve(import.meta.dirname, 'canonical-source/resources/js'),
            },
        ],
    },
    server: {
        proxy: {
            '/api': {
                target:
                    process.env.VITE_API_PROXY_TARGET ??
                    'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
});
