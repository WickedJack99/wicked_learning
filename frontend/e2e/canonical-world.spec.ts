import { expect, test } from '@playwright/test';
import type { Locator, Page, Route } from '@playwright/test';
import type { components } from '../src/platform/api/schema';
import { toWorldPageProps } from '../src/platform/world-projection';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mockWorldShell } from './canonical-shell-fixture';

const worldIds = {
    world: '018f1f8c-4c2f-7b8a-9d0e-000000000001',
    map: '018f1f8c-4c2f-7b8a-9d0e-000000000002',
    asset: '018f1f8c-4c2f-7b8a-9d0e-000000000003',
    node: '018f1f8c-4c2f-7b8a-9d0e-000000000004',
    activity: '018f1f8c-4c2f-7b8a-9d0e-000000000005',
    nextActivity: '018f1f8c-4c2f-7b8a-9d0e-000000000006',
    start: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
};

const viewports = [
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'narrow', viewport: { width: 390, height: 844 } },
] as const;

for (const { name, viewport } of viewports) {
    test.describe(`${name} canonical learner World`, () => {
        test.use({ viewport });

        test('mounts the copied map, keeps controls bounded, and leaves playback unavailable', async ({ page }) => {
            await routeWorldReads(page);
            let worldWrites = 0;
            page.on('request', (request) => {
                if (
                    request.url().includes('/api/v1/learner/') &&
                    request.method() !== 'GET' &&
                    !/\/(map-location|feedback-prompt\/claim)$/.test(new URL(request.url()).pathname)
                ) {
                    worldWrites += 1;
                }
            });

            await page.goto('/world?map=orientation-map');

            await expect(page.getByRole('heading', { name: 'Orientation map' })).toBeVisible();
            const node = page.getByRole('button', {
                name: 'First place',
            });
            await expectBounded(node, viewport);
            await expectBounded(
                page.getByRole('button', { name: 'Open groups' }),
                viewport,
            );

            if (name === 'desktop') {
                await expectBounded(
                    page.getByLabel('Search maps, places and topics'),
                    viewport,
                );
            } else {
                await expectBounded(
                    page.getByRole('button', { name: 'Open map search' }),
                    viewport,
                );
            }

            await node.click();
            await expect(page.getByRole('heading', { name: 'First place' })).toBeVisible();

            if (name === 'narrow') {
                await expectCoveredByLearnerHeader(page);
            } else {
                await expectBounded(page.getByRole('button', { name: 'Bookmark this tile' }), viewport);
            }

            await page.getByRole('button', { name: 'Begin orientation' }).click();
            await expect(
                page.getByRole('heading', { name: 'This page is not available yet' }),
            ).toBeVisible();
            await expect(page.getByText(`Requested path: /learning/nodes/${worldIds.node}/play`)).toBeVisible();
            expect(await page.evaluate(() => JSON.parse(localStorage.getItem('learning.activeActivity')!))).toMatchObject({
                activityId: worldIds.activity,
                activityTitle: 'Orientation activity',
                playHref: `/learning/nodes/${worldIds.node}/play?activity=${worldIds.activity}&route=${worldIds.start}`,
            });
            expect(worldWrites).toBe(0);
        });

        test('search preserves pinned-source loading, pagination, empty state and navigation', async ({ page, context }, info) => {
            test.skip(!process.env.SOURCE_EVIDENCE_BASE_URL, 'Requires the whole pinned-source layout server.');
            expect(execFileSync('git', ['diff', '--name-only', '32c3113a5bc688c9944c20942cdf40a6a5d57d7f', '--', 'resources/js', 'resources/css/app.css']).toString()).toBe('');
            const shell = await routeWorldReads(page);
            const source = await context.newPage();
            const props = { ...sourceWorldProps(), name: shell.name, progress: { activities: {} } };
            await source.addInitScript((props) => { window.sourceWorldEvidence = props; window.sourceWorldEvidenceUrl = '/world?map=orientation-map'; }, props);
            let release!: () => void;
            const pending = new Promise<void>((resolve) => { release = resolve; });
            for (const [target, pattern, original] of [
                [page, '**/api/v1/learner/search?*', false],
                [source, '**/learning/search?*', true],
            ] as const) {
                await target.route(pattern, async (route) => {
                    const url = new URL(route.request().url());
                    expect(url.searchParams.get('per_page')).toBe('5');
                    const query = url.searchParams.get('query');
                    if (query === 'unavailable') return route.fulfill({ status: 503, json: { message: 'Search unavailable.' } });
                    await pending;
                    return route.fulfill({ json: worldSearchPage(Number(url.searchParams.get('page')), original, query === 'nothing') });
                });
            }
            await source.goto(`${process.env.SOURCE_EVIDENCE_BASE_URL}/e2e/canonical-learner-layout-source.html`);
            await page.goto('/world?map=orientation-map');
            const input = (target: Page) => target.getByRole('textbox', { name: 'Search maps, places and topics' });
            for (const target of [source, page]) {
                if (name === 'narrow') await target.getByRole('button', { name: 'Open map search' }).click();
                await expectBounded(input(target), viewport);
                await input(target).fill('orientation');
                await expect(target.getByText('Searching...', { exact: true }).filter({ visible: true })).toBeVisible();
            }
            await info.attach('main-search-loading', { body: await source.screenshot(), contentType: 'image/png' });
            await info.attach('rust-search-loading', { body: await page.screenshot(), contentType: 'image/png' });
            release();
            for (const target of [source, page]) await expect(target.getByRole('button', { name: 'Orientation map World map', exact: true })).toBeVisible();
            for (const controlName of ['Topic 0 Topic', 'Orientation map World map', 'Next results']) {
                const actual = page.getByRole('button', { name: controlName, exact: true });
                await expectBounded(actual, viewport);
                expect(await actual.boundingBox()).toEqual(await source.getByRole('button', { name: controlName, exact: true }).boundingBox());
            }
            await info.attach('main-search-results', { body: await source.screenshot(), contentType: 'image/png' });
            await info.attach('rust-search-results', { body: await page.screenshot(), contentType: 'image/png' });
            for (const target of [source, page]) {
                await input(target).fill('nothing');
                await expect(target.getByText('No visible maps, places or topics found.', { exact: true }).filter({ visible: true })).toBeVisible();
                await input(target).fill('unavailable');
            }
            await expect(page.getByRole('alert')).toHaveText('The World search is currently unavailable.');
            await expect(source.getByText('No visible maps, places or topics found.', { exact: true }).filter({ visible: true })).toBeVisible();
            for (const target of [source, page]) {
                await input(target).fill('orientation');
                await target.getByRole('button', { name: 'Orientation map World map', exact: true }).click();
                await expect(target).toHaveURL(/world\?map=orientation-map$/);
                if (name === 'narrow') await target.getByRole('button', { name: 'Open map search' }).click();
                await target.getByRole('button', { name: 'Next results', exact: true }).click();
                await expectBounded(target.getByRole('button', { name: 'First place Orientation map', exact: true }), viewport);
            }
            await expect(page.getByRole('alert')).toHaveCount(0);
            expect(await page.getByRole('button', { name: 'First place Orientation map', exact: true }).boundingBox())
                .toEqual(await source.getByRole('button', { name: 'First place Orientation map', exact: true }).boundingBox());
            for (const target of [source, page]) {
                await target.getByRole('button', { name: 'First place Orientation map', exact: true }).click();
                await expect(target).toHaveURL(/world\?map=orientation-map&focused=first-place$/);
                if (name === 'narrow') await target.getByRole('button', { name: 'Open map search' }).click();
                await target.getByRole('button', { name: 'Previous results', exact: true }).click();
                await target.getByRole('button', { name: 'Topic 0 Topic', exact: true }).click();
                await expect(target).toHaveURL(/topics\/topic-0$/);
            }
            await expect(page.getByRole('heading', { name: 'This page is not available yet' })).toBeVisible();
            await source.close();
        });

        test('source Companion wrapper obstructs pointer search while keyboard search remains usable', async ({ page, context }, info) => {
            test.skip(!process.env.SOURCE_EVIDENCE_BASE_URL, 'Requires the whole pinned-source layout server.');
            const shell = await routeWorldReads(page);
            await page.route('**/api/v1/learner/companion?*', (route) => route.fulfill({ json: searchCompanionFixture(false) }));
            await page.route('**/api/v1/learner/search?*', (route) => route.fulfill({ json: worldSearchPage(1, false) }));
            const source = await context.newPage();
            await source.route('**/learning/search?*', (route) => route.fulfill({ json: worldSearchPage(1, true) }));
            await source.addInitScript((props) => { window.sourceWorldEvidence = props; window.sourceWorldEvidenceUrl = '/world?map=orientation-map'; }, {
                ...sourceWorldProps(), name: shell.name, companion: searchCompanionFixture(true), progress: { activities: {} },
            });
            await source.goto(`${process.env.SOURCE_EVIDENCE_BASE_URL}/e2e/canonical-learner-layout-source.html`);
            await page.goto('/world?map=orientation-map');
            const control = (target: Page) => name === 'narrow'
                ? target.getByRole('button', { name: 'Open map search' })
                : target.getByRole('textbox', { name: 'Search maps, places and topics' });
            for (const target of [source, page]) {
                await expect(target.getByRole('button', { name: 'Open Guide', exact: true })).toBeVisible();
                await expectBounded(control(target), viewport);
                expect(await control(target).evaluate((node) => {
                    const box = node.getBoundingClientRect();
                    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
                    return Boolean(hit?.querySelector('button[aria-controls="learning-companion-panel"]'));
                })).toBe(true);
            }
            expect(await control(page).boundingBox()).toEqual(await control(source).boundingBox());
            await info.attach('main-search-companion-obstruction', { body: await source.screenshot(), contentType: 'image/png' });
            await info.attach('rust-search-companion-obstruction', { body: await page.screenshot(), contentType: 'image/png' });
            for (const target of [source, page]) {
                await control(target).focus();
                if (name === 'narrow') await control(target).press('Enter');
                await target.getByRole('textbox', { name: 'Search maps, places and topics' }).fill('orientation');
                await expectBounded(target.getByRole('button', { name: 'Orientation map World map', exact: true }), viewport);
                await target.getByRole('button', { name: 'Orientation map World map', exact: true }).click();
                await expect(target).toHaveURL(/world\?map=orientation-map$/);
            }
            await source.close();
        });

        test('bookmark commands retain source labels, failure state and authoritative add/remove results', async ({ page, context }, info) => {
            test.skip(!process.env.SOURCE_EVIDENCE_BASE_URL, 'Requires the whole pinned-source layout server.');
            const shell = await routeWorldReads(page);
            const source = await context.newPage();
            await source.addInitScript((props) => { window.sourceWorldEvidence = props; window.sourceWorldEvidenceUrl = '/world?map=orientation-map'; }, {
                ...sourceWorldProps(), name: shell.name, progress: { activities: {} },
            });
            const commands: string[][] = [[], []];
            const errors: string[][] = [[], []];
            for (const [index, target, pattern, original] of [
                [0, page, '**/api/v1/learner/maps/orientation-map/nodes/first-place/bookmark', false],
                [1, source, '**/learning/nodes/1/bookmark', true],
            ] as const) {
                target.on('pageerror', (error) => errors[index].push(error.message));
                await target.route(pattern, (route) => {
                    const method = route.request().method();
                    commands[index].push(method);
                    if (!original) expect(route.request().headers()['x-csrf-token']).toBe('fixture-csrf');
                    if (commands[index].length === 1) return route.fulfill({ status: 503, json: { message: 'Bookmark unavailable.' } });
                    const bookmarked = method === 'POST';
                    return route.fulfill({ json: original
                        ? { bookmarked, bookmarkedNodeIds: bookmarked ? [1] : [] }
                        : { bookmarked, bookmarked_nodes: bookmarked ? [{ map_slug: 'orientation-map', node_slug: 'first-place' }] : [] },
                    });
                });
            }
            await source.goto(`${process.env.SOURCE_EVIDENCE_BASE_URL}/e2e/canonical-learner-layout-source.html`);
            await page.goto('/world?map=orientation-map');
            const toggle = async (target: Page, label: string) => {
                const button = target.getByRole('button', { name: label, exact: true });
                if (name === 'narrow') {
                    // The pinned header covers this pointer target; retain the
                    // existing source-defect evidence and use keyboard input.
                    await button.focus(); await button.press('Enter');
                } else { await expectBounded(button, viewport); await button.click(); }
            };
            for (const target of [source, page]) {
                await target.getByRole('button', { name: 'First place', exact: true }).click();
                await toggle(target, 'Bookmark this tile');
            }
            await expect(page.getByRole('alert')).toHaveText('The bookmark could not be updated.');
            for (const target of [source, page]) {
                await expect(target.getByRole('button', { name: 'Bookmark this tile', exact: true })).toBeVisible();
                await toggle(target, 'Bookmark this tile');
                await expect(target.getByRole('button', { name: 'Remove bookmark', exact: true })).toBeVisible();
            }
            await expect(page.getByRole('alert')).toHaveCount(0);
            expect(await page.getByRole('button', { name: 'Remove bookmark', exact: true }).boundingBox())
                .toEqual(await source.getByRole('button', { name: 'Remove bookmark', exact: true }).boundingBox());
            await info.attach('main-world-bookmarked', { body: await source.screenshot(), contentType: 'image/png' });
            await info.attach('rust-world-bookmarked', { body: await page.screenshot(), contentType: 'image/png' });
            for (const target of [source, page]) {
                await toggle(target, 'Remove bookmark');
                await expect(target.getByRole('button', { name: 'Bookmark this tile', exact: true })).toBeVisible();
            }
            expect(commands).toEqual([['POST', 'POST', 'DELETE'], ['POST', 'POST', 'DELETE']]);
            // The pinned async callback does not catch rejection. Preserve its
            // state semantics and record the expected failure, not silent success.
            expect(errors[0]).toEqual(['The bookmark could not be updated.']);
            expect(errors[1]).toEqual(['Bookmark unavailable.']);
            await source.close();
        });

        test('completion includes non-start activities and preferred starts keep their identities', async ({ page }) => {
            const snapshot = worldSnapshot();
            await routeWorldReads(page, { world: (route) => route.fulfill({ json: snapshot }) });
            const graphNode = snapshot.graph.maps[0].nodes[0];
            graphNode.activities.push({ id: worldIds.nextActivity, slug: 'reflection', title: 'Reflect on orientation', activity_type: 'text', status: 'completed' });
            graphNode.start_activity_id = worldIds.nextActivity;
            graphNode.starts = [];
            snapshot.start_routes = [];
            await page.goto('/world');
            await page.getByRole('button', { name: 'First place' }).click();
            await expect(page.getByLabel('Node completed')).toBeVisible();
            await expectBounded(page.getByRole('button', { name: 'Start node', exact: true }), viewport);
            await page.getByRole('button', { name: 'Start node', exact: true }).click();
            expect(await page.evaluate(() => JSON.parse(localStorage.getItem('learning.activeActivity')!))).toMatchObject({
                activityId: worldIds.nextActivity,
                activityTitle: 'Reflect on orientation',
                playHref: `/learning/nodes/${worldIds.node}/play?activity=${worldIds.nextActivity}`,
            });
        });

        test('selected-place completion and fallback start match pinned source', async ({ page, context }, testInfo) => {
            test.skip(!process.env.SOURCE_EVIDENCE_BASE_URL, 'Requires the pinned-source Vite evidence server.');
            for (const path of ['resources/js/pages/world.tsx', 'resources/js/features/world/active-activity.ts',
                'resources/js/features/world/node-detail-drawer.tsx', 'resources/js/features/world/activity-panel.tsx']) {
                expect(readFileSync(new URL(`../../${path}`, import.meta.url))).toEqual(
                    execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:${path}`]),
                );
            }
            const snapshot = worldSnapshot();
            snapshot.graph.maps[0].nodes[0].activities[0].status = 'completed';
            snapshot.graph.maps[0].nodes[0].starts = [];
            snapshot.start_routes = [];
            await routeWorldReads(page, { world: (route) => route.fulfill({ json: snapshot }) });
            const source = await context.newPage();
            await source.addInitScript((props) => { window.sourceWorldEvidence = props; window.sourceWorldEvidenceUrl = '/world?map=orientation-map'; }, sourceWorldProps());
            await source.goto(`${process.env.SOURCE_EVIDENCE_BASE_URL}/e2e/canonical-learner-layout-source.html`);
            await page.goto('/world');
            for (const target of [source, page]) {
                await target.getByRole('button', { name: 'First place' }).click();
                await expect(target.getByLabel('Node completed')).toBeVisible();
                await expectBounded(target.getByRole('button', { name: 'Start node', exact: true }), viewport);
            }
            const drawer = (target: Page) => target.locator('aside').filter({ hasText: 'A source-derived learner place.' });
            expect(await drawer(page).innerText()).toBe(await drawer(source).innerText());
            await expect(async () => {
                expect(await drawer(page).boundingBox()).toEqual(await drawer(source).boundingBox());
            }).toPass({ timeout: 1500 });
            if (name === 'narrow') {
                await expectCoveredByLearnerHeader(page);
                await expectCoveredByLearnerHeader(source);
            }
            await testInfo.attach('main-world-place', { body: await source.screenshot(), contentType: 'image/png' });
            await testInfo.attach('rust-world-place', { body: await page.screenshot(), contentType: 'image/png' });
            await source.getByRole('button', { name: 'Start node', exact: true }).click();
            await expect(source).toHaveURL(/learning\/nodes\/1\/play\?activity=1/);
            expect(await source.evaluate(() => JSON.parse(localStorage.getItem('learning.activeActivity')!))).toMatchObject({
                activityId: 1, activityTitle: 'Orientation activity', playHref: '/learning/nodes/1/play?activity=1',
            });
            await source.close();
        });

        test('evaluated unlock drawer matches source while locked World selection remains unavailable', async ({ page, context }, info) => {
            test.skip(!process.env.SOURCE_EVIDENCE_BASE_URL, 'Requires the original-source evidence server.');
            const visual = {
                reveal: { isDiscoverable: false, isDiscovered: true },
                unlock: { isUnlockable: true, isUnlocked: false, isManuallyUnlocked: false, isItemUnlockable: true, isToolUnlockable: true, itemOwned: true, toolUsed: false,
                    requirements: { type: 'group', operator: 'and', satisfied: false, requirements: [
                        { type: 'tool_used', toolTitle: 'Source lens', satisfied: false },
                        { type: 'group', operator: 'or', satisfied: true, requirements: [
                            { type: 'node_completed', nodeTitle: 'First path', mapSlug: 'first-path', nodeSlug: 'first-place', satisfied: false },
                            { type: 'role_has', roleTitle: 'Learner', roleSlug: 'learner', satisfied: true },
                        ] },
                        { type: 'item_owned', itemTitle: 'Source key', satisfied: true },
                        { type: 'time_after', availableAt: '2099-01-01T00:00:00Z', satisfied: false },
                    ] },
                },
            };
            const snapshot = worldSnapshot();
            snapshot.world.maps[0].nodes[0].state = 'locked';
            snapshot.world.maps[0].nodes[0].visual_config = visual;
            const shell = await routeWorldReads(page, { world: (route) => route.fulfill({ json: snapshot }) });
            const source = await context.newPage();
            const props = { ...sourceWorldProps(), name: shell.name, progress: { activities: {} } };
            props.world.maps[0].nodes[0].state = 'locked';
            props.world.maps[0].nodes[0].visualConfig = visual;
            await source.addInitScript((props) => { window.sourceWorldEvidence = props; window.sourceWorldEvidenceUrl = '/world?map=orientation-map'; }, props);
            await source.goto(`${process.env.SOURCE_EVIDENCE_BASE_URL}/e2e/canonical-learner-layout-source.html`);
            await page.goto('/world?map=orientation-map');
            for (const target of [source, page]) {
                await target.getByRole('button', { name: 'First place', exact: true }).click();
                await expect(target.getByText('Locked for now', { exact: true })).toHaveCount(0);
            }
            await page.addInitScript((props) => { window.sourceWorldEvidence = props; }, props);
            await source.goto(`${process.env.SOURCE_EVIDENCE_BASE_URL}/e2e/canonical-availability-source.html?original`);
            await page.goto(`${process.env.AVAILABILITY_EVIDENCE_BASE_URL ?? 'http://localhost:8083'}/e2e/canonical-availability-source.html`);
            for (const target of [source, page]) {
                for (const text of ['Locked for now', 'Meet all of these', 'Meet one of these', 'Use Source lens here', 'Have the Learner role', 'Have Source key in your inventory']) {
                    await expect(target.getByText(text, { exact: true })).toBeVisible();
                }
                const prerequisite = target.getByRole('link', { name: 'Complete First path', exact: true });
                await expect(prerequisite).toHaveAttribute('href', '/world?map=first-path&focused=first-place');
                await expectBounded(prerequisite, viewport);
            }
            const selector = 'div.rounded-lg.border-dashed';
            expect(await page.locator(selector).innerText()).toBe(await source.locator(selector).innerText());
            expect(await page.locator(selector).boundingBox()).toEqual(await source.locator(selector).boundingBox());
            await info.attach('main-unlock-requirements', { body: await source.screenshot(), contentType: 'image/png' });
            await info.attach('rust-unlock-requirements', { body: await page.screenshot(), contentType: 'image/png' });
            await source.close();
        });

        test('incomplete identity contracts fail explicitly instead of manufacturing record IDs', async ({ page }) => {
            const snapshot = worldSnapshot();
            snapshot.graph.maps[0].nodes = [];
            await routeWorldReads(page, { world: (route) => route.fulfill({ json: snapshot }) });
            await page.goto('/world');
            await expect(page.getByText('World is unavailable.', { exact: true })).toBeVisible();
            await expect(page.getByRole('button', { name: 'First place' })).toHaveCount(0);
        });

        test('copied group pagination uses the Rust transport for relative source imports', async ({ page }) => {
            const legacyRequests: string[] = [];
            page.on('request', (request) => {
                if (new URL(request.url()).pathname.startsWith('/learning/groups')) {
                    legacyRequests.push(request.url());
                }
            });
            await routeWorldReads(page);
            await page.route('**/api/v1/learner/groups**', (route) => {
                const currentPage = Number(new URL(route.request().url()).searchParams.get('page') ?? 1);
                return route.fulfill({ json: {
                    groups: [groupFixture(currentPage)],
                    pagination: { current_page: currentPage, last_page: 2, per_page: 1, total: 2 },
                } });
            });
            await page.goto('/world');
            await page.getByRole('button', { name: 'Open groups' }).click();
            await expect(page.getByRole('heading', { name: 'Alpha Circle' })).toBeVisible();
            await expectBounded(page.getByRole('button', { name: 'Next items' }), viewport);
            await page.getByRole('button', { name: 'Next items' }).click();
            await expect(page.getByRole('heading', { name: 'Beta Circle' })).toBeVisible();
            await expect(page.getByRole('spinbutton', { name: 'Current page' })).toHaveValue('2');
            await expectBounded(page.getByPlaceholder('Message the group'), viewport);
            await page.getByRole('button', { name: 'Previous items' }).click();
            await expect(page.getByRole('heading', { name: 'Alpha Circle' })).toBeVisible();
            expect(legacyRequests).toEqual([]);
        });

        test('World bootstraps the authenticated source appearance without overwriting the preference', async ({ page }) => {
            await routeWorldReads(page);
            await page.addInitScript(() => {
                localStorage.setItem('theme-preference-unauthenticated', 'light');
            });
            await page.route('**/api/v1/me', (route) => route.fulfill({ json: { ...currentUser(), appearance: 'dark' } }));
            const preferenceWrites: string[] = [];
            page.on('request', (request) => {
                if (request.method() !== 'GET' && /appearance/.test(request.url())) preferenceWrites.push(request.url());
            });
            await page.goto('/world');
            await expect(page.getByRole('heading', { name: 'Orientation map' })).toBeVisible();
            await expect(page.locator('html')).toHaveClass(/dark/);
            await expect(page.locator('[data-world-appearance]')).toHaveAttribute('data-world-appearance', 'dark');
            expect(await page.evaluate(() => localStorage.getItem('appearance'))).toBe('dark');
            expect(await page.evaluate(() => window.__INITIAL_AUTHENTICATED__)).toBe(true);
            await page.reload();
            await expect(page.locator('[data-world-appearance]')).toHaveAttribute('data-world-appearance', 'dark');
            expect(preferenceWrites).toEqual([]);
        });

        test('World distinguishes contracted emptiness from failed dependencies and unexpected 404s', async ({ page }) => {
            for (const status of [401, 403, 503]) {
                await routeWorldReads(page);
                await page.route('**/api/v1/me', (route) => route.fulfill({ status, json: { code: 'failure' } }));
                await page.goto('/world');
                await expect(page.getByText('World is unavailable.', { exact: true })).toBeVisible();
                await expect(page.getByText(status === 401
                    ? 'Sign in is required before the learner World can be opened.'
                    : status === 403
                        ? 'The learner World is not available for this account.'
                        : 'The learner World projection is currently unavailable.', { exact: true })).toBeVisible();
                await expect(page.getByText('No learning world has been seeded yet.')).toHaveCount(0);
            }
            await routeWorldReads(page, { world: (route) => route.fulfill({ status: 404 }) });
            await page.goto('/world');
            await expect(page.getByText('World is unavailable.', { exact: true })).toBeVisible();
            await routeWorldReads(page, { world: (route) => route.fulfill({ status: 404, json: {
                code: 'not_found', title: 'The requested resource was not found.',
            } }) });
            await page.goto('/world');
            await expect(page.getByText('No learning world has been seeded yet.')).toBeVisible();
            expect(await page.evaluate(() => window.__INITIAL_AUTHENTICATED__)).toBe(true);
        });

        test('copied group commands preserve UUIDs, CSRF and server-owned message/help/vote state', async ({ page }) => {
            await routeWorldReads(page);
            let group = groupFixture(1);
            group.messages.push({
                id: '018f1f8c-4c2f-7b8a-9d0e-000000000023',
                body: 'Help me understand this connection.',
                can_resolve: true,
                created_at: '2026-11-20T09:00:00Z',
                is_help_request: true,
                resolved_at: null,
                resolved_by: null,
                user: group.members[1],
            });
            const commands: string[] = [];
            const legacyRequests: string[] = [];
            page.on('request', (request) => {
                if (new URL(request.url()).pathname.startsWith('/learning/groups')) legacyRequests.push(request.url());
            });
            await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ json: { token: 'fixture-csrf' } }));
            await page.route('**/api/v1/learner/groups**', async (route) => {
                const request = route.request();
                if (request.method() === 'GET') {
                    await route.fulfill({ json: {
                        groups: [group], pagination: { current_page: 1, last_page: 1, per_page: 1, total: 1 },
                    } });
                    return;
                }
                expect(request.headers()['x-csrf-token']).toBe('fixture-csrf');
                const path = new URL(request.url()).pathname;
                commands.push(path);
                if (path.endsWith('/messages')) {
                    expect(request.postDataJSON()).toEqual({ body: 'A question for the group.', is_help_request: true });
                    group.messages.push({
                        id: '018f1f8c-4c2f-7b8a-9d0e-000000000024',
                        body: request.postDataJSON().body,
                        can_resolve: false,
                        created_at: '2026-11-20T09:01:00Z',
                        is_help_request: true,
                        resolved_at: null,
                        resolved_by: null,
                        user: group.members[0],
                    });
                } else if (path.endsWith('/resolve')) {
                    group.messages[0] = { ...group.messages[0], can_resolve: false,
                        resolved_at: '2026-11-20T09:02:00Z', resolved_by: group.members[0] };
                } else {
                    group = { ...group, current_user_voted_for_admin_chat: true, admin_chat_vote_count: 1 };
                }
                await route.fulfill({ json: { group } });
            });
            await page.goto('/world');
            await page.getByRole('button', { name: 'Open groups' }).click();
            await expectBounded(page.getByRole('button', { name: 'Mark resolved' }), viewport);
            await page.getByRole('button', { name: 'Mark resolved' }).click();
            await expect(page.getByText('Help request resolved', { exact: true })).toBeVisible();
            await expect(page.getByText('Marked resolved by Learner.')).toBeVisible();
            await page.getByPlaceholder('Message the group').fill('A question for the group.');
            await page.getByRole('checkbox', { name: 'Ask the group for help' }).check();
            await expectBounded(page.getByRole('button', { name: 'Send message' }), viewport);
            await page.getByRole('button', { name: 'Send message' }).click();
            await expect(page.getByText('A question for the group.', { exact: true })).toBeVisible();
            await expect(page.getByPlaceholder('Message the group')).toHaveValue('');
            await expectBounded(page.getByRole('button', { name: 'Vote 0/2' }), viewport);
            await page.getByRole('button', { name: 'Vote 0/2' }).click();
            await expect(page.getByRole('button', { name: 'Voted', exact: true })).toBeDisabled();
            expect(commands).toEqual([
                `/api/v1/learner/groups/${group.id}/messages/${group.messages[0].id}/resolve`,
                `/api/v1/learner/groups/${group.id}/messages`,
                `/api/v1/learner/groups/${group.id}/admin-chat-vote`,
            ]);
            expect(legacyRequests).toEqual([]);
        });

        test('group failures retain the current page and unsent draft without claiming success', async ({ page }) => {
            await routeWorldReads(page);
            let commandStatus = 503;
            await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ json: { token: 'fixture-csrf' } }));
            await page.route('**/api/v1/learner/groups**', async (route) => {
                if (route.request().method() !== 'GET') {
                    return route.fulfill({ status: commandStatus, json: { code: 'unavailable' } });
                }
                if (new URL(route.request().url()).searchParams.get('page') === '2') {
                    return route.fulfill({ status: 503 });
                }
                return route.fulfill({ json: {
                    groups: [groupFixture(1)], pagination: { current_page: 1, last_page: 2, per_page: 1, total: 2 },
                } });
            });
            await page.goto('/world');
            await page.getByRole('button', { name: 'Open groups' }).click();
            await page.getByRole('button', { name: 'Next items' }).click();
            await expect(page.getByText('The group chats could not be loaded.')).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Alpha Circle' })).toBeVisible();
            await expect(page.getByRole('spinbutton', { name: 'Current page' })).toHaveValue('1');
            await page.getByPlaceholder('Message the group').fill('Keep this draft.');
            for (const status of [401, 403, 404, 503]) {
                commandStatus = status;
                const response = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/messages'));
                await page.getByRole('button', { name: 'Send message' }).click();
                expect((await response).status()).toBe(status);
                await expect(page.getByText('The message could not be sent.', { exact: true })).toBeVisible();
                await expect(page.getByPlaceholder('Message the group')).toHaveValue('Keep this draft.');
                await expect(page.getByText('No messages yet.')).toBeVisible();
            }
            await expectBounded(page.getByRole('button', { name: 'Send message' }), viewport);
        });

        test('group controls match pinned main before and after source pagination', async ({ page, context }, testInfo) => {
            test.skip(!process.env.SOURCE_EVIDENCE_BASE_URL, 'Requires the pinned-source Vite evidence server.');
            for (const path of [
                'resources/js/features/world/group-control.tsx',
                'resources/js/features/world/api.ts',
                'resources/js/features/world/map-control-theme.ts',
            ]) {
                expect(readFileSync(new URL(`../../${path}`, import.meta.url))).toEqual(
                    execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:${path}`]),
                );
            }
            const source = await context.newPage();
            const sourceGroup = (index: number) => ({
                id: index, name: index === 1 ? 'Alpha Circle' : 'Beta Circle', description: null,
                adminChatRequiredVotes: 2, adminChatVisible: false, adminChatVoteCount: 0,
                currentUserVotedForAdminChat: false, memberCount: 2, members: [], messages: [],
            });
            await source.addInitScript((props) => { window.sourceWorldEvidence = props; window.sourceWorldEvidenceUrl = '/world?map=orientation-map'; }, {
                ...sourceWorldProps(), groups: [sourceGroup(1)], groupsPagination: { currentPage: 1, lastPage: 2, perPage: 1, total: 2 },
            });
            await source.route('**/learning/groups?**', (route) => route.fulfill({ json: {
                groups: [sourceGroup(2)], pagination: { currentPage: 2, lastPage: 2, perPage: 1, total: 2 },
            } }));
            await routeWorldReads(page);
            await page.route('**/api/v1/learner/groups**', (route) => {
                const currentPage = Number(new URL(route.request().url()).searchParams.get('page') ?? 1);
                return route.fulfill({ json: { groups: [groupFixture(currentPage)],
                    pagination: { current_page: currentPage, last_page: 2, per_page: 1, total: 2 } } });
            });
            await source.goto(`${process.env.SOURCE_EVIDENCE_BASE_URL}/e2e/canonical-learner-layout-source.html`);
            await source.getByRole('button', { name: 'Open groups' }).click();
            await page.goto('/world');
            await page.getByRole('button', { name: 'Open groups' }).click();
            for (const phase of ['initial', 'next-page']) {
                if (phase === 'next-page') {
                    await source.getByRole('button', { name: 'Next items' }).click();
                    await page.getByRole('button', { name: 'Next items' }).click();
                    await expect(source.getByRole('heading', { name: 'Beta Circle' })).toBeVisible();
                    await expect(page.getByRole('heading', { name: 'Beta Circle' })).toBeVisible();
                }
                const panel = (target: Page) => target.getByRole('heading', { name: 'Group chats' }).locator('xpath=ancestor::section[1]');
                expect(await panel(page).innerText()).toBe(await panel(source).innerText());
                for (const [actual, expected] of [
                    [panel(page), panel(source)],
                    [page.getByPlaceholder('Message the group'), source.getByPlaceholder('Message the group')],
                    [page.getByRole('button', { name: 'Send message' }), source.getByRole('button', { name: 'Send message' })],
                    [page.getByRole('button', { name: 'Next items' }), source.getByRole('button', { name: 'Next items' })],
                ]) {
                    await expectBounded(actual, viewport);
                    expect(await actual.boundingBox()).toEqual(await expected.boundingBox());
                }
                await testInfo.attach(`main-${phase}`, { body: await panel(source).screenshot(), contentType: 'image/png' });
                await testInfo.attach(`rust-${phase}`, { body: await panel(page).screenshot(), contentType: 'image/png' });
            }
            await source.close();
        });
    });
}

