import { expect, test } from './authenticated';

test('a local content administrator can use the source-derived topic structure workspace', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/admin/topics');
    await expect(page.getByRole('heading', { name: 'Topic structure' })).toBeVisible();
    await expect(page.locator('[data-wl-id="admin.topics"]')).toBeVisible();
    await expect(page.getByLabel('New area')).toBeVisible();
    await expect(page.getByLabel('Insert after')).toBeVisible();

    const firstArea = page.locator('[data-wl-id="admin.topics.area"]').first();
    await firstArea.getByText('Edit area details', { exact: true }).click();
    const title = firstArea.getByLabel('Area name');
    const description = firstArea.getByLabel('Short description');
    const originalTitle = await title.inputValue();
    const originalDescription = await description.inputValue();
    await title.fill(originalTitle);
    await description.fill(originalDescription);
    const save = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            /\/api\/v1\/admin\/topic-areas\/[0-9a-f-]+$/.test(response.url()),
    );
    await firstArea.getByRole('button', { name: 'Save area' }).click();
    expect((await save).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Topic structure' })).toBeVisible();

    await page.getByText('Add topic or subtopic', { exact: true }).first().click();
    const createButton = page.getByRole('button', { name: 'Create topic' }).first();
    const createForm = createButton.locator('xpath=ancestor::form');
    await expect(createForm.getByLabel('Topic title')).toBeVisible();
    await expect(createForm.getByLabel('Parent topic')).toBeVisible();
    await expect(createForm.getByLabel('Topic content (Markdown)')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(createButton).toBeVisible();
    const box = await createButton.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
});
