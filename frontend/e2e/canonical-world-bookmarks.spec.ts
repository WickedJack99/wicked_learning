import { expect, test } from '@playwright/test';
import { collaborationStorageStatePath } from './session-state';

const evidence = process.env.BOOKMARK_EVIDENCE_BASE_URL;

test('bookmark adapter keeps per-object identity contexts and rejects forged or incomplete contracts', async ({ page }) => {
    test.skip(!evidence, 'Requires the canonical Vite evidence server.');
    let requests = 0;
    const writes: string[] = [];
    let invalid: 'unknown' | 'missing-target' | 'wrong-state' | null = null;
    await page.route('**/api/v1/security/csrf', (route) => { requests++; return route.fulfill({ json: { token: 'bookmark-test' } }); });
    await page.route('**/api/v1/learner/maps/*/nodes/*/bookmark', (route) => {
        writes.push(new URL(route.request().url()).pathname);
        expect(route.request().headers()['x-csrf-token']).toBe('bookmark-test');
        const third = route.request().url().includes('/third-map/');
        return route.fulfill({ json: { bookmarked: invalid !== 'wrong-state', bookmarked_nodes: invalid === 'unknown'
            ? [{ map_slug: 'unknown-map', node_slug: 'same-place' }]
            : (invalid === 'missing-target' ? ['second-map'] : third ? ['third-map'] : ['first-map', 'second-map']).map((map_slug) => ({ map_slug, node_slug: 'same-place' })),
        } });
    });
    await page.goto(evidence!);
    const result = await page.evaluate(async () => {
        const { registerBookmarkWorld, bookmarkNode } = await import('/src/platform/world-bookmarks.ts');
        const first = { id: '11111111-1111-4111-8111-111111111111', slug: 'same-place', mapSlug: 'first-map' };
        const second = { id: '22222222-2222-4222-8222-222222222222', slug: 'same-place', mapSlug: 'second-map' };
        const third = { id: '33333333-3333-4333-8333-333333333333', slug: 'same-place', mapSlug: 'third-map' };
        registerBookmarkWorld({ maps: [{ slug: first.mapSlug, nodes: [first] }, { slug: second.mapSlug, nodes: [second] }] }, new Map([['first-map:same-place', first.id], ['second-map:same-place', second.id]]));
        registerBookmarkWorld({ maps: [{ slug: third.mapSlug, nodes: [third] }] }, new Map([['third-map:same-place', third.id]]));
        let forgedStatus = 0;
        try { await bookmarkNode({ ...first }, 'POST'); } catch (error) { forgedStatus = error.status; }
        const firstResult = await bookmarkNode(first, 'POST');
        const thirdResult = await bookmarkNode(third, 'POST');
        window.bookmarkEvidenceNode = first;
        return { forgedStatus, firstResult, thirdResult };
    });
    expect(result.forgedStatus).toBe(409);
    expect(result.firstResult.bookmarkedNodeIds).toEqual(['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']);
    expect(result.thirdResult.bookmarkedNodeIds).toEqual(['33333333-3333-4333-8333-333333333333']);
    expect(requests).toBe(2);
    expect(writes).toEqual(['/api/v1/learner/maps/first-map/nodes/same-place/bookmark', '/api/v1/learner/maps/third-map/nodes/same-place/bookmark']);
    for (const failure of ['unknown', 'missing-target', 'wrong-state'] as const) {
        invalid = failure;
        expect(await page.evaluate(async () => {
        const { bookmarkNode } = await import('/src/platform/world-bookmarks.ts');
        try { await bookmarkNode(window.bookmarkEvidenceNode, 'POST'); return 200; } catch (error) { return error.status; }
        })).toBe(503);
    }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`copied World persists and removes native owned bookmarks at ${viewport.width}`, async ({ browser, baseURL }, info) => {
        const context = await browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath('first') });
        const other = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
        const world = await (await context.request.get('/api/v1/learner/world')).json();
        const shell = await (await context.request.get('/api/v1/learner/shell')).json();
        const map = world.world.maps[0];
        const node = map.nodes.find((node) => !['hidden', 'locked'].includes(node.state));
        const reference = { map_slug: map.slug, node_slug: node.slug };
        const hasBookmark = (document) => document.bookmarked_nodes.some((row) => row.map_slug === reference.map_slug && row.node_slug === reference.node_slug);
        const originallyBookmarked = hasBookmark(world);
        const otherBefore = hasBookmark(await (await other.request.get('/api/v1/learner/world')).json());
        const csrf = await context.request.get('/api/v1/security/csrf');
        const headers = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await csrf.json()).token };
        const path = `/api/v1/learner/maps/${map.slug}/nodes/${node.slug}/bookmark`;
        try {
            if (originallyBookmarked) expect((await context.request.delete(path, { headers })).status()).toBe(200);
            expect((await context.request.post(path, { headers: { Origin: headers.Origin } })).status()).toBe(403);
            const page = await context.newPage();
            page.setDefaultTimeout(5_000);
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await page.goto(`/world?map=${map.slug}&focused=${node.slug}`);
            const toggle = async (label: string) => {
                const button = page.getByRole('button', { name: label, exact: true });
                await expect(button).toBeVisible();
                if (viewport.width === 390) { await button.focus(); await button.press('Enter'); }
                else await button.click();
            };
            await page.route(`**${path}`, (route) => route.fulfill({ status: 503, json: { title: 'Unavailable' } }));
            await toggle('Bookmark this tile');
            await expect(page.getByRole('alert')).toHaveText('The bookmark could not be updated.');
            expect(hasBookmark(await (await context.request.get('/api/v1/learner/world')).json())).toBe(false);
            await page.unroute(`**${path}`);
            await toggle('Bookmark this tile');
            await expect(page.getByRole('button', { name: 'Remove bookmark', exact: true })).toBeVisible();
            await expect(page.getByRole('alert')).toHaveCount(0);
            expect(hasBookmark(await (await context.request.get('/api/v1/learner/world')).json())).toBe(true);
            expect(hasBookmark(await (await other.request.get('/api/v1/learner/world')).json())).toBe(otherBefore);
            await page.reload();
            await expect(page.getByRole('button', { name: 'Remove bookmark', exact: true })).toBeVisible();
            await info.attach(`native-bookmark-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' });
            await toggle('Remove bookmark');
            await expect(page.getByRole('button', { name: 'Bookmark this tile', exact: true })).toBeVisible();
            expect(hasBookmark(await (await context.request.get('/api/v1/learner/world')).json())).toBe(false);
            await page.reload();
            await expect(page.getByRole('button', { name: 'Bookmark this tile', exact: true })).toBeVisible();
            expect(errors).toEqual(['The bookmark could not be updated.']);
        } finally {
            const restored = originallyBookmarked
                ? await context.request.post(path, { headers })
                : await context.request.delete(path, { headers });
            expect(restored.status()).toBe(200);
            if (shell.menu_theme) expect((await context.request.post('/api/v1/learner/map-location', { headers, data: { map: shell.menu_theme.map_id } })).status()).toBe(200);
            await context.close();
            await other.close();
        }
    });
}
