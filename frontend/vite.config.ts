import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { dirname, resolve } from 'node:path';

const canonicalWorldApi = resolve(import.meta.dirname, 'canonical-source/resources/js/features/world/api');
const worldApiAdapter = resolve(import.meta.dirname, 'src/platform/world-api.ts');

export default defineConfig({
    plugins: [
        {
            name: 'canonical-world-transport',
            enforce: 'pre',
            resolveId(source, importer) {
                // Relative imports in copied feature components must reach the
                // same narrow transport seam as the page's aliased import.
                if (importer && source.startsWith('.')) {
                    const target = resolve(dirname(importer.split('?')[0]), source);
                    if (target === canonicalWorldApi || target === `${canonicalWorldApi}.ts`) {
                        return worldApiAdapter;
                    }
                }
            },
        },
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: [
            { find: '@laravel/passkeys/react', replacement: resolve(import.meta.dirname, 'src/platform/passkey-react.ts') },
            { find: '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyRegistrationController', replacement: resolve(import.meta.dirname, 'src/platform/passkey-management-actions.ts') },
            { find: '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyConfirmationController', replacement: resolve(import.meta.dirname, 'src/platform/passkey-confirmation-actions.ts') },
            { find: '@/actions/App/Http/Controllers/Settings/SecurityController', replacement: resolve(import.meta.dirname, 'src/platform/security-actions.ts') },
            { find: '@/hooks/use-two-factor-auth', replacement: resolve(import.meta.dirname, 'src/platform/security-two-factor-auth.ts') },
            { find: '@/routes/password/confirm', replacement: resolve(import.meta.dirname, 'src/platform/password-confirm-routes.ts') },
            { find: '@/routes/two-factor/login', replacement: resolve(import.meta.dirname, 'src/platform/two-factor-routes.ts') },
            { find: '@/routes/two-factor', replacement: resolve(import.meta.dirname, 'src/platform/two-factor-management-routes.ts') },
            { find: '@/routes/settings/sound-preferences', replacement: resolve(import.meta.dirname, 'src/platform/sound-preferences-routes.ts') },
            { find: '@/routes/settings/assets/media', replacement: resolve(import.meta.dirname, 'src/platform/media-asset-routes.ts') },
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
                find: '@/features/world/api',
                replacement: resolve(import.meta.dirname, 'src/platform/world-api.ts'),
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
