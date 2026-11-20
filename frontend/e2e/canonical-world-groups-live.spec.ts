import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081';
const origin = new URL(baseURL).origin;

// No HTTP responses are mocked here. Global setup supplies disposable users;
// the administrative API creates only this test's groups and memberships.
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`canonical World groups persist through Rust at ${viewport.width}x${viewport.height}`, async ({ browser }, testInfo) => {
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const learner = await browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath('first') });
        const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
        const groups: string[] = [];
        const adminHeaders = await csrfHeaders(admin.request);
        try {
            const learnerMe = await learner.request.get('/api/v1/me');
            const peerMe = await peer.request.get('/api/v1/me');
            expect(learnerMe.status()).toBe(200);
            expect(peerMe.status()).toBe(200);
            const members = [(await learnerMe.json()).subject_id, (await peerMe.json()).subject_id];
            const marker = randomUUID();
            for (const prefix of ['Alpha', 'Beta']) {
                const created = await admin.request.post('/api/v1/admin/learning-groups', {
                    headers: adminHeaders,
                    data: { name: `${prefix} ${marker}`, description: null, study_topic: null },
                });
                expect(created.status()).toBe(201);
                const { group } = await created.json();
                groups.push(group.id);
                const assigned = await admin.request.patch(`/api/v1/admin/learning-groups/${group.id}/members`, {
                    headers: adminHeaders, data: { member_ids: members },
                });
                expect(assigned.status()).toBe(200);
            }
            const peerHeaders = await csrfHeaders(peer.request);
            const help = await peer.request.post(`/api/v1/learner/groups/${groups[1]}/messages`, {
                headers: peerHeaders, data: { body: 'Help me connect these ideas.', is_help_request: true },
            });
            expect(help.status()).toBe(200);
            const helpId = (await help.json()).group.messages[0].id;

            // A platform administrator is still an outsider to this member-only
            // learner endpoint; possession of a group UUID grants no access.
            const outsider = await admin.request.post(`/api/v1/learner/groups/${groups[1]}/messages`, {
                headers: adminHeaders, data: { body: 'Must not be persisted.', is_help_request: false },
            });
            expect(outsider.status()).toBe(404);
            const withoutCsrf = await learner.request.post(`/api/v1/learner/groups/${groups[1]}/messages`, {
                data: { body: 'Must not be persisted.', is_help_request: false },
            });
            expect(withoutCsrf.status()).toBe(403);

            const page = await learner.newPage();
            const legacyRequests: string[] = [];
            const browserErrors: string[] = [];
            page.on('pageerror', (error) => browserErrors.push(error.message));
            page.on('request', (request) => {
                if (new URL(request.url()).pathname.startsWith('/learning/groups')) legacyRequests.push(request.url());
            });
            await page.goto('/world');
            await page.getByRole('button', { name: 'Open groups' }).click();
            await expect(page.getByRole('heading', { name: `Alpha ${marker}` })).toBeVisible();
            await bounded(page.getByRole('button', { name: 'Next items' }), viewport);
            await page.getByRole('button', { name: 'Next items' }).click();
            await expect(page.getByRole('heading', { name: `Beta ${marker}` })).toBeVisible();
            await bounded(page.getByRole('button', { name: 'Mark resolved' }), viewport);
            await page.getByRole('button', { name: 'Mark resolved' }).click();
            await expect(page.getByText('Help request resolved', { exact: true })).toBeVisible();
            await page.getByPlaceholder('Message the group').fill('A persisted learner question.');
            await page.getByRole('checkbox', { name: 'Ask the group for help' }).check();
            await bounded(page.getByRole('button', { name: 'Send message' }), viewport);
            await page.getByRole('button', { name: 'Send message' }).click();
            await expect(page.getByText('A persisted learner question.', { exact: true })).toBeVisible();
            await expect(page.getByPlaceholder('Message the group')).toHaveValue('');
            await page.getByRole('button', { name: 'Vote 0/2' }).click();
            await expect(page.getByRole('button', { name: 'Voted', exact: true })).toBeDisabled();

            const persisted = await learner.request.get('/api/v1/learner/groups?page=2&per_page=1');
            expect(persisted.status()).toBe(200);
            const persistedGroup = (await persisted.json()).groups[0];
            expect(persistedGroup.id).toBe(groups[1]);
            expect(persistedGroup.messages).toEqual(expect.arrayContaining([
                expect.objectContaining({ id: helpId, can_resolve: false, resolved_at: expect.any(String) }),
                expect.objectContaining({ body: 'A persisted learner question.', is_help_request: true, can_resolve: false }),
            ]));
            expect(persistedGroup.admin_chat_vote_count).toBe(1);
            const selfMessage = persistedGroup.messages.find((message: { body: string }) => message.body === 'A persisted learner question.');
            const selfResolve = await learner.request.post(`/api/v1/learner/groups/${groups[1]}/messages/${selfMessage.id}/resolve`, {
                headers: await csrfHeaders(learner.request),
            });
            expect(selfResolve.status()).toBe(404);
            const peerVote = await peer.request.post(`/api/v1/learner/groups/${groups[1]}/admin-chat-vote`, { headers: peerHeaders });
            expect(peerVote.status()).toBe(200);
            expect((await peerVote.json()).group.admin_chat_visible).toBe(true);

            await page.reload();
            await page.getByRole('button', { name: 'Open groups' }).click();
            await page.getByRole('button', { name: 'Next items' }).click();
            await expect(page.getByText('A persisted learner question.', { exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Admin view allowed' })).toBeDisabled();
            await bounded(page.getByPlaceholder('Message the group'), viewport);
            await testInfo.attach('canonical-world-groups-rust', { body: await page.screenshot(), contentType: 'image/png' });
            expect(legacyRequests).toEqual([]);
            expect(browserErrors).toEqual([]);
        } finally {
            // These groups have no delete API. Clear only the memberships
            // created here so another viewport run starts with an empty list.
            for (const id of groups) {
                const cleared = await admin.request.patch(`/api/v1/admin/learning-groups/${id}/members`, {
                    headers: adminHeaders, data: { member_ids: [] },
                });
                expect(cleared.status()).toBe(200);
            }
            await admin.close();
            await learner.close();
            await peer.close();
        }
    });
}

async function csrfHeaders(request: APIRequestContext) {
    const response = await request.get('/api/v1/security/csrf');
    expect(response.status()).toBe(200);
    return { Origin: origin, 'X-CSRF-Token': (await response.json()).token as string };
}

async function bounded(locator: Locator, viewport: { width: number; height: number }) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}
