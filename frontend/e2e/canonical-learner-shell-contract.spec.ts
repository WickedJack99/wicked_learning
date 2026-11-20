import { expect, test, type APIRequestContext } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';
import type { components } from '../src/platform/api/schema';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081';

// Real Rust/DB/session evidence for the shared layout dependency. The layout
// itself is not activated until Journal/Companion and media seams are complete.
test('learner shell preserves native session prompting, private location and real inventory identities', async ({ browser }) => {
    const learner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
    const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
    const guest = await browser.newContext({ baseURL });
    const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
    const headers = await csrfHeaders(learner.request);
    let originalMap: string | undefined;
    let draftMap: string | undefined;
    try {
        expect((await guest.request.get('/api/v1/learner/shell')).status()).toBe(401);
        const read = await learner.request.get('/api/v1/learner/shell');
        expect(read.status()).toBe(200);
        const shell: components['schemas']['LearnerShell'] = await read.json();
        originalMap = shell.menu_theme?.map_id;
        expect(shell.name.length).toBeGreaterThan(0);
        expect(shell.public_presentation.learner_palette.dark.header_background_opacity).toBe(94);
        expect(shell.journal_theme).toHaveProperty('dark');
        expect(shell).not.toHaveProperty('pages');
        expect(shell).not.toHaveProperty('feedback_prompt');
        const worldResponse = await learner.request.get('/api/v1/learner/world');
        expect(worldResponse.status()).toBe(200);
        const world: components['schemas']['LearnerWorldSnapshot'] = await worldResponse.json();
        expect(shell.items).toEqual(world.items);
        expect(shell.tools).toEqual(world.tools);
        for (const record of [...shell.items, ...shell.tools]) expect(record.id).toMatch(/^[a-f0-9-]{36}$/);
        const alternative = world.graph.maps.find((map) => map.id !== originalMap);
        expect(alternative, 'local test seed requires two visible maps').toBeDefined();
        const peerBefore = await (await peer.request.get('/api/v1/learner/shell')).json();
        expect((await learner.request.post('/api/v1/learner/map-location', { data: { map: alternative!.id } })).status()).toBe(403);
        const saved = await learner.request.post('/api/v1/learner/map-location', { headers, data: { map: alternative!.slug } });
        expect(saved.status()).toBe(200);
        expect((await saved.json()).map_id).toBe(alternative!.id);
        expect((await (await learner.request.get('/api/v1/learner/shell')).json()).menu_theme.map_id).toBe(alternative!.id);
        expect((await (await peer.request.get('/api/v1/learner/shell')).json()).menu_theme).toEqual(peerBefore.menu_theme);
        expect((await learner.request.post('/api/v1/learner/map-location', { headers, data: { map: '../private' } })).status()).toBe(400);
        expect((await learner.request.post('/api/v1/learner/map-location', { headers, data: { map: alternative!.id, principal_id: 'another-user' } })).status()).toBe(422);
        expect((await learner.request.post('/api/v1/learner/map-location', { headers, data: { map: '00000000-0000-0000-0000-000000000000' } })).status()).toBe(404);
        const created = await admin.request.post('/api/v1/admin/world-builder/maps', {
            headers: await csrfHeaders(admin.request), data: { title: `Shell draft ${Date.now()}`, description: null, slug: null },
        });
        expect(created.status()).toBe(201);
        draftMap = (await created.json()).map_id;
        expect((await learner.request.post('/api/v1/learner/map-location', { headers, data: { map: draftMap } })).status()).toBe(404);

        const preference = async (action: string) => {
            const response = await learner.request.patch('/api/v1/learner/feedback-prompt-preference', { headers, data: { action } });
            expect(response.status()).toBe(200);
            return response.json();
        };
        const claim = async (surface: string) => {
            const response = await learner.request.post('/api/v1/learner/feedback-prompt/claim', { headers, data: { surface } });
            expect(response.status()).toBe(200);
            return (await response.json()).show;
        };
        await preference('enable');
        expect((await learner.request.post('/api/v1/learner/feedback-prompt/claim', { data: { surface: 'world' } })).status()).toBe(403);
        expect(await claim('settings')).toBe(false);
        expect(await claim('feedback')).toBe(false);
        // Shell GET does not consume the invitation.
        expect((await learner.request.get('/api/v1/learner/shell')).status()).toBe(200);
        expect(await claim('world')).toBe(true);
        expect(await claim('world')).toBe(false);
        expect(await claim('home')).toBe(false);
        expect((await preference('dismiss')).status).toBe('snoozed');
        expect(await claim('world')).toBe(false);
        await preference('enable');
        expect(await claim('world')).toBe(true);
        await preference('decline');
        expect(await claim('world')).toBe(false);
        expect((await learner.request.post('/api/v1/learner/feedback-prompt/claim', { headers, data: { surface: 'invented' } })).status()).toBe(400);
    } finally {
        if (originalMap) expect((await learner.request.post('/api/v1/learner/map-location', { headers, data: { map: originalMap } })).status()).toBe(200);
        expect((await learner.request.patch('/api/v1/learner/feedback-prompt-preference', { headers, data: { action: 'enable' } })).status()).toBe(200);
        if (draftMap) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${draftMap}`, { headers: await csrfHeaders(admin.request) })).status()).toBe(204);
        await learner.close(); await peer.close(); await guest.close(); await admin.close();
    }
});

async function csrfHeaders(request: APIRequestContext) {
    const response = await request.get('/api/v1/security/csrf');
    expect(response.status()).toBe(200);
    return { Origin: new URL(baseURL).origin, 'X-CSRF-Token': (await response.json()).token };
}
