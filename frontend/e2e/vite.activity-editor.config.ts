import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    root: resolve(fileURLToPath(new URL('.', import.meta.url))),
    resolve: {
        alias: {
            '@': resolve(fileURLToPath(new URL('.', import.meta.url)), '../../resources/js'),
            react: resolve(fileURLToPath(new URL('.', import.meta.url)), '../node_modules/react'),
            'react-dom': resolve(fileURLToPath(new URL('.', import.meta.url)), '../node_modules/react-dom'),
        },
        dedupe: ['react', 'react-dom'],
    },
    server: {
        fs: {
            allow: [resolve(fileURLToPath(new URL('.', import.meta.url)), '../..')],
        },
    },
});
