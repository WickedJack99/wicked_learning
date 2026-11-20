import { expect, test } from '@playwright/test';
import type { Locator, Page, Route } from '@playwright/test';
import type { components } from '../src/platform/api/schema';
import { toWorldPageProps } from '../src/platform/world-projection';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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
                    request.method() !== 'GET'
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

            await page.getByRole('button', { name: 'Bookmark this tile' }).click();
            await expect(
                page.getByText(
                    'This World action is not available until its Rust migration slice is activated.',
                ),
            ).toBeVisible();

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
            await source.addInitScript((props) => { window.sourceWorldEvidence = props; }, sourceWorldProps());
            await source.goto(`${process.env.SOURCE_EVIDENCE_BASE_URL}/e2e/canonical-world-source.html`);
            await page.goto('/world');
            for (const target of [source, page]) {
                await target.getByRole('button', { name: 'First place' }).click();
                await expect(target.getByLabel('Node completed')).toBeVisible();
                await expectBounded(target.getByRole('button', { name: 'Start node', exact: true }), viewport);
            }
            expect(await page.locator('aside').innerText()).toBe(await source.locator('aside').innerText());
            expect(await page.locator('aside').boundingBox()).toEqual(await source.locator('aside').boundingBox());
            await testInfo.attach('main-world-place', { body: await source.screenshot(), contentType: 'image/png' });
            await testInfo.attach('rust-world-place', { body: await page.screenshot(), contentType: 'image/png' });
            await source.getByRole('button', { name: 'Start node', exact: true }).click();
            await expect(source).toHaveURL(/learning\/nodes\/1\/play\?activity=1/);
            expect(await source.evaluate(() => JSON.parse(localStorage.getItem('learning.activeActivity')!))).toMatchObject({
                activityId: 1, activityTitle: 'Orientation activity', playHref: '/learning/nodes/1/play?activity=1',
            });
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
            await source.addInitScript((group) => { window.sourceGroupEvidence = [group]; }, sourceGroup(1));
            await source.route('**/learning/groups?**', (route) => route.fulfill({ json: {
                groups: [sourceGroup(2)], pagination: { currentPage: 2, lastPage: 2, perPage: 1, total: 2 },
            } }));
            await routeWorldReads(page);
            await page.route('**/api/v1/learner/groups**', (route) => {
                const currentPage = Number(new URL(route.request().url()).searchParams.get('page') ?? 1);
                return route.fulfill({ json: { groups: [groupFixture(currentPage)],
                    pagination: { current_page: currentPage, last_page: 2, per_page: 1, total: 2 } } });
            });
            await source.goto(`${process.env.SOURCE_EVIDENCE_BASE_URL}/e2e/canonical-world-groups-source.html`);
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
        auth: { user: { id: 1, name: 'Learner' } }, appearance: 'light',
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