function groupFixture(page: number): components['schemas']['LearnerGroup'] {
    return {
        id: `018f1f8c-4c2f-7b8a-9d0e-00000000000${page}`,
        name: page === 1 ? 'Alpha Circle' : 'Beta Circle',
        slug: page === 1 ? 'alpha-circle' : 'beta-circle',
        description: null,
        study_topic: null,
        admin_chat_required_votes: 2,
        admin_chat_visible: false,
        admin_chat_visible_until: null,
        admin_chat_vote_count: 0,
        current_user_voted_for_admin_chat: false,
        member_count: 2,
        members: [
            { id: '018f1f8c-4c2f-7b8a-9d0e-000000000011', name: 'Learner', email: 'learner@example.test' },
            { id: '018f1f8c-4c2f-7b8a-9d0e-000000000012', name: 'Peer', email: 'peer@example.test' },
        ],
        messages: [],
    };
}

test('the copied World page preserves loading, empty, permission, and API failure states', async ({ page }) => {
    let resolveWorld: (() => void) | undefined;
    const pendingWorld = new Promise<void>((resolve) => {
        resolveWorld = resolve;
    });
    await routeWorldReads(page, {
        world: async (route) => {
            await pendingWorld;
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(worldSnapshot()) });
        },
    });

    await page.goto('/world');
    await expect(page.locator('.animate-spin')).toBeVisible();
    resolveWorld?.();
    await expect(page.getByRole('heading', { name: 'Orientation map' })).toBeVisible();

    await routeWorldReads(page, {
        world: (route) => route.fulfill({ status: 404, json: { code: 'not_found', title: 'The requested resource was not found.' } }),
    });
    await page.goto('/world');
    await expect(page.getByText('No learning world has been seeded yet.')).toBeVisible();

    await routeWorldReads(page, {
        world: (route) => route.fulfill({ status: 403 }),
    });
    await page.goto('/world');
    await expect(page.getByText('World is unavailable.')).toBeVisible();
    await expect(page.getByText('The learner World is not available for this account.')).toBeVisible();

    await routeWorldReads(page, {
        world: (route) => route.fulfill({ status: 503 }),
    });
    await page.goto('/world');
    await expect(page.getByText('The learner World projection is currently unavailable.')).toBeVisible();
});

