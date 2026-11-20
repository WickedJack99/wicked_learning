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

// Local/CI verification proves this portable manifest against Git. Docker has
// neither Git nor repository history, so it verifies the same copied bytes
// using the committed manifest explicitly, never by silently skipping checks.
const manifest = JSON.parse(readFileSync(resolve(frontendRoot, 'scripts/canonical-source-manifest.json'), 'utf8'));
if (manifest.mainSha !== pinnedMainSha) {
    throw new Error('The canonical manifest must name the pinned main SHA.');
}
const sourcePaths = Object.keys(manifest.files).sort();
if (!process.argv.includes('--manifest')) {
    if (git('rev-parse', 'main') !== pinnedMainSha) {
        throw new Error(`main no longer resolves to pinned source ${pinnedMainSha}.`);
    }
    const gitPaths = git('ls-tree', '-r', '--name-only', pinnedMainSha, '--', 'resources/js', 'resources/css/app.css')
        .split('\n').filter(Boolean).sort();
    if (JSON.stringify(gitPaths) !== JSON.stringify(sourcePaths)) {
        throw new Error('The canonical manifest file set differs from the pinned source.');
    }
    for (const sourcePath of sourcePaths) {
        const pinnedContents = execFileSync('git', ['show', `${pinnedMainSha}:${sourcePath}`], { cwd: repositoryRoot });
        if (digest(pinnedContents) !== manifest.files[sourcePath]) {
            throw new Error(`Canonical manifest differs from ${pinnedMainSha}: ${sourcePath}`);
        }
    }
}
for (const sourcePath of sourcePaths) {
    const copiedContents = readFileSync(resolve(canonicalRoot, sourcePath));
    if (digest(copiedContents) !== manifest.files[sourcePath]) {
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
