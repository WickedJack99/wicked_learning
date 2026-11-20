import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

const frontend = resolve(import.meta.dirname, '..');
test('portable identity check works without Git and rejects altered, missing and extra source files', () => {
    // First establish the manifest's provenance against the actual pinned Git tree.
    execFileSync(process.execPath, [resolve(frontend, 'scripts/verify-canonical-source.mjs')]);
    const temporary = mkdtempSync(resolve(tmpdir(), 'canonical-identity-'));
    try {
        for (const path of ['scripts', 'canonical-source', 'src/platform']) {
            mkdirSync(resolve(temporary, path), { recursive: true });
        }
        cpSync(resolve(frontend, 'canonical-source'), resolve(temporary, 'canonical-source'), { recursive: true });
        for (const path of ['scripts/verify-canonical-source.mjs', 'scripts/canonical-source-manifest.json', 'src/platform/canonical-resolver.tsx']) {
            cpSync(resolve(frontend, path), resolve(temporary, path));
        }
        const verify = () => spawnSync(process.execPath, [resolve(temporary, 'scripts/verify-canonical-source.mjs'), '--manifest'], {
            env: { PATH: '/no-git-here' }, encoding: 'utf8',
        });
        assert.equal(verify().status, 0);
        const source = resolve(temporary, 'canonical-source/resources/js/pages/welcome.tsx');
        const original = readFileSync(source);
        writeFileSync(source, 'replacement UI');
        assert.notEqual(verify().status, 0);
        rmSync(source);
        assert.notEqual(verify().status, 0);
        writeFileSync(source, original);
        const extra = resolve(temporary, 'canonical-source/resources/js/pages/reconstructed.tsx');
        writeFileSync(extra, 'extra UI');
        assert.notEqual(verify().status, 0);
        rmSync(extra);
        assert.equal(verify().status, 0);
    } finally {
        rmSync(temporary, { recursive: true, force: true });
    }
});