type RouteOptions = {
    world?: (route: Route) => Promise<void> | void;
};

async function routeWorldReads(page: Page, options: RouteOptions = {}) {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const shell = await mockWorldShell(page, { id: worldIds.map, slug: 'orientation-map', background_config: worldSnapshot().world.maps[0].background_config });
    await page.route('**/api/v1/learner/world', async (route) => {
        if (options.world) {
            await options.world(route);
            return;
        }
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(worldSnapshot()) });
    });
    await page.route('**/api/v1/learner/groups**', (route) => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
            groups: [],
            pagination: { current_page: 1, last_page: 1, per_page: 1, total: 0 },
        }),
    }));
    await page.route('**/api/v1/me', (route) => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(currentUser()),
    }));
    await page.route('**/api/v1/learner/platform-translations', (route) => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ locale: 'en', translations: {} }),
    }));
    await page.route('**/api/v1/learner/sound-preferences', (route) => route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ambience_volume: 100, effects_volume: 100, muted: false }),
    }));
    return shell;
}

function worldSnapshot(): components['schemas']['LearnerWorldSnapshot'] {
    return {
        world: {
            slug: 'learning-world',
            title: 'Learning world',
            description: 'A bounded learner map.',
            theme_config: {},
            maps: [{
                slug: 'orientation-map',
                title: 'Orientation map',
                description: 'Find your first place.',
                topic: { slug: 'orientation', title: 'Orientation' },
                background_config: { light: { pageBackground: '#e6fffb' }, dark: { pageBackground: '#07111f' } },
                grid_config: {},
                map_assets_locked: false,
                assets: [{
                    slug: 'first-place-asset',
                    title: 'First place asset',
                    description: '',
                    x: 50,
                    y: 50,
                    z: 1,
                    image_url: null,
                    text: 'First place',
                    width: 24,
                    opacity: 1,
                    locked: false,
                    visual_config: {},
                    interaction_config: {},
                    sound_config: {},
                    interaction_mode: 'focusable',
                }],
                nodes: [{
                    asset_slug: 'first-place-asset',
                    slug: 'first-place',
                    title: 'First place',
                    description: 'A source-derived learner place.',
                    q: 0,
                    r: 0,
                    state: 'available',
                    visual_config: {},
                }],
            }],
        },
        graph: {
            id: worldIds.world,
            maps: [{
                id: worldIds.map, slug: 'orientation-map',
                assets: [{ id: worldIds.asset, slug: 'first-place-asset' }],
                nodes: [{
                    id: worldIds.node, slug: 'first-place', start_activity_id: worldIds.activity,
                    activities: [{ id: worldIds.activity, slug: 'orientation-activity', title: 'Orientation activity', activity_type: 'text', status: null }],
                    starts: [{ id: worldIds.start, activity_id: worldIds.activity, current_activity_id: null, play_run_id: null }],
                }],
            }],
        },
        items: [],
        tools: [],
        bookmarked_nodes: [],
        activity_progress: [],
        route_progress: [],
        available_routes: [{
            node_slug: 'first-place',
            route_slug: 'orientation-route',
            title: 'Orientation route',
            description: 'A source-derived route.',
            activity_count: 1,
        }],
        start_routes: [{
            start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
            map_slug: 'orientation-map',
            node_slug: 'first-place',
            route_slug: 'orientation-route',
            activity_slug: 'orientation-activity',
            label: 'Begin orientation',
            description: 'Start only becomes available in the playback slice.',
            image_dark: null,
            image_light: null,
            button_color_dark: null,
            button_border_color_dark: null,
            button_color_light: null,
            button_border_color_light: null,
            learning_intent: 'retrieve',
            sort_order: 0,
            time_guide_minutes: null,
            desk: {
                current_activity_title: null,
                learning_areas: [],
                learning_intent: 'retrieve',
                time_guide_minutes: null,
                topic: { href: '/topics/orientation', slug: 'orientation', title: 'Orientation' },
            },
            progress: null,
        }],
    };
}

