import { expect, test } from '@playwright/test';

test('a local administrator can use the source-derived learning taxonomy workspace', async ({
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

    await page.goto('/settings?panel=admin-learning-support&support=taxonomy');
    await expect(
        page.getByRole('heading', { name: 'Competence Topics' }),
    ).toBeVisible();
    await expect(
        page.locator('[data-wl-id="admin.learning-taxonomy.competence-topics"]'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add topic' })).toBeVisible();

    const firstThreshold = page.getByLabel('Size threshold').first();
    const originalThreshold = await firstThreshold.inputValue();
    await firstThreshold.fill(String(Number(originalThreshold) + 0.1));
    const save = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().endsWith('/api/v1/admin/competence-topics'),
    );
    await page.getByRole('button', { name: 'Save topics' }).click();
    expect((await save).status()).toBe(204);

    await page.getByRole('button', { name: 'Concept Library' }).click();
    await expect(
        page.locator('[data-wl-id="admin.learning-taxonomy.learning-concepts"]'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add concept' })).toBeVisible();

    await page.goto(
        '/settings?panel=admin-learning-support&support=learning-concepts',
    );
    await expect(
        page.locator('[data-wl-id="admin.learning-taxonomy.learning-concepts"]'),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const saveConcepts = page.getByRole('button', { name: 'Save concepts' });
    await expect(saveConcepts).toBeVisible();
    const box = await saveConcepts.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
});
