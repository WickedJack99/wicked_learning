import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page, type Locator } from '@playwright/test';
import { DEFAULT_JOURNAL_THEME } from '../canonical-source/resources/js/features/journal/theme';
import { collaborationStorageStatePath } from './session-state';

test.skip(!process.env.JOURNAL_EVIDENCE_BASE_URL, 'Requires the independent Journal Vite evidence server.');
const evidence = process.env.JOURNAL_EVIDENCE_BASE_URL ?? 'http://localhost:8083';
const id = '018f1f8c-4c2f-7b8a-9d0e-000000000001';
const activityId = '018f1f8c-4c2f-7b8a-9d0e-000000000002';
const nodeId = '018f1f8c-4c2f-7b8a-9d0e-000000000003';
const checkInId = '018f1f8c-4c2f-7b8a-9d0e-000000000004';
const timestamp = '2026-11-19T12:00:00Z';
const theme = Object.fromEntries(Object.entries(DEFAULT_JOURNAL_THEME).map(([mode, values]) => [mode,
    Object.fromEntries(Object.entries(values).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value])),
]));
const wirePage = {
    id, title: 'Private note', topic: 'General', subtopic: 'Observation', markdown: 'My own **reflection**.',
    preferred_mode: 'edit', expert_access_requested: false, feedback_request: null, reflection_count: 1, updated_at: timestamp,
    learning_context: { activity_id: activityId, node_id: nodeId, activity_title: 'Reflect', map_slug: 'a-map', map_title: 'A map',
        node_slug: 'a-place', node_title: 'A place', topic: { slug: 'topic', title: 'A topic', href: '/topics/topic' } },
};
const sourcePage = {
    id, title: 'Private note', topic: 'General', subtopic: 'Observation', markdown: 'My own **reflection**.',
    preferredMode: 'edit', expertAccessRequested: false, feedbackRequest: null, reflectionCount: 1, updatedAt: timestamp,
    learningContext: { activityHref: `/learning/nodes/${nodeId}/play?activity_id=${activityId}`, activityTitle: 'Reflect',
        mapHref: '/world?map=a-map&focused=a-place', mapTitle: 'A map', nodeHref: `/learning/nodes/${nodeId}/play`,
        nodeTitle: 'A place', topic: { title: 'A topic', href: '/topics/topic' } },
};
const document = {
    allow_expert_access_requests: true, check_ins: [], feedback_domains: [{ id: null, key: 'journal', label: 'Journal reviewers', type: 'journal' }],
    pages: [wirePage], pagination: { current_page: 1, last_page: 2, per_page: 4, total: 5 }, revisit_invitations: [], theme,
};
const sourceDocument = {
    allowExpertAccessRequests: true, checkIns: [], feedbackDomains: document.feedback_domains, pages: [sourcePage],
    pagination: { currentPage: 1, lastPage: 2, perPage: 4, total: 5 }, revisitInvitations: [], theme: DEFAULT_JOURNAL_THEME,
};

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test.describe(`canonical Journal ${viewport.width}`, () => {
        test.use({ viewport });
        test('whole overlay matches original, preserving controls, context URLs and failed drafts', async ({ page, context }, info) => {
            for (const path of ['features/journal/journal-overlay.tsx', 'features/journal/journal-client.ts', 'features/journal/theme.ts', 'features/world/api.ts']) {
                const original = execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:resources/js/${path}`]);
                expect(readFileSync(new URL(`../../resources/js/${path}`, import.meta.url))).toEqual(original);
                expect(readFileSync(new URL(`../canonical-source/resources/js/${path}`, import.meta.url))).toEqual(original);
            }
            const source = await context.newPage();
            await page.route('**/api/v1/learner/journal?*', (route) => route.fulfill({ json: document }));
            await source.route('**/learning/journal?*', (route) => route.fulfill({ json: sourceDocument }));
            await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ json: { token: 'native-csrf' } }));
            await page.goto(`${evidence}/e2e/canonical-journal.html`);
            await source.goto(`${evidence}/e2e/canonical-journal.html?original`);
            for (const target of [page, source]) {
                await expect(target.getByLabel('Title', { exact: true })).toHaveValue('Private note');
                await expect(target.locator('a[href="/learning/journal/export"]')).toHaveCount(1);
                await expect(target.locator(`a[href="/learning/nodes/${nodeId}/play?activity_id=${activityId}"]`)).toHaveCount(1);
            }
            for (const label of ['Search journal pages', 'Add journal page', 'Close journal', 'Title', 'Delete journal page']) {
                const rustControl = page.getByLabel(label, { exact: true });
                const sourceControl = source.getByLabel(label, { exact: true });
                await bounded(rustControl, viewport);
                expect(await rustControl.boundingBox()).toEqual(await sourceControl.boundingBox());
            }
            expect(await page.locator('#learning-journal-panel').innerText()).toBe(await source.locator('#learning-journal-panel').innerText());
            const editorBounds = await page.getByPlaceholder('Write in Markdown...').boundingBox();
            expect(editorBounds).toEqual(await source.getByPlaceholder('Write in Markdown...').boundingBox());
            await info.attach('source-editor-bounds', { contentType: 'application/json', body: JSON.stringify({ viewport, editorBounds,
                knownSourceDefect: viewport.width === 390 ? 'Context and review panels displace the editor below the clipped panel.' : null }) });
            await expect.poll(() => page.locator('#learning-journal-panel img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
            await info.attach('original-journal', { body: await source.screenshot(), contentType: 'image/png' });
            await info.attach('canonical-journal', { body: await page.screenshot(), contentType: 'image/png' });
            await page.route(`**/api/v1/learner/journal/pages/${id}`, (route) => {
                expect(route.request().method()).toBe('PATCH');
                expect(route.request().headers()['x-csrf-token']).toBe('native-csrf');
                expect(route.request().postDataJSON().request_expert_access).toBe(false);
                return route.fulfill({ status: 503, json: { title: 'Unavailable' } });
            });
            await page.getByLabel('Title', { exact: true }).fill('Keep my draft');
            await expect(page.getByText('Your changes are still here. Saving will retry when you continue editing.')).toBeVisible();
            await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Keep my draft');
            await source.close();
        });

        test('copied overlay creates, saves, reloads, searches and deletes through real Rust', async ({ browser }, info) => {
            const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081';
            const context = await browser.newContext({ viewport, baseURL: base, storageState: collaborationStorageStatePath('first') });
            const page = await context.newPage();
            let createdId: string | undefined;
            const title = `Canonical Journal ${randomUUID()}`;
            try {
                await page.goto(`${evidence}/e2e/canonical-journal.html`);
                await expect(page.getByLabel('Add journal page')).toBeEnabled();
                const created = page.waitForResponse((response) => response.url().endsWith('/api/v1/learner/journal/pages') && response.request().method() === 'POST');
                await page.getByLabel('Add journal page').click();
                const response = await created;
                expect(response.status()).toBe(200);
                createdId = (await response.json()).page.id;
                await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Untitled page');
                await page.getByLabel('Title', { exact: true }).fill(title);
                await expect(page.getByText('All changes saved.')).toBeVisible();
                await page.reload();
                await page.getByLabel('Search journal pages').fill(title);
                await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title);
                await bounded(page.getByLabel('Delete journal page'), viewport);
                await info.attach('live-rust-journal', { body: await page.screenshot(), contentType: 'image/png' });
                const deleted = page.waitForResponse((response) => response.url().endsWith(`/api/v1/learner/journal/pages/${createdId}`) && response.request().method() === 'DELETE');
                page.once('dialog', (dialog) => dialog.accept());
                await page.getByLabel('Delete journal page').click();
                expect((await deleted).status()).toBe(200);
                createdId = undefined;
                await expect(page.getByText(`No pages match “${title}”.`)).toBeVisible();
            } finally {
                if (createdId) {
                    const csrf = await context.request.get(`${base}/api/v1/security/csrf`);
                    await context.request.delete(`${base}/api/v1/learner/journal/pages/${createdId}`, {
                        headers: { Origin: new URL(base).origin, 'X-CSRF-Token': (await csrf.json()).token },
                    });
                }
                await context.close();
            }
        });
    });
}

async function bounded(locator: Locator, viewport: { width: number; height: number }) {
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0); expect(box!.height).toBeGreaterThan(0);
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}

test('source Journal client maps feedback, check-ins and revisit writes without confusing identities', async ({ page }) => {
    const invitation = {
        activity_id: activityId, node_id: nodeId, check_in_id: checkInId, activity_slug: 'reflect', activity_title: 'Reflect',
        available_after_days: 3, available_at: timestamp, available_since: timestamp, revisit_reason: 'pause',
        map_slug: 'a-map', map_title: 'A map', node_slug: 'a-place', node_title: 'A place',
    };
    await page.route('**/api/v1/learner/journal?*', (route) => route.fulfill({ json: {
        ...document, revisit_invitations: [invitation], check_ins: [{ ...invitation, id: checkInId, feeling: 'forming',
            note: 'Private words', next_direction: 'revisit', origin_topic_slug: 'topic', recorded_at: timestamp,
            topics: [{ name: 'A topic', slug: 'topic' }] }],
    } }));
    await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ json: { token: 'native-csrf' } }));
    await page.goto(`${evidence}/e2e/canonical-journal.html`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Private note');
    const client = '/canonical-source/resources/js/features/journal/journal-client.ts';
    const payload = await page.evaluate(async (path) => (await import(/* @vite-ignore */ path)).getCachedJournalPayload(), client);
    expect(payload.pages).toEqual([sourcePage]);
    expect(payload.checkIns[0]).toMatchObject({ activityId, activityHref: sourcePage.learningContext.activityHref,
        nodeHref: sourcePage.learningContext.nodeHref, topics: [{ name: 'A topic', slug: 'topic' }] });
    expect(payload.revisitInvitations[0]).toMatchObject({ activityId, activityHref: `${sourcePage.learningContext.activityHref}&revisit=1`, nodeHref: '/world?map=a-map&focused=a-place' });

    let fail = true;
    await page.route(`**/api/v1/learner/revisit-invitations/${checkInId}`, (route) => {
        expect(route.request().postDataJSON()).toEqual({ action: 'snooze' });
        expect(route.request().headers()['x-csrf-token']).toBe('native-csrf');
        return fail ? route.fulfill({ status: 403, json: { title: 'Forbidden' } })
            : route.fulfill({ json: { check_in_id: checkInId, revisit_status: 'snoozed', available_at: timestamp } });
    });
    const update = () => page.evaluate(async ({ path, activityId }) => {
        const client = await import(/* @vite-ignore */ path);
        try { await client.updateRevisitInvitation(activityId, 'snooze'); return { ok: true, invitations: client.getCachedJournalPayload().revisitInvitations }; }
        catch (error) { return { ok: false, status: error.status, invitations: client.getCachedJournalPayload().revisitInvitations }; }
    }, { path: client, activityId });
    const rejected = await update();
    expect(rejected.status).toBe(403); expect(rejected.invitations).toHaveLength(1);
    fail = false;
    expect(await update()).toMatchObject({ ok: true, invitations: [] });
    expect((await update()).status).toBe(409); // no invented or stale check-in target

    await page.route(`**/api/v1/learner/journal/pages/${id}/feedback-request`, (route) => {
        expect(route.request().postDataJSON()).toEqual({ domain_key: 'journal' });
        expect(route.request().headers()['x-csrf-token']).toBe('native-csrf');
        return route.fulfill({ json: { page: { ...wirePage, expert_access_requested: true, feedback_request: {
            domain: { id: null, label: 'Journal reviewers', type: 'journal' }, feedback: null,
            requested_at: timestamp, responded_at: null, status: 'pending',
        } } } });
    });
    const reviewed = await page.evaluate(async ({ path, id }) => (await import(/* @vite-ignore */ path)).requestJournalFeedback(id, 'journal'), { path: client, id });
    expect(reviewed.expertAccessRequested).toBe(true);
    expect(reviewed.feedbackRequest).toMatchObject({ status: 'pending', requestedAt: timestamp, respondedAt: null });
});

test('source pagination/search reach Rust and closing aborts its pending request', async ({ page }) => {
    await page.route('**/api/v1/learner/journal?*', async (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.get('search') === 'pending') return;
        expect(url.searchParams.get('per_page')).toBe('4');
        return route.fulfill({ json: { ...document, pagination: { ...document.pagination, current_page: Number(url.searchParams.get('page')) } } });
    });
    await page.goto(`${evidence}/e2e/canonical-journal.html`);
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Private note');
    const next = page.waitForRequest((request) => request.url().includes('/learner/journal?page=2&'));
    await page.getByRole('button', { name: 'Next items', exact: true }).click();
    await next;
    const pending = page.waitForRequest((request) => request.url().includes('search=pending'));
    await page.getByLabel('Search journal pages').fill('pending');
    await pending;
    const failed = page.waitForEvent('requestfailed', { predicate: (request) => request.url().includes('search=pending') });
    await page.getByLabel('Close journal').click();
    expect((await failed).failure()?.errorText).toContain('ERR_ABORTED');
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('failed initial Journal read never renders empty success or enables create', async ({ page, context }) => {
    const source = await context.newPage();
    await page.route('**/api/v1/learner/journal?*', (route) => route.fulfill({ status: 503, json: { title: 'Unavailable' } }));
    await source.route('**/learning/journal?*', (route) => route.fulfill({ status: 503, json: { message: 'Unavailable' } }));
    for (const [target, query] of [[page, ''], [source, '?original']] as const) {
        const failed = target.waitForResponse((response) => response.status() === 503);
        await target.goto(`${evidence}/e2e/canonical-journal.html${query}`);
        await failed;
        await expect(target.getByLabel('Add journal page')).toBeDisabled();
        await expect(target.getByLabel('Loading journal pages')).toBeVisible();
        await expect(target.getByText('All changes saved.')).toHaveCount(0);
    }
    await source.close();
});
