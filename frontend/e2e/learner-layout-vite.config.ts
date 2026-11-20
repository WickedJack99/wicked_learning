import { defineConfig, mergeConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import base from './journal-vite.config.ts';

const sourceRoot = resolve(import.meta.dirname, '../../resources/js');
export default mergeConfig(base, defineConfig({ cacheDir: 'node_modules/.vite-learner-layout-source', plugins: [{
    name: 'whole-original-learner-layout-evidence',
    enforce: 'pre',
    transform(code, id) {
        if (!id.split('?')[0].startsWith(`${sourceRoot}/`)) return;
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
