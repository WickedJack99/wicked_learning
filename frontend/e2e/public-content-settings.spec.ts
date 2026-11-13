import { expect, test } from './authenticated';

test('a local administrator edits the source-adapted public information and source-link settings', async ({
    browser,
    page,
}) => {
    // This covers two anonymous browser projections and the mandatory restore
    // sequence on an intentionally resource-constrained local Compose stack.
    test.setTimeout(120_000);
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const originalPagesResponse = await page.request.get('/api/v1/admin/public-information-pages');
    const originalLinksResponse = await page.request.get('/api/v1/admin/public-source-links');
    expect(originalPagesResponse.ok()).toBeTruthy();
    expect(originalLinksResponse.ok()).toBeTruthy();
    const originalPages = await originalPagesResponse.json();
    const originalLinks = await originalLinksResponse.json();

    try {
        await page.goto('/settings?panel=admin-presentation-localization&presentation=public');
        await expect(page.getByRole('heading', { name: 'Public presentation' })).toBeVisible();

        await page.getByRole('button', { name: 'Information pages' }).click();
        const aboutMarkdown = page.getByLabel(/markdown$/).first();
        await aboutMarkdown.fill('# Edited locally\n\nThis is public development content.');
        const savedPage = page.waitForResponse((response) =>
            response.request().method() === 'PATCH' &&
            response.url().endsWith('/api/v1/admin/public-information-pages/about'),
        );
        await page.getByRole('button', { name: 'Save changes' }).click();
        expect((await savedPage).ok()).toBeTruthy();

        const anonymous = await browser.newContext();
        const anonymousPage = await anonymous.newPage();
        await anonymousPage.goto('/about');
        await expect(anonymousPage.getByText('This is public development content.')).toBeVisible();
        await anonymous.close();

        await page.getByRole('button', { name: 'Source links' }).click();
        await page.getByRole('button', { name: 'Add modified source' }).click();
        await page.getByLabel('Button label').nth(1).fill('Local modified source');
        await page.getByLabel('Source URL').fill('https://example.test/local-modified-source');
        const savedLinks = page.waitForResponse((response) =>
            response.request().method() === 'PATCH' &&
            response.url().endsWith('/api/v1/admin/public-source-links'),
        );
        await page.getByRole('button', { name: 'Save changes' }).click();
        expect((await savedLinks).ok()).toBeTruthy();

        const anonymousSource = await browser.newContext();
        const anonymousSourcePage = await anonymousSource.newPage();
        await anonymousSourcePage.goto('/source');
        await expect(anonymousSourcePage.getByRole('link', { name: 'Local modified source' })).toHaveAttribute(
            'href',
            'https://example.test/local-modified-source',
        );
        await anonymousSource.close();
    } finally {
        const csrf = await page.request.get('/api/v1/security/csrf');
        expect(csrf.ok()).toBeTruthy();
        const { token } = await csrf.json() as { token: string };
        const restoreStatus = await page.evaluate(async ({ csrfToken, links, pages }) => {
            const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
            const restoredPages = await Promise.all(pages.map(async (page: { body: string; slug: string }) => {
                const response = await fetch(`/api/v1/admin/public-information-pages/${page.slug}`, {
                    body: JSON.stringify({ body: page.body }),
                    credentials: 'same-origin',
                    headers,
                    method: 'PATCH',
                });
                return response.status;
            }));
            const sourceResponse = await fetch('/api/v1/admin/public-source-links', {
                body: JSON.stringify(links),
                credentials: 'same-origin',
                headers,
                method: 'PATCH',
            });
            return { pages: restoredPages, source: sourceResponse.status };
        }, { csrfToken: token, links: originalLinks, pages: originalPages });
        expect(restoreStatus.pages).toEqual(originalPages.map(() => 200));
        expect(restoreStatus.source).toBe(200);
    }
});
