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

    const originalPresentationResponse = await page.request.get('/api/v1/admin/public-presentation');
    const originalLinksResponse = await page.request.get('/api/v1/admin/public-source-links');
    expect(originalPresentationResponse.ok()).toBeTruthy();
    expect(originalLinksResponse.ok()).toBeTruthy();
    const originalPresentation = await originalPresentationResponse.json();
    const originalLinks = await originalLinksResponse.json();

    try {
        await page.goto('/settings?panel=admin-presentation-localization&presentation=public');
        await expect(page.getByRole('heading', { name: 'Public presentation' })).toBeVisible();

        await page.getByRole('button', { name: 'Information pages' }).click();
        const informationSlug = `local-development-${Date.now()}`;
        await page.getByRole('button', { name: 'Add page' }).click();
        const informationPage = page
            .locator('[data-wl-id="settings.public-presentation.information-pages"] article')
            .last();
        await informationPage.getByLabel('Title').fill('Local development content');
        await informationPage.getByLabel('Slug').fill(informationSlug);
        await informationPage
            .getByLabel('Markdown body')
            .fill('# Edited locally\n\nThis is public development content.');
        const savedPage = page.waitForResponse((response) =>
            response.request().method() === 'PATCH' &&
            response.url().endsWith('/api/v1/admin/public-presentation'),
        );
        const saveChanges = page.getByRole('button', { name: 'Save changes' });
        await expect(saveChanges).toBeEnabled();
        await saveChanges.click();
        expect((await savedPage).ok()).toBeTruthy();

        const anonymous = await browser.newContext();
        const anonymousPage = await anonymous.newPage();
        await anonymousPage.goto(`/info/${informationSlug}`);
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
        const restoreStatus = await page.evaluate(async ({ csrfToken, links, presentation }) => {
            const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
            const presentationResponse = await fetch('/api/v1/admin/public-presentation', {
                body: JSON.stringify(presentation),
                credentials: 'same-origin',
                headers,
                method: 'PATCH',
            });
            const sourceResponse = await fetch('/api/v1/admin/public-source-links', {
                body: JSON.stringify(links),
                credentials: 'same-origin',
                headers,
                method: 'PATCH',
            });
            return { presentation: presentationResponse.status, source: sourceResponse.status };
        }, { csrfToken: token, links: originalLinks, presentation: originalPresentation });
        expect(restoreStatus.presentation).toBe(200);
        expect(restoreStatus.source).toBe(200);
    }
});
