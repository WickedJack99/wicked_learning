import { expect, test } from '@playwright/test';
import type { Locator, Page, Route } from '@playwright/test';

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
            await expect(page.getByText('Requested path: /learning/nodes/1/play')).toBeVisible();
            expect(worldWrites).toBe(0);
        });
    });
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
        world: (route) => route.fulfill({ status: 404 }),
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

function worldSnapshot() {
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
    const box = await locator.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}
