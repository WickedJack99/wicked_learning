import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { collaborationStorageStatePath } from './session-state';

test.skip(!process.env.JOURNAL_EVIDENCE_BASE_URL, 'Requires the shared learner evidence server.');
const evidence = process.env.JOURNAL_EVIDENCE_BASE_URL!;

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test.describe(`canonical feedback invitation ${viewport.width}`, () => {
        test.use({ viewport });
        test('rejected dismiss restores the copied prompt; success preserves local page state', async ({ page }) => {
            const path = 'resources/js/components/platform-feedback-prompt.tsx';
            expect(readFileSync(new URL(`../canonical-source/${path}`, import.meta.url))).toEqual(
                execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:${path}`]),
            );
            await page.addInitScript(() => { window.feedbackPromptEvidence = true; });
            let csrfUnavailable = false;
            await page.route('**/api/v1/security/csrf', (route) => csrfUnavailable
                ? route.fulfill({ status: 503, json: { title: 'Unavailable' } })
                : route.fulfill({ json: { token: 'native-csrf' } }));
            let fail = true;
            let writes = 0;
            await page.route('**/api/v1/learner/feedback-prompt-preference', (route) => {
                expect(route.request().method()).toBe('PATCH');
                expect(route.request().postDataJSON()).toEqual({ action: 'dismiss' });
                expect(route.request().headers()['x-csrf-token']).toBe('native-csrf');
                writes += 1;
                return fail ? route.fulfill({ status: 503, json: { title: 'Unavailable' } })
                    : route.fulfill({ json: { status: 'snoozed' } });
            });
            await page.goto(`${evidence}/e2e/canonical-feedback-prompt.html`);
            const prompt = page.getByLabel('Platform feedback invitation');
            await expect(prompt).toBeVisible();
            const box = await prompt.boundingBox();
            expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
            expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
            await page.evaluate(() => { window.unsavedEvidenceState = 'keep this draft'; });
            const rejected = page.waitForResponse((response) => response.url().includes('feedback-prompt-preference'));
            await page.getByRole('button', { name: 'Not now', exact: true }).click();
            expect((await rejected).status()).toBe(503);
            await expect(prompt).toBeVisible();
            await expect(page.getByRole('button', { name: 'Not now', exact: true })).toBeEnabled();
            csrfUnavailable = true;
            const failedToken = page.waitForResponse((response) => response.url().endsWith('/security/csrf'));
            await page.getByRole('button', { name: 'Not now', exact: true }).click();
            expect((await failedToken).status()).toBe(503);
            await expect(prompt).toBeVisible();
            await expect(page.getByRole('button', { name: 'Not now', exact: true })).toBeEnabled();
            csrfUnavailable = false;
            fail = false;
            const saved = page.waitForResponse((response) => response.url().includes('feedback-prompt-preference'));
            await page.getByRole('button', { name: 'Not now', exact: true }).click();
            expect((await saved).status()).toBe(200);
            await expect(prompt).toHaveCount(0);
            expect(await page.evaluate(() => window.unsavedEvidenceState)).toBe('keep this draft');
            expect(writes).toBe(2);
        });

        test('real Rust snooze and decline remain effective on the next server claim', async ({ browser }) => {
            const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081';
            const context = await browser.newContext({ viewport, baseURL: base, storageState: collaborationStorageStatePath('first') });
            const page = await context.newPage();
            const csrf = await context.request.get('/api/v1/security/csrf');
            expect(csrf.status()).toBe(200);
            const headers = { Origin: new URL(base).origin, 'X-CSRF-Token': (await csrf.json()).token };
            const preference = (action: string) => context.request.patch('/api/v1/learner/feedback-prompt-preference', { headers, data: { action } });
            const claim = async () => {
                const result = await context.request.post('/api/v1/learner/feedback-prompt/claim', { headers, data: { surface: 'world' } });
                expect(result.status()).toBe(200);
                return (await result.json()).show;
            };
            try {
                for (const [action, label, status] of [['dismiss', 'Not now', 'snoozed'], ['decline', 'Don’t ask again', 'declined']] as const) {
                    expect((await preference('enable')).status()).toBe(200);
                    const show = await claim();
                    expect(show).toBe(true);
                    await page.addInitScript((show) => { window.feedbackPromptEvidence = show; }, show);
                    await page.goto(`${evidence}/e2e/canonical-feedback-prompt.html`);
                    const write = page.waitForResponse((response) => response.url().includes('feedback-prompt-preference'));
                    await page.getByRole('button', { name: label, exact: true }).click();
                    const response = await write;
                    expect(response.status()).toBe(200);
                    expect((await response.json()).status).toBe(status);
                    await expect(page.getByLabel('Platform feedback invitation')).toHaveCount(0);
                    expect(await claim()).toBe(false);
                }
            } finally {
                expect((await preference('enable')).status()).toBe(200);
                await context.close();
            }
        });
    });
}
