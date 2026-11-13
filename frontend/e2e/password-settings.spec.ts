import { expect, test, type Page } from '@playwright/test';

async function sessionCookieValue(page: Page): Promise<string> {
    const cookie = (await page.context().cookies()).find(
        ({ name }) => name === 'wicked_learning_session',
    );
    expect(cookie).toBeDefined();

    return cookie!.value;
}

test('a disposable local identity updates its password in the source-derived security form', async ({
    browser,
    page,
}) => {
    const email = process.env.E2E_PASSWORD_CHANGE_EMAIL;
    const currentPassword = process.env.E2E_PASSWORD_CHANGE_CURRENT_PASSWORD;
    const replacementPassword = process.env.E2E_PASSWORD_CHANGE_REPLACEMENT_PASSWORD;
    test.skip(
        !email || !currentPassword || !replacementPassword,
        'requires a disposable local identity and two supplied test passwords',
    );

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(currentPassword!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const otherBrowserSession = await browser.newContext();
    try {
        const otherPage = await otherBrowserSession.newPage();
        await otherPage.goto('/login');
        await otherPage.getByLabel('Email address').fill(email!);
        await otherPage.getByLabel('Password').fill(currentPassword!);
        await otherPage.getByRole('button', { name: 'Log in' }).click();
        await expect(otherPage).toHaveURL(/\/world$/);

        const sessionBeforePasswordChange = await sessionCookieValue(page);

        await page.goto('/settings?panel=personal&personal=security');
        await expect(page).toHaveURL(/\/confirm-password\?next=/);
        await page.getByLabel('Password').fill(currentPassword!);
        await page.getByRole('button', { name: 'Confirm password' }).click();
        await expect(page).toHaveURL(/\/settings\?panel=personal&personal=security$/);
        await expect(
            page.getByRole('heading', { name: 'Update password' }),
        ).toBeVisible();
        await page.getByLabel('Current password').fill(currentPassword!);
        await page.getByLabel('New password').fill(replacementPassword!);
        await page.getByLabel('Confirm password').fill(replacementPassword!);
        await page.getByRole('button', { name: 'Save password' }).click();
        await expect(page.getByRole('status')).toHaveText('Password updated.');
        await expect(sessionCookieValue(page)).resolves.not.toBe(sessionBeforePasswordChange);

        const replacedVerifierSession = await otherBrowserSession.request.get(
            '/api/v1/session',
        );
        expect(replacedVerifierSession.status()).toBe(200);
        await expect(replacedVerifierSession.json()).resolves.toEqual({
            authenticated: false,
            subject_id: null,
            two_factor_required: false,
        });
    } finally {
        await otherBrowserSession.close();
    }
});