function currentUser() {
    return {
        appearance: 'light',
        avatar_url: null,
        can_view_media_paths: false,
        capabilities: [],
        email: 'learner@example.test',
        name: 'Learner',
        roles: ['learner'],
        settings_access: {},
        subject_id: 'f6b13b8b-2df8-4c5c-8b30-5d6dfecf8fa7',
        username: 'learner',
    };
}

async function expectBounded(
    locator: Locator,
    viewport: { width: number; height: number },
) {
    await expect(async () => {
        const box = await locator.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }).toPass({ timeout: 5000 });
}

// Independent source-shaped fixture: numeric Laravel identities and camelCase
// props, rather than the Rust adapter under test.
function sourceWorldProps() {
    const topic = { competenceHref: '/topics/orientation', href: '/topics/orientation', slug: 'orientation', title: 'Orientation' };
    return {
        auth: { user: { id: 1, name: 'Learner', email: 'learner@example.test' }, items: [], tools: [], canViewMediaPaths: false }, appearance: 'light',
        name: 'Wicked Learning', companion: null, feedbackPrompt: false,
        localization: { locale: 'en', translations: {} },
        soundPreferences: { ambienceVolume: 100, effectsVolume: 100, muted: false },
        groups: [], groupsPagination: { currentPage: 1, lastPage: 1, perPage: 1, total: 0 },
        bookmarkedNodeIds: [], progress: { activities: { 1: { status: 'completed' } } },
        world: {
            id: 1, slug: 'learning-world', title: 'Learning world', description: 'A bounded learner map.', themeConfig: {},
            maps: [{
                id: 1, slug: 'orientation-map', title: 'Orientation map', description: 'Find your first place.', topic,
                backgroundConfig: { light: { pageBackground: '#e6fffb' }, dark: { pageBackground: '#07111f' } },
                gridConfig: {}, mapAssetsLocked: false,
                mapAssets: [{ id: 1, nodeId: 1, imageUrl: null, text: 'First place', x: 50, y: 50, z: 1, width: 24,
                    opacity: 1, locked: false, focusable: true, interactionMode: 'focusable', interactionConfig: {}, visualConfig: {}, soundConfig: {} }],
                nodes: [{ id: 1, mapId: 1, mapSlug: 'orientation-map', mapTitle: 'Orientation map', topic,
                    slug: 'first-place', title: 'First place', description: 'A source-derived learner place.',
                    position: { q: 0, r: 0 }, state: 'available', visualConfig: {}, startActivityId: 1, startRoutes: [],
                    activities: [{ id: 1, slug: 'orientation-activity', title: 'Orientation activity', type: 'text' }] }],
            }],
        },
    };
}

