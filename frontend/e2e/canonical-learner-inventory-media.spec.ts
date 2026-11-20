import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081';
const picture = (color: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="${color}"/></svg>`);

// Real media uploads, catalog commands, references and delivery. The local-only
// SQL fixture grants/revokes only a newly created catalog entry: playback is a
// separate migration boundary, and this must not pretend to test its grant UI.
for (const kind of ['item', 'tool'] as const) {
    test(`owned ${kind} visuals retain bytes and reject guests, peers and revoked holdings`, async ({ browser }) => {
        expect(new URL(baseURL).hostname, 'fixture is restricted to the local Compose stack').toMatch(/^(localhost|127\.0\.0\.1)$/);
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
        const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
        const guest = await browser.newContext({ baseURL });
        const token = await (await admin.request.get('/api/v1/security/csrf')).json();
        const headers = { Origin: new URL(baseURL).origin, 'X-CSRF-Token': token.token };
        let mediaId: string | undefined;
        let entryId: string | undefined;
        try {
            const uploaded = await admin.request.post('/api/v1/admin/media-assets', {
                headers, multipart: { file: { name: 'inventory.svg', mimeType: 'image/svg+xml', buffer: picture('#123456') } },
            });
            expect(uploaded.status()).toBe(201);
            mediaId = uuid((await uploaded.json()).asset.id);
            const authorUrl = `/api/v1/admin/media-assets/${mediaId}/content`;
            const learnerUrl = `/api/v1/learner/media-assets/${mediaId}/content`;
            const form = {
                title: `Inventory ${kind} ${randomUUID()}`, slug: null, description: 'Owned visual',
                image_dark: authorUrl, image_light: authorUrl,
                ...(kind === 'tool' ? { animation_dark: authorUrl, animation_light: authorUrl, image_width_percent: 18 } : {}),
            };
            const created = await admin.request.post(`/api/v1/admin/assets/${kind}s`, { headers, data: form });
            expect(created.status()).toBe(201);
            entryId = uuid((await created.json())[kind].id);
            const subject = uuid((await (await owner.request.get('/api/v1/me')).json()).subject_id);
            for (const context of [owner, peer, guest]) {
                expect((await context.request.get(learnerUrl)).status()).toBe(404);
            }
            const grant = () => localSql(kind === 'item'
                ? `INSERT INTO learner_item_holdings (principal_id, item_id, quantity) SELECT id, '${entryId}', 2 FROM application_principals WHERE identity_subject_id = '${subject}' ON CONFLICT (principal_id, item_id) DO UPDATE SET quantity = 2`
                : `INSERT INTO learner_tools (principal_id, tool_id) SELECT id, '${entryId}' FROM application_principals WHERE identity_subject_id = '${subject}' ON CONFLICT DO NOTHING`);
            grant();
            const delivered = await owner.request.get(learnerUrl);
            expect(delivered.status()).toBe(200);
            expect(await delivered.body()).toEqual(picture('#123456'));
            expect(delivered.headers()['content-type']).toBe('image/svg+xml');
            // The local reverse proxy also emits this header.
            expect(delivered.headers()['x-content-type-options'].split(',').map((value) => value.trim())).toContain('nosniff');
            expect(delivered.headers()['content-security-policy']).toContain('sandbox');
            for (const context of [peer, guest]) expect((await context.request.get(learnerUrl)).status()).toBe(404);
            expect((await owner.request.get(authorUrl)).status()).toBe(404);
            for (const endpoint of ['/api/v1/learner/shell', '/api/v1/learner/world']) {
                const read = await owner.request.get(endpoint);
                expect(read.status()).toBe(200);
                const entry = (await read.json())[`${kind}s`].find((entry: { id: string }) => entry.id === entryId);
                expect(entry).toMatchObject({ id: entryId, image_dark: learnerUrl, image_light: learnerUrl });
                if (kind === 'tool') expect(entry).toMatchObject({ animation_dark: learnerUrl, animation_light: learnerUrl, config: { imageWidthPercent: 18 } });
            }
            const replaced = await admin.request.post(`/api/v1/admin/media-assets/${mediaId}/replace`, {
                headers, multipart: { file: { name: 'replacement.svg', mimeType: 'image/svg+xml', buffer: picture('#abcdef') } },
            });
            expect(replaced.status()).toBe(200);
            expect(await (await owner.request.get(learnerUrl)).body()).toEqual(picture('#abcdef'));
            localSql(kind === 'item'
                ? `UPDATE learner_item_holdings SET quantity = 0 WHERE item_id = '${entryId}'`
                : `DELETE FROM learner_tools WHERE tool_id = '${entryId}'`);
            expect((await owner.request.get(learnerUrl)).status()).toBe(404);
            grant();
            const cleared = await admin.request.patch(`/api/v1/admin/assets/${kind}s/${entryId}`, {
                headers, data: { ...form, image_dark: null, image_light: null, ...(kind === 'tool' ? { animation_dark: null, animation_light: null } : {}) },
            });
            expect(cleared.status()).toBe(200);
            expect((await owner.request.get(learnerUrl)).status()).toBe(404);
        } finally {
            if (entryId) {
                // These UUIDs belong exclusively to this test; never delete a seed row.
                localSql(`DELETE FROM reusable_media_asset_references WHERE owner_kind = 'learning_${kind}' AND owner_id = '${entryId}'; DELETE FROM learning_${kind}s WHERE id = '${entryId}'`);
            }
            if (mediaId) expect((await admin.request.delete(`/api/v1/admin/media-assets/${mediaId}`, { headers })).status()).toBe(204);
            await admin.close(); await owner.close(); await peer.close(); await guest.close();
        }
    });
}

function uuid(value: string): string {
    expect(value).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    return value;
}

function localSql(sql: string): void {
    execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input: sql, stdio: ['pipe', 'pipe', 'pipe'] });
}
