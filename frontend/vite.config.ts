import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: [
            { find: '@laravel/passkeys/react', replacement: resolve(import.meta.dirname, 'src/platform/passkey-react.ts') },
            { find: '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyConfirmationController', replacement: resolve(import.meta.dirname, 'src/platform/passkey-confirmation-actions.ts') },
            { find: '@/routes/password/confirm', replacement: resolve(import.meta.dirname, 'src/platform/password-confirm-routes.ts') },
            { find: '@/routes/two-factor/login', replacement: resolve(import.meta.dirname, 'src/platform/two-factor-routes.ts') },
            { find: '@/routes/two-factor', replacement: resolve(import.meta.dirname, 'src/platform/two-factor-management-routes.ts') },
            {
                find: '@/routes/login',
                replacement: resolve(import.meta.dirname, 'src/platform/auth-routes.ts'),
            },
            {
                find: '@/routes/register',
                replacement: resolve(import.meta.dirname, 'src/platform/register-routes.ts'),
            },
            {
                find: '@/routes/password',
                replacement: resolve(import.meta.dirname, 'src/platform/auth-routes.ts'),
            },
            {
                find: '@/theme/appearance-persistence',
                replacement: resolve(import.meta.dirname, 'src/platform/appearance-persistence.ts'),
            },
            { find: '@/actions/App/Http/Controllers/Settings/ProfileController', replacement: resolve(import.meta.dirname, 'src/platform/profile-actions.ts') },
            { find: '@/lib/media-upload', replacement: resolve(import.meta.dirname, 'src/platform/profile-media-upload.ts') },
            { find: '@/routes/verification', replacement: resolve(import.meta.dirname, 'src/platform/verification-routes.ts') },
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
