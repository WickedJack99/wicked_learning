import { expect, test, type Locator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { collaborationStorageStatePath } from './session-state';
import { toWorldPageProps } from '../src/platform/world-projection';

const evidence = process.env.JOURNAL_EVIDENCE_BASE_URL;
test.skip(!evidence, 'Requires the local shared learner evidence server.');

test('required shell and Companion failures do not consume the session invitation', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: evidence, storageState: collaborationStorageStatePath('first') });
    const page = await context.newPage();
    let claims = 0;
    page.on('request', (request) => { if (request.url().endsWith('/learner/feedback-prompt/claim')) claims++; });
    try {
        for (const path of ['/learner/shell', '/learner/companion?*']) {
            const pattern = `**/api/v1${path}`;
            await page.route(pattern, (route) => route.fulfill({ status: 503, json: { title: 'Dependency unavailable.' } }));
            await page.goto('/world?map=first-path');
            await expect(page.getByText('World is unavailable.', { exact: true })).toBeVisible();
            await expect(page.locator('.platform-shell')).toHaveCount(0);
            expect(claims).toBe(0);
            await page.unroute(pattern);
        }
        const shell = await (await context.request.get('/api/v1/learner/shell')).json();
        await page.route('**/api/v1/learner/shell', (route) => route.fulfill({
            json: { ...shell, public_presentation: { ...shell.public_presentation, learner_palette: null } },
        }));
        await page.goto('/world?map=first-path');
        await expect(page.getByText('World is unavailable.', { exact: true })).toBeVisible();
        expect(claims).toBe(0);
        await page.unroute('**/api/v1/learner/shell');
        await page.route('**/api/v1/learner/map-location', (route) => route.fulfill({ status: 503, json: { title: 'Location unavailable.' } }));
        await page.goto('/world?map=first-path');
        await expect(page.getByText('World is unavailable.', { exact: true })).toBeVisible();
        expect(claims).toBe(0);
    } finally { await context.close(); }
});

