import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { dirname, resolve } from 'node:path';

const canonicalWorldApi = resolve(import.meta.dirname, 'canonical-source/resources/js/features/world/api');
const worldApiAdapter = resolve(import.meta.dirname, 'src/platform/world-api.ts');

export default defineConfig({
    plugins: [
        {
            name: 'canonical-player-recall-transport',
            enforce: 'pre',
            transform(code, id) {
                if (id.split('?')[0] !== resolve(import.meta.dirname, 'canonical-source/resources/js/features/world/standard-activities.tsx')) return;
                const queue = /queueRecallQuestion\(question\.id\)/g;
                const remove = /removeRecallQuestion\(question\.id\)/g;
                const feedback = /saveRecallFeedback\(\s*question\.id,\s*confidenceAfterFeedback,?\s*\)/g;
                if (code.match(queue)?.length !== 1 || code.match(remove)?.length !== 1 || code.match(feedback)?.length !== 2) {
                    throw new Error('The pinned question Recall transport seams changed.');
                }
                return `import { queuePlaybackRecall, removePlaybackRecall, savePlaybackRecallFeedback } from '/src/platform/playback-response-api.ts';\n${code
                    .replace(queue, 'queuePlaybackRecall(question.id, playRunId)')
                    .replace(remove, 'removePlaybackRecall(question.id, playRunId)')
                    .replace(feedback, 'savePlaybackRecallFeedback(question.id, playRunId, confidenceAfterFeedback)')}`;
            },
        },
        {
            name: 'canonical-world-tool-transport',
            enforce: 'pre',
            transform(code, id) {
                if (id.split('?')[0] !== resolve(import.meta.dirname, 'canonical-source/resources/js/pages/world.tsx')) return;
                const useTool = /await postJson<\{\s*result: \{\s*discovered\?: boolean;\s*isUnlocked\?: boolean;\s*isUseful: boolean;\s*\};\s*\}>\(endpoint, \{\s*tool_id: selectedTool\.id,\s*\}\)/g;
                const reload = /router\.reload\(\{\s*only: \['world'\],\s*\}\)/g;
                if (code.match(useTool)?.length !== 1 || code.match(reload)?.length !== 1) {
                    throw new Error('The pinned World tool transport seams changed.');
                }
                return `import { useWorldNodeTool, reloadWorld } from '/src/platform/world-tools.ts';\n${code.replace(useTool, 'await useWorldNodeTool(node, selectedTool, endpoint)').replace(reload, 'reloadWorld(node)')}`;
            },
        },
        {
            name: 'canonical-world-bookmark-transport',
            enforce: 'pre',
            transform(code, id) {
                if (id.split('?')[0] !== resolve(import.meta.dirname, 'canonical-source/resources/js/pages/world.tsx')) return;
                const remove = /await deleteJson<\{ bookmarkedNodeIds: number\[\] \}>\(\s*`\/learning\/nodes\/\$\{node\.id\}\/bookmark`,\s*\)/g;
                const add = /await postJson<\{ bookmarkedNodeIds: number\[\] \}>\(\s*`\/learning\/nodes\/\$\{node\.id\}\/bookmark`,\s*\{\},\s*\)/g;
                if (code.match(remove)?.length !== 1 || code.match(add)?.length !== 1) {
                    throw new Error('The pinned World bookmark transport seams changed.');
                }
                return `import { bookmarkNode } from '/src/platform/world-bookmarks.ts';\n${code.replace(remove, "await bookmarkNode(node, 'DELETE')").replace(add, "await bookmarkNode(node, 'POST')")}`;
            },
        },
        {
            name: 'canonical-companion-turn-transport',
            enforce: 'pre',
            transform(code, id) {
                if (id.split('?')[0] !== resolve(import.meta.dirname, 'canonical-source/resources/js/features/world/learning-companion-dialogue.tsx')) return;
                const call = "void fetch('/learning/companion/turn',";
                if (code.split(call).length !== 2) throw new Error('The pinned Companion transport seam changed.');
                return `import { companionFetch } from '/src/platform/companion-api.ts';\n${code.replace(call, "void companionFetch(companion, '/learning/companion/turn',")}`;
            },
        },
        {
            name: 'canonical-journal-download',
            configureServer(server) {
                server.middlewares.use((request, response, next) => {
                    if (request.method === 'GET' && request.url?.split('?')[0] === '/learning/journal/export') {
                        response.writeHead(302, { Location: '/api/v1/learner/journal/export' });
                        response.end();
                    } else next();
                });
            },
        },
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
