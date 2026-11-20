import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import type { components } from '../src/platform/api/schema';
import { collaborationStorageStatePath } from './session-state';

test('Journal list and write responses preserve actual context identities and owner scope', async ({ browser }, testInfo) => {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081';
    expect(new URL(baseURL).hostname, 'reflection fixture requires local Compose').toMatch(/^(localhost|127\.0\.0\.1)$/);
    const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
    const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
    const guest = await browser.newContext({ baseURL });
    const headers = await csrf(owner.request, baseURL);
    let pageId: string | undefined;
    try {
        expect((await guest.request.get('/api/v1/learner/journal')).status()).toBe(401);
        const title = `Journal context ${randomUUID()}`;
        const draft = { title, topic: 'General', subtopic: '', markdown: 'Only this learner may read these words.', preferred_mode: 'edit' };
        const created = await owner.request.post('/api/v1/learner/journal/pages', { headers, data: draft });
        expect(created.status()).toBe(200);
        const page = (await created.json()).page;
        pageId = uuid(page.id);
        expect(page.learning_context).toBeNull();
        const worldResponse = await owner.request.get('/api/v1/learner/world');
        expect(worldResponse.status()).toBe(200);
        const world: components['schemas']['LearnerWorldSnapshot'] = await worldResponse.json();
        const map = world.graph.maps.find((map) => map.nodes.some((node) => node.starts.length))!;
        const node = map.nodes.find((node) => node.starts.length)!;
        const start = node.starts[0];
        const subject = uuid((await (await owner.request.get('/api/v1/me')).json()).subject_id);
        // Attach one private test reflection to an actual published source
        // context. This is a read-contract fixture, not playback acceptance.
        execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], {
            input: `INSERT INTO learner_reflections (principal_id, learner_journal_page_id, activity_id, activity_start_id, play_run_id, title, question, reflection) SELECT id, '${pageId}', '${uuid(start.activity_id)}', '${uuid(start.id)}', '${randomUUID()}', 'Test reflection', 'What changed?', 'Private source context' FROM application_principals WHERE identity_subject_id = '${subject}'`,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        const query = `/api/v1/learner/journal?per_page=4&search=${encodeURIComponent(title)}`;
        const readStarted = performance.now();
        const read = await owner.request.get(query);
        await testInfo.attach('journal-read-measurement', { contentType: 'application/json', body: JSON.stringify({
            duration_ms: Math.round(performance.now() - readStarted), bytes: (await read.body()).length,
        }) });
        expect(read.status()).toBe(200);
        const document: components['schemas']['LearnerJournalDocument'] = await read.json();
        expect(document.pagination.total).toBe(1);
        expect(document.pages[0].reflection_count).toBe(1);
        const context = document.pages[0].learning_context;
        expect(context).toMatchObject({ activity_id: start.activity_id, node_id: node.id, map_slug: map.slug, node_slug: node.slug });
        expect(context).toHaveProperty('topic');
        const peerRead = await peer.request.get(query);
        expect(peerRead.status()).toBe(200);
        expect((await peerRead.json()).pages).toEqual([]);
        expect((await owner.request.patch(`/api/v1/learner/journal/pages/${pageId}`, { data: draft })).status()).toBe(403);
        const updated = await owner.request.patch(`/api/v1/learner/journal/pages/${pageId}`, { headers, data: { ...draft, markdown: 'Edited private words.' } });
        expect(updated.status()).toBe(200);
        expect((await updated.json()).page.learning_context).toEqual(context);
        const peerHeaders = await csrf(peer.request, baseURL);
        expect((await peer.request.patch(`/api/v1/learner/journal/pages/${pageId}`, { headers: peerHeaders, data: draft })).status()).toBe(404);
        expect((await peer.request.delete(`/api/v1/learner/journal/pages/${pageId}`, { headers: peerHeaders })).status()).toBe(404);
        const exported = await owner.request.get('/api/v1/learner/journal/export');
        expect(exported.status()).toBe(200);
        expect(await exported.text()).toContain('Edited private words.');
        expect(await (await peer.request.get('/api/v1/learner/journal/export')).text()).not.toContain(title);
    } finally {
        if (pageId) expect((await owner.request.delete(`/api/v1/learner/journal/pages/${pageId}`, { headers })).status()).toBe(200);
        await owner.close(); await peer.close(); await guest.close();
    }
});

function uuid(value: string): string {
    expect(value).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    return value;
}

async function csrf(request: APIRequestContext, baseURL: string) {
    const response = await request.get('/api/v1/security/csrf');
    expect(response.status()).toBe(200);
    return { Origin: new URL(baseURL).origin, 'X-CSRF-Token': (await response.json()).token };
}
