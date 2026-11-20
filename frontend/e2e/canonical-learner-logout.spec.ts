import { expect, test } from '@playwright/test';
import { administratorStorageStatePath } from './session-state';

const evidence = process.env.JOURNAL_EVIDENCE_BASE_URL;
test.skip(!evidence, 'Requires the local shared learner evidence server.');
// Never retain credential-bearing request traces for this fresh session.
test.use({ trace: 'off' });

test('failed logout retains the page and retry revokes only the current native session', async ({ browser }) => {
    test.skip(!process.env.E2E_LAYOUT_LOGOUT_PASSWORD, 'Requires the local test account password through the test environment.');
    expect(new URL(evidence!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    const context = await browser.newContext({ baseURL: evidence, viewport: { width: 1440, height: 900 } });
    const other = await browser.newContext({ baseURL: evidence, storageState: administratorStorageStatePath });
    const original = await (await other.request.get('/api/v1/learner/shell')).json();
    try {
        const csrf = await context.request.get('/api/v1/security/csrf');
        const signedIn = await context.request.post('/api/v1/session/login', {
            headers: { Origin: new URL(evidence!).origin, 'X-CSRF-Token': (await csrf.json()).token },
            data: { email: 'e2e-admin@wicked-learning.local', password: process.env.E2E_LAYOUT_LOGOUT_PASSWORD },
        });
        expect(signedIn.status()).toBe(200);
        const page = await context.newPage();
        page.setDefaultTimeout(5_000);
        await page.goto('/world?map=first-path');
        await expect(page.locator('.platform-shell')).toBeVisible();
        const invitation = page.getByRole('complementary', { name: 'Platform feedback invitation' });
        // The original fixed header clips the fresh-session invitation's Close
        // control (full-layout parity coverage records it). A normal reload
        // consumes no second invitation and keeps this test about logout.
        if (await invitation.isVisible()) {
            await page.reload();
            await expect(invitation).toHaveCount(0);
        }
        await page.route('**/api/v1/session/logout', (route) => route.fulfill({ status: 503, json: { title: 'Unavailable' } }));
        await page.locator('[data-wl-id="learner.navigation.account-menu"]').click();
        await page.getByRole('menuitem', { name: 'Log out', exact: true }).click();
        await expect(page.getByRole('alert')).toHaveText('The session could not be ended. Please try again.');
        expect((await context.request.get('/api/v1/me')).status()).toBe(200);
        await expect(page.locator('.platform-shell')).toBeVisible();
        await page.unroute('**/api/v1/session/logout');
        await page.locator('[data-wl-id="learner.navigation.account-menu"]').click();
        await page.getByRole('menuitem', { name: 'Log out', exact: true }).click();
        await expect(page).toHaveURL(`${evidence}/`);
        await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
        expect((await context.request.get('/api/v1/me')).status()).toBe(401);
        expect((await other.request.get('/api/v1/me')).status()).toBe(200);
    } finally {
        if (original.menu_theme) {
            const csrf = await other.request.get('/api/v1/security/csrf');
            expect((await other.request.post('/api/v1/learner/map-location', {
                headers: { Origin: new URL(evidence!).origin, 'X-CSRF-Token': (await csrf.json()).token },
                data: { map: original.menu_theme.map_id },
            })).status()).toBe(200);
        }
        await context.close();
        await other.close();
    }
});