test('World restores the real preferred map and claims feedback only after its redirect', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: evidence, storageState: collaborationStorageStatePath('first') });
    const original = await (await context.request.get('/api/v1/learner/shell')).json();
    const world = await (await context.request.get('/api/v1/learner/world')).json();
    const alternate = world.graph.maps[1];
    expect(alternate, 'test seed needs two maps').toBeDefined();
    const csrf = await context.request.get('/api/v1/security/csrf');
    const headers = { Origin: new URL(evidence!).origin, 'X-CSRF-Token': (await csrf.json()).token };
    try {
        expect((await context.request.post('/api/v1/learner/map-location', { headers, data: { map: alternate.id } })).status()).toBe(200);
        const page = await context.newPage();
        let claims = 0;
        page.on('request', (request) => { if (request.url().endsWith('/learner/feedback-prompt/claim')) claims++; });
        await page.goto('/world?evidence=retained#orientation');
        await expect(page.locator('.platform-shell')).toBeVisible();
        const url = new URL(page.url());
        expect(url.searchParams.get('map')).toBe(alternate.slug);
        expect(url.searchParams.get('evidence')).toBe('retained');
        expect(url.hash).toBe('#orientation');
        expect(claims).toBe(1);
        await page.reload();
        await expect(page.locator('.platform-shell')).toBeVisible();
        expect(claims).toBe(2);
    } finally {
        if (original.menu_theme) expect((await context.request.post('/api/v1/learner/map-location', { headers, data: { map: original.menu_theme.map_id } })).status()).toBe(200);
        await context.close();
    }
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`whole learner layout opens real Rust World and shared controls at ${viewport.width}`, async ({ browser }, info) => {
        const context = await browser.newContext({ baseURL: evidence, viewport, storageState: collaborationStorageStatePath('first') });
        const page = await context.newPage();
        page.setDefaultTimeout(5_000);
        const shell = await context.request.get('/api/v1/learner/shell');
        expect(shell.status()).toBe(200);
        const shellBefore = await shell.json();
        const user = await (await context.request.get('/api/v1/me')).json();
        const world = await (await context.request.get('/api/v1/learner/world')).json();
        const map = world.graph.maps[0];
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        try {
            const start = performance.now();
            const invitation = page.waitForResponse((response) => response.url().endsWith('/learner/feedback-prompt/claim'));
            await page.goto(`/world?map=${map.slug}`);
            const header = page.locator('[data-wl-id="learner.navigation.header"]');
            await expect(header).toBeVisible();
            await bounded(header, viewport);
            await info.attach('layout-ready-measurement', { contentType: 'application/json', body: JSON.stringify({ duration_ms: Math.round(performance.now() - start) }) });
            await expect(page.getByRole('navigation', { name: 'Learner navigation' })).toBeVisible();
            await bounded(page.getByRole('button', { name: 'Journal', exact: true }), viewport);
            await expect(page.locator('.platform-shell')).toHaveCount(1);
            await info.attach('real-rust-layout', { body: await page.screenshot(), contentType: 'image/png' });
            if (process.env.LEARNER_LAYOUT_SOURCE_URL) {
                expect(execFileSync('git', ['diff', '--name-only', '32c3113a5bc688c9944c20942cdf40a6a5d57d7f', '--', 'resources/js', 'resources/css/app.css']).toString()).toBe('');
                const [currentShell, groups, translations, sound, companion] = await Promise.all([
                    context.request.get('/api/v1/learner/shell'),
                    context.request.get('/api/v1/learner/groups?page=1&per_page=1'),
                    context.request.get('/api/v1/learner/platform-translations'),
                    context.request.get('/api/v1/learner/sound-preferences'),
                    context.request.get(`/api/v1/learner/companion?surface=world&map_slug=${map.slug}`),
                ]);
                const shellDocument = await currentShell.json();
                const companionDocument = companion.status() === 204 ? null : await companion.json();
                const sourceProps = {
                    // World contract parity has its independent source fixture
                    // in canonical-world.spec.ts. Here the shell oracle below
                    // is independent of learner-shell-projection.ts.
                    ...toWorldPageProps(world, await groups.json(), user, await translations.json(), await sound.json()),
                    name: shellDocument.name,
                    auth: {
                        user: { id: user.subject_id, name: user.name, email: user.email, username: user.username, avatar: user.avatar_url },
                        canViewMediaPaths: user.can_view_media_paths,
                        items: shellDocument.items.map((item) => ({ ...sourceKeys(item), config: item.config })),
                        tools: shellDocument.tools.map((tool) => ({ ...sourceKeys(tool), config: tool.config })),
                    },
                    publicPresentation: {
                        branding: shellDocument.public_presentation.branding,
                        cursors: sourceKeys(shellDocument.public_presentation.cursors),
                        learnerPalette: sourceKeys(shellDocument.public_presentation.learner_palette),
                    },
                    journalTheme: sourceKeys(shellDocument.journal_theme),
                    menuTheme: shellDocument.menu_theme ? { mapId: shellDocument.menu_theme.map_id, mapSlug: shellDocument.menu_theme.map_slug, backgroundConfig: shellDocument.menu_theme.background_config } : null,
                    companion: companionDocument ? { ...sourceKeys(companionDocument), enabled: true, dialogue: companionDocument.dialogue } : null,
                    feedbackPrompt: (await (await invitation).json()).show,
                };
                const source = await context.newPage();
                await source.addInitScript(({ props, url }) => { window.sourceWorldEvidence = props; window.sourceWorldEvidenceUrl = url; }, { props: sourceProps, url: `/world?map=${map.slug}` });
                await source.goto(`${process.env.LEARNER_LAYOUT_SOURCE_URL}/e2e/canonical-learner-layout-source.html`);
                await expect(source.locator('[data-wl-id="learner.navigation.header"]')).toBeVisible();
                expect(await frameEvidence(page)).toEqual(await frameEvidence(source));
                await info.attach('pinned-main-layout', { body: await source.screenshot(), contentType: 'image/png' });
                await source.getByRole('button', { name: 'Open inventory', exact: true }).click();
                await page.getByRole('button', { name: 'Open inventory', exact: true }).click();
                expect(await overlayEvidence(page)).toEqual(await overlayEvidence(source));
                await info.attach('pinned-main-inventory', { body: await source.screenshot(), contentType: 'image/png' });
                await info.attach('rust-inventory', { body: await page.screenshot(), contentType: 'image/png' });
                await page.keyboard.press('Escape');
                await source.close();

                // Full-layout invitation placement differs from an isolated
                // component harness. Preserve and record the source defect.
                const invitationSource = await context.newPage();
                await invitationSource.addInitScript(({ props, url }) => { window.sourceWorldEvidence = props; window.sourceWorldEvidenceUrl = url; }, { props: { ...sourceProps, feedbackPrompt: true }, url: `/world?map=${map.slug}` });
                await invitationSource.goto(`${process.env.LEARNER_LAYOUT_SOURCE_URL}/e2e/canonical-learner-layout-source.html`);
                await page.route('**/api/v1/learner/feedback-prompt/claim', (route) => route.fulfill({ json: { show: true } }));
                await page.reload();
                const prompt = page.getByRole('complementary', { name: 'Platform feedback invitation' });
                const sourcePrompt = invitationSource.getByRole('complementary', { name: 'Platform feedback invitation' });
                await expect(prompt).toBeVisible();
                await expect(sourcePrompt).toBeVisible();
                await expect(async () => {
                    expect(await prompt.boundingBox()).toEqual(await sourcePrompt.boundingBox());
                }).toPass({ timeout: 1_500 });
                expect(await prompt.getByRole('button', { name: 'Close', exact: true }).boundingBox())
                    .toEqual(await sourcePrompt.getByRole('button', { name: 'Close', exact: true }).boundingBox());
                await info.attach('rust-invitation-layout', { body: await page.screenshot(), contentType: 'image/png' });
                await info.attach('pinned-main-invitation-layout', { body: await invitationSource.screenshot(), contentType: 'image/png' });
                await invitationSource.close();
                await page.unroute('**/api/v1/learner/feedback-prompt/claim');
                await page.reload();
                await expect(page.locator('.platform-shell')).toBeVisible();
            }
            await page.getByRole('button', { name: 'Open inventory', exact: true }).click();
            await expect(page.getByRole('dialog', { name: 'Items', exact: true })).toBeVisible();
            await bounded(page.getByRole('dialog', { name: 'Items', exact: true }), viewport);
            for (const item of shellBefore.items) await expect(page.getByRole('dialog').getByText(item.title, { exact: true })).toBeVisible();
            await page.keyboard.press('Escape');
            await page.getByRole('button', { name: 'Open tools', exact: true }).click();
            await expect(page.getByRole('dialog', { name: 'Select a tool' })).toBeVisible();
            await bounded(page.getByRole('dialog', { name: 'Select a tool' }), viewport);
            await page.keyboard.press('Escape');
            await page.getByRole('button', { name: 'Journal', exact: true }).click();
            await expect(page.getByLabel('Search journal pages')).toBeVisible();
            await bounded(page.getByLabel('Close journal'), viewport);
            await page.getByLabel('Close journal').click();
            await expect(page.getByRole('button', { name: 'Journal', exact: true })).toBeFocused();
            await page.locator('[data-wl-id="learner.navigation.account-menu"]').click();
            await expect(page.getByText(user.email, { exact: true })).toBeVisible();
            await expect(page.getByRole('menuitem', { name: 'Settings', exact: true })).toBeVisible();
            await page.keyboard.press('Escape');
            expect(pageErrors).toEqual([]);
        } finally {
            if (shellBefore.menu_theme) {
                const csrf = await context.request.get('/api/v1/security/csrf');
                expect((await context.request.post('/api/v1/learner/map-location', {
                    headers: { Origin: new URL(evidence!).origin, 'X-CSRF-Token': (await csrf.json()).token }, data: { map: shellBefore.menu_theme.map_id },
                })).status()).toBe(200);
            }
            await context.close();
        }
    });
}

function sourceKeys(value: unknown): any {
    if (Array.isArray(value)) return value.map(sourceKeys);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), sourceKeys(value)]));
}

async function frameEvidence(page: Page) {
    return page.locator('.platform-shell').evaluate((shell) => ({
        style: shell.getAttribute('style'),
        controls: [...shell.querySelectorAll('[data-wl-id^="learner.navigation"]')].map((node) => ({
            id: node.getAttribute('data-wl-id'), text: node.textContent,
            href: node.getAttribute('href'), label: node.getAttribute('aria-label'),
            box: { x: node.getBoundingClientRect().x, y: node.getBoundingClientRect().y, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height },
        })),
    }));
}

async function overlayEvidence(page: Page) {
    return page.getByRole('dialog', { name: 'Items', exact: true }).evaluate((node) => ({
        text: node.textContent,
        box: { x: node.getBoundingClientRect().x, y: node.getBoundingClientRect().y, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height },
    }));
}

async function bounded(locator: Locator, viewport: { width: number; height: number }) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}
