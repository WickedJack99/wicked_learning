import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const pinnedMainSha = '32c3113a5bc688c9944c20942cdf40a6a5d57d7f';
const frontendRoot = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(frontendRoot, '..');
const canonicalRoot = resolve(frontendRoot, 'canonical-source');

function git(...args) {
    return execFileSync('git', args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
    }).trim();
}

function digest(value) {
    return createHash('sha256').update(value).digest('hex');
}

function filesWithin(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = resolve(directory, entry.name);

        if (entry.isDirectory()) {
            return filesWithin(entryPath);
        }

        return [relative(canonicalRoot, entryPath)];
    });
}

if (git('rev-parse', 'main') !== pinnedMainSha) {
    throw new Error(`main no longer resolves to pinned source ${pinnedMainSha}.`);
}

const sourcePaths = git(
    'ls-tree',
    '-r',
    '--name-only',
    pinnedMainSha,
    '--',
    'resources/js',
    'resources/css/app.css',
)
    .split('\n')
    .filter(Boolean);

for (const sourcePath of sourcePaths) {
    const copiedPath = resolve(canonicalRoot, sourcePath);
    const pinnedContents = execFileSync('git', ['show', `${pinnedMainSha}:${sourcePath}`], {
        cwd: repositoryRoot,
    });
    const copiedContents = readFileSync(copiedPath);

    if (digest(pinnedContents) !== digest(copiedContents)) {
        throw new Error(`Canonical source differs from ${pinnedMainSha}: ${sourcePath}`);
    }
}

const copiedPaths = filesWithin(resolve(canonicalRoot, 'resources')).sort();
if (JSON.stringify(copiedPaths) !== JSON.stringify(sourcePaths.sort())) {
    throw new Error('The canonical-source root contains a file set different from the pinned source.');
}

const resolverPath = resolve(frontendRoot, 'src/platform/canonical-resolver.tsx');
const resolver = readFileSync(resolverPath, 'utf8');

if (!resolver.includes("from '@/components/heading'")) {
    throw new Error('The canonical resolver must import a copied source component.');
}

if (/['"][^'"]*(?:original-|lifted-|extracted-)[^'"]*['"]/.test(resolver)) {
    throw new Error('The canonical resolver must not import reconstructed presentation files.');
}

const sourceFileCount = sourcePaths.filter((sourcePath) => sourcePath.startsWith('resources/js/')).length;
const copiedCss = relative(canonicalRoot, resolve(canonicalRoot, 'resources/css/app.css'));

console.log(
    `Verified ${sourceFileCount} copied JavaScript/TypeScript files and ${copiedCss} against ${pinnedMainSha}.`,
);
