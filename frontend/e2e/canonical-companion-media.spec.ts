import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

const picture = (color: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="${color}"/></svg>`);

test('Companion avatar delivery follows the resolved context and preserves managed references', async ({ browser }, info) => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081';
    expect(new URL(baseURL).hostname, 'only the local test stack may change this fixture').toMatch(/^(localhost|127\.0\.0\.1)$/);
    const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
    const learner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
    const guest = await browser.newContext({ baseURL });
    const before = await admin.request.get('/api/v1/admin/learning-companion');
    expect(before.status()).toBe(200);
    const { ai_template_options: _, ...original } = await before.json();
    const csrf = await admin.request.get('/api/v1/security/csrf');
    const headers = { Origin: new URL(baseURL).origin, 'X-CSRF-Token': (await csrf.json()).token };
    const save = (values: object) => admin.request.patch('/api/v1/admin/learning-companion', { headers, data: { ...original, ...values } });
    let mediaId: string | undefined;
    try {
        const uploaded = await admin.request.post('/api/v1/admin/media-assets', {
            headers, multipart: { file: { name: 'companion.svg', mimeType: 'image/svg+xml', buffer: picture('#123456') } },
        });
        expect(uploaded.status()).toBe(201);
        mediaId = (await uploaded.json()).asset.id;
        const avatar = `/api/v1/admin/media-assets/${mediaId}/content`;
        expect((await save({ enabled: true, avatar_url: avatar })).status()).toBe(200);
        const projection = await learner.request.get('/api/v1/learner/companion?surface=desk');
        expect(projection.status()).toBe(200);
        const learnerUrl = (await projection.json()).avatar_url;
        expect(learnerUrl).toBe(`/api/v1/learner/companion/avatar/${mediaId}?surface=desk`);
        const started = performance.now();
        const delivered = await learner.request.get(learnerUrl);
        await info.attach('avatar-delivery-measurement', { contentType: 'application/json', body: JSON.stringify({ duration_ms: Math.round(performance.now() - started), bytes: (await delivered.body()).length }) });
        expect(delivered.status()).toBe(200);
        expect(await delivered.body()).toEqual(picture('#123456'));
        expect(delivered.headers()['content-type']).toBe('image/svg+xml');
        expect(delivered.headers()['content-security-policy']).toContain('sandbox');
        expect((await guest.request.get(learnerUrl)).status()).toBe(401);
        expect((await learner.request.get(avatar)).status()).toBe(404);
        expect((await learner.request.get(learnerUrl.replace(mediaId!, randomUUID()))).status()).toBe(404);
        expect((await learner.request.get(learnerUrl.replace('surface=desk', 'surface=world&map_slug=missing-avatar-map'))).status()).toBe(404);
        const replacement = await admin.request.post(`/api/v1/admin/media-assets/${mediaId}/replace`, {
            headers, multipart: { file: { name: 'new-avatar.svg', mimeType: 'image/svg+xml', buffer: picture('#abcdef') } },
        });
        expect(replacement.status()).toBe(200);
        expect((await replacement.json()).asset.reference_count).toBe(1);
        expect((await admin.request.delete(`/api/v1/admin/media-assets/${mediaId}`, { headers })).status()).toBe(404);
        expect(await (await learner.request.get(learnerUrl)).body()).toEqual(picture('#abcdef'));
        expect((await save({ enabled: false, avatar_url: avatar })).status()).toBe(200);
        expect((await learner.request.get('/api/v1/learner/companion?surface=desk')).status()).toBe(204);
        expect((await learner.request.get(learnerUrl)).status()).toBe(404);
        expect((await save({ enabled: true, avatar_url: null })).status()).toBe(200);
        expect((await learner.request.get(learnerUrl)).status()).toBe(404);
        const noAvatar = await learner.request.get('/api/v1/learner/companion?surface=desk');
        expect((await noAvatar.json()).avatar_url).toBeNull();
        const staticAvatar = '/images/themes/journal-paper-leather-background.png';
        expect((await save({ enabled: true, avatar_url: staticAvatar })).status()).toBe(200);
        const staticProjection = await learner.request.get('/api/v1/learner/companion?surface=desk');
        expect((await staticProjection.json()).avatar_url).toBe(staticAvatar);
    } finally {
        expect((await save(original)).status()).toBe(200);
        if (mediaId) expect((await admin.request.delete(`/api/v1/admin/media-assets/${mediaId}`, { headers })).status()).toBe(204);
        await admin.close(); await learner.close(); await guest.close();
    }
});
