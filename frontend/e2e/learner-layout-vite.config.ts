import { defineConfig, mergeConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import base from './journal-vite.config.ts';
import { transformGrantSource } from '../src/platform/grant-source-transform.ts';
import { transformObstacleSource } from '../src/platform/obstacle-source-transform.ts';
import { transformMessageSource } from '../src/platform/message-source-transform.ts';

const sourceRoot = resolve(import.meta.dirname, '../../resources/js');
export default mergeConfig(base, defineConfig({ cacheDir: 'node_modules/.vite-learner-layout-source', plugins: [{
    name: 'whole-original-learner-layout-evidence',
    enforce: 'pre',
    configureServer(server) {
        server.middlewares.use((request, _response, next) => {
            // Exact evidence-only URL lets the whole source action bar use its
            // normal /learning/ visibility rule, including after refresh.
            if (request.url?.split('?')[0] === '/learning/obstacle-evidence') {
                request.url = request.url.replace('/learning/obstacle-evidence', '/e2e/canonical-player-obstacle.html');
            }
            next();
        });
    },
    transform(code, id) {
        if (!id.split('?')[0].startsWith(`${sourceRoot}/`)) return;
        if (id.split('?')[0] === `${sourceRoot}/features/world/message-activities.tsx`) {
            code = transformMessageSource(code).replace("from './api'", "from '/src/platform/world-api.ts'");
        }
        for (const [file, kind] of [['item-obstacle-activity.tsx', 'items'], ['obstacle-activity.tsx', 'tool']] as const) {
            if (id.split('?')[0] === `${sourceRoot}/features/world/${file}`) {
                code = transformObstacleSource(code, kind).replace("from './api'", "from '/src/platform/world-api.ts'");
            }
        }
        for (const [file, kind] of [['item-grant-activity.tsx', 'items'], ['tool-grant-activity.tsx', 'tool']] as const) {
            if (id.split('?')[0] === `${sourceRoot}/features/world/${file}`) {
                // Whole-main reference uses the same documented UUID/transport
                // boundary with real Rust data, not fabricated numeric identities
                // or a second emulated Laravel backend. JSX/CSS stay untouched.
                code = transformGrantSource(code, kind).replace("from './api'", "from '/src/platform/world-api.ts'");
            }
        }
        if (id.split('?')[0] === `${sourceRoot}/pages/world.tsx`) {
            // Evidence-only Inertia partial reload: original UI and command
            // requests stay intact; the harness updates only its World prop.
            const reload = /router\.reload\(\{\s*only: \['world'\],\s*\}\)/g;
            if (code.match(reload)?.length !== 1) throw new Error('Original World reload seam changed.');
            code = code.replace(reload, "window.dispatchEvent(new Event('source-world:reload'))");
        }
        // Keep the entire original UI dependency tree on original source files.
        // Only the already documented Inertia/Wayfinder facades stay shared.
        return code.replace(/(['"])@\/(components|features|hooks|layouts|lib|theme)\/([^'"]+)\1/g, (_, quote, directory, path) => {
            const target = `${sourceRoot}/${directory}/${path}`;
            const file = [target, `${target}.tsx`, `${target}.ts`, `${target}/index.ts`].find(existsSync);
            if (!file) throw new Error(`Original source dependency unavailable: ${directory}/${path}`);
            return `${quote}/@fs/${file}${quote}`;
        });
    },
}] }));