async function expectCoveredByLearnerHeader(page: Page) {
    // Newly observed source defect, not a migration usability acceptance:
    // the whole pinned header covers this drawer control at 390px. Do not
    // force-click through it and pretend the source control is usable.
    const control = page.getByRole('button', { name: 'Bookmark this tile' });
    await expect(async () => {
        expect(await control.evaluate((node) => {
            const box = node.getBoundingClientRect();
            return Boolean(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
                ?.closest('[data-wl-id="learner.navigation.header"]'));
        })).toBe(true);
    }).toPass();
}

test('World projection keeps identities across ordering and scopes same-slug progress by UUID', () => {
    const snapshot = worldSnapshot();
    const alternateMap = structuredClone(snapshot.world.maps[0]);
    alternateMap.slug = 'another-map';
    snapshot.world.maps.push(alternateMap);
    const alternateGraph = structuredClone(snapshot.graph.maps[0]);
    alternateGraph.slug = alternateMap.slug;
    alternateGraph.id = '018f1f8c-4c2f-7b8a-9d0e-000000000102';
    alternateGraph.assets[0].id = '018f1f8c-4c2f-7b8a-9d0e-000000000103';
    alternateGraph.nodes[0].id = '018f1f8c-4c2f-7b8a-9d0e-000000000104';
    alternateGraph.nodes[0].activities[0].id = worldIds.nextActivity;
    alternateGraph.nodes[0].start_activity_id = worldIds.nextActivity;
    alternateGraph.nodes[0].starts = [];
    snapshot.graph.maps.push(alternateGraph);
    snapshot.graph.maps[0].nodes[0].activities[0].status = 'completed';
    // Two authored buttons for one activity must not duplicate that activity.
    const secondStartId = '018f1f8c-4c2f-7b8a-9d0e-000000000107';
    snapshot.start_routes.push({ ...snapshot.start_routes[0], start_id: secondStartId });
    snapshot.graph.maps[0].nodes[0].starts.push({ ...snapshot.graph.maps[0].nodes[0].starts[0], id: secondStartId });
    snapshot.bookmarked_nodes.push({ map_slug: 'orientation-map', node_slug: 'first-place' });
    const project = () => toWorldPageProps(snapshot, {
        groups: [], pagination: { current_page: 1, last_page: 1, per_page: 1, total: 0 },
    }, currentUser(), { locale: 'en', translations: {} }, { ambience_volume: 100, effects_volume: 100, muted: false });
    const before = project();
    expect(before.progress).toEqual({ activities: { [worldIds.activity]: { status: 'completed' } } });
    expect(before.bookmarkedNodeIds).toEqual([worldIds.node]);
    const beforeMaps = (before.world as { maps: unknown[] }).maps;
    expect(beforeMaps[0]).toMatchObject({ nodes: [{
        activities: [expect.objectContaining({ id: worldIds.activity })],
        startRoutes: [expect.objectContaining({ activityId: worldIds.activity }), expect.objectContaining({ activityId: worldIds.activity })],
    }] });
    snapshot.world.maps.reverse();
    snapshot.graph.maps.reverse();
    const after = project();
    expect(after.progress).toEqual(before.progress);
    expect(after.bookmarkedNodeIds).toEqual(before.bookmarkedNodeIds);
    expect((after.world as { maps: unknown[] }).maps).toEqual([...beforeMaps].reverse());
});


