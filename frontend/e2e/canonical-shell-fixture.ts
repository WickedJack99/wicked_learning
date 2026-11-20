import { expect, request, type Page } from '@playwright/test';
import type { components } from '../src/platform/api/schema';
import { collaborationStorageStatePath } from './session-state';

let shellFixture: Promise<components['schemas']['LearnerShell']> | undefined;

// These component-level World cases stub their own map and user. Reuse only
// the local deployment's real presentation/theme document for the newly
// mounted shared shell; full live layout tests cover unmocked inventory.
export async function mockWorldShell(page: Page, map: { id: string; slug: string; background_config: Record<string, unknown> }) {
    shellFixture ??= (async () => {
        const client = await request.newContext({
            baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
            storageState: collaborationStorageStatePath('first'),
        });
        try {
            const response = await client.get('/api/v1/learner/shell');
            expect(response.status()).toBe(200);
            return await response.json();
        } finally { await client.dispose(); }
    })();
    const shell = await shellFixture;
    const menu = { map_id: map.id, map_slug: map.slug, background_config: map.background_config };
    await page.route('**/api/v1/learner/shell', (route) => route.fulfill({ json: { ...shell, items: [], tools: [], menu_theme: menu } }));
    await page.route('**/api/v1/learner/companion?*', (route) => route.fulfill({ status: 204 }));
    await page.route('**/api/v1/security/csrf', (route) => route.fulfill({ json: { token: 'fixture-csrf' } }));
    await page.route('**/api/v1/learner/map-location', (route) => route.fulfill({ json: menu }));
    await page.route('**/api/v1/learner/feedback-prompt/claim', (route) => route.fulfill({ json: { show: false } }));
    return shell;
}
