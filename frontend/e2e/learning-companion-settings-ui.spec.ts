import { expect, test } from './authenticated';

test.setTimeout(90_000);

test('a local administrator can use the source-adapted Learning Companion settings and dialogue workspace', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
        !email || !password,
        'requires the disposable local administrator',
    );

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const originalResponse = await page.request.get(
        '/api/v1/admin/learning-companion',
    );
    expect(originalResponse.ok()).toBeTruthy();
    const original = await originalResponse.json();
    const csrf = await page.request.get('/api/v1/security/csrf');
    const { token } = (await csrf.json()) as { token: string };
    const headers = {
        Origin: new URL(page.url()).origin,
        'X-CSRF-Token': token,
    };

    try {
        await page.goto('/settings?panel=admin-learning-companion');
        await expect(
            page.getByRole('heading', { name: 'Learning Companion' }),
        ).toBeVisible();
        await expect(
            page
                .getByRole('tablist', { name: 'Learning Companion sections' })
                .getByRole('tab', { name: 'Identity' }),
        ).toHaveAttribute('aria-selected', 'true');
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(
            page.getByLabel('Learning Companion section', { exact: true }),
        ).toHaveValue('identity');
        await page.setViewportSize({ width: 1280, height: 900 });
        await page
            .getByLabel('Display name')
            .fill(`Browser companion ${Date.now()}`);
        await page.getByRole('button', { name: 'Save changes' }).click();
        await expect(
            page.getByRole('button', { name: 'Save changes' }),
        ).toBeEnabled();

        await page.getByRole('tab', { name: 'Dialogues' }).click();
        await expect(
            page.getByRole('heading', { name: 'Dialogues' }),
        ).toBeVisible();
        const createdResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                response
                    .url()
                    .includes('/api/v1/admin/learning-companion/dialogues'),
        );
        await page.getByRole('button', { name: 'New graph' }).click();
        const created = await createdResponse;
        expect(created.ok()).toBeTruthy();
        const dialogue = (await created.json()) as { id: string };
        await expect(
            page.getByRole('heading', { name: 'Graph editor' }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Save graph' }).click();
        await expect(
            page.getByRole('heading', { name: 'Graph editor' }),
        ).toBeHidden();

        await page.getByRole('button', { name: 'Assign pages' }).click();
        await expect(
            page.getByRole('heading', { name: 'Assign authored pages' }),
        ).toBeVisible();
        const assignment = page.locator('input[type="checkbox"]').first();
        await expect(assignment).toBeVisible();
        await assignment.check();
        await page.getByRole('button', { name: 'Save assignments' }).click();
        await expect(
            page.getByRole('heading', { name: 'Assign authored pages' }),
        ).toBeHidden();

        const deletedResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'DELETE' &&
                response
                    .url()
                    .endsWith(
                        `/api/v1/admin/learning-companion/dialogues/${dialogue.id}`,
                    ),
        );
        page.once('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: 'Delete graph' }).click();
        expect((await deletedResponse).ok()).toBeTruthy();

        const deleted = await page.request.get(
            `/api/v1/admin/learning-companion/dialogues/${dialogue.id}`,
        );
        expect(deleted.status()).toBe(404);
    } finally {
        const replacement = { ...original };
        delete replacement.ai_template_options;
        await page.request.patch('/api/v1/admin/learning-companion', {
            data: replacement,
            headers,
        });
    }
});
