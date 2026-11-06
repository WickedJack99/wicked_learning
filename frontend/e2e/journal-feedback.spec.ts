import { expect, test } from '@playwright/test';

test('an explicit journal review request stays owner-scoped through one staff response', async ({
    page,
}) => {
    const email = process.env.E2E_JOURNAL_EMAIL;
    const password = process.env.E2E_JOURNAL_PASSWORD;
    test.skip(!email || !password, 'requires a disposable local administrator');

    const title = `Reviewable journal page ${Date.now()}`;
    const markdown = 'I would value another perspective on this private page.';
    const responseText = 'This is a source-shaped, informational review.';

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto(
        '/settings?panel=admin-learning-support&support=feedback-requests',
    );
    await expect(
        page.getByRole('heading', { name: 'Feedback requests' }),
    ).toBeVisible();
    const policy = page.getByLabel('Allow journal review requests');
    if (!(await policy.isChecked())) {
        const policySave = page.waitForResponse(
            (response) =>
                response.url().endsWith('/api/v1/admin/journal-feedback/policy') &&
                response.request().method() === 'PATCH',
        );
        await policy.check();
        expect((await policySave).ok()).toBe(true);
    }

    await page.goto('/world');
    await page.getByLabel('Journal').click();
    await expect(page.locator('#learning-journal-panel')).toBeVisible();
    const createPage = page.waitForResponse(
        (response) =>
            response.url().endsWith('/api/v1/learner/journal/pages') &&
            response.request().method() === 'POST',
    );
    await page.getByLabel('Add journal page').click();
    expect((await createPage).ok()).toBe(true);
    await page.getByLabel('Title').fill(title);
    await page
        .getByPlaceholder('Write in Markdown...')
        .fill(markdown);
    const savePage = page.waitForResponse(
        (response) =>
            /\/api\/v1\/learner\/journal\/pages\/[0-9a-f-]+$/.test(
                new URL(response.url()).pathname,
            ) && response.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await savePage).ok()).toBe(true);
    const requestReview = page.waitForResponse(
        (response) =>
            /\/api\/v1\/learner\/journal\/pages\/[0-9a-f-]+\/feedback-request$/.test(
                new URL(response.url()).pathname,
            ) && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Request review' }).click();
    expect((await requestReview).ok()).toBe(true);
    await expect(page.getByText('Review request sent.')).toBeVisible();

    await page.goto(
        '/settings?panel=admin-learning-support&support=feedback-requests',
    );
    await expect(page.getByText(title).first()).toBeVisible();
    await page.getByText(title).first().click();
    await page.getByRole('textbox', { name: 'Feedback' }).fill(responseText);
    const reply = page.waitForResponse(
        (response) =>
            /\/api\/v1\/admin\/journal-feedback\/[0-9a-f-]+\/respond$/.test(
                new URL(response.url()).pathname,
            ) && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Send' }).click();
    expect((await reply).status()).toBe(204);
    await expect(
        page.getByRole('button', { name: 'Responded', exact: true }),
    ).toBeVisible();

    await page.goto('/world');
    await page.getByLabel('Journal').click();
    await page.getByText(title).first().click();
    await expect(page.getByText(responseText)).toBeVisible();
});