test('concealed World props preserve opaque identity and the source null description', () => {
    const snapshot = worldSnapshot();
    const node = snapshot.world.maps[0].nodes[0];
    Object.assign(node, { state: 'hidden', title: 'Undiscovered place', description: '', visual_config: { hideEmptySpace: true, reveal: { isDiscoverable: true, isDiscovered: false } } });
    Object.assign(snapshot.graph.maps[0].nodes[0], { activities: [], starts: [], start_activity_id: null });
    snapshot.start_routes = [];
    const props = toWorldPageProps(snapshot, { groups: [], pagination: { current_page: 1, last_page: 1, per_page: 1, total: 0 } },
        currentUser(), { locale: 'en', translations: {} }, { ambience_volume: 100, effects_volume: 100, muted: false });
    expect(props.world.maps[0].nodes[0]).toMatchObject({ id: worldIds.node, title: 'Undiscovered place', description: null,
        activities: [], startRoutes: [], startActivityId: null, visualConfig: node.visual_config });
});


function worldSearchPage(page: number, original: boolean, empty = false) {
    const common = Array.from({ length: 4 }, (_, index) => ({
        href: `/topics/topic-${index}`, id: `topic:018f1f8c-4c2f-7b8a-9d0e-00000000010${index}`, kind: 'topic', subtitle: 'Topic', title: `Topic ${index}`,
    }));
    const map = { href: '/world?map=orientation-map', id: `map:${worldIds.map}`, kind: 'map', subtitle: 'World map', title: 'Orientation map' };
    const node = { href: '/world?map=orientation-map&focused=first-place', id: `node:${worldIds.node}`, kind: 'node', subtitle: 'Orientation map', title: 'First place' };
    const results = original ? [
        ...common,
        { ...map, mapId: 1, mapSlug: 'orientation-map' },
        { ...node, mapId: 1, mapSlug: 'orientation-map', nodeId: 1, nodeSlug: 'first-place' },
    ] : [
        ...common.map((row) => ({ ...row, map_id: null, node_id: null, map_slug: null, node_slug: null })),
        { ...map, map_id: worldIds.map, map_slug: 'orientation-map', node_id: null, node_slug: null },
        { ...node, map_id: worldIds.map, map_slug: 'orientation-map', node_id: worldIds.node, node_slug: 'first-place' },
    ];
    return {
        pagination: original
            ? { currentPage: empty ? 1 : page, lastPage: empty ? 1 : 2, perPage: 5, total: empty ? 0 : 6 }
            : { current_page: empty ? 1 : page, last_page: empty ? 1 : 2, per_page: 5, total: empty ? 0 : 6 },
        results: empty ? [] : results.slice((page - 1) * 5, page * 5),
    };
}


function searchCompanionFixture(original: boolean) {
    const context = { actions: [], activity: null, map: null, node: null, route: null, surface: 'world', topic: null, world: null };
    return original ? {
        avatarColor: '#123456', avatarPositionX: 50, avatarPositionY: 50, avatarScale: 100, avatarUrl: null,
        configuration: { aiEnabled: false, mode: 'scripted', sourceScope: 'platform' },
        context: { ...context, playRunId: null, postAttemptAvailable: false },
        dialogue: null, displayName: 'Guide', enabled: true, message: 'Choose your own direction.',
    } : {
        avatar_color: '#123456', avatar_position_x: 50, avatar_position_y: 50, avatar_scale: 100, avatar_url: null,
        configuration: { ai_enabled: false, mode: 'scripted', source_scope: 'platform' },
        context: { ...context, play_run_id: null, post_attempt_available: false },
        dialogue: null, display_name: 'Guide', message: 'Choose your own direction.',
    };
}
