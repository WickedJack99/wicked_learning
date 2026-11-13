import { expect, test } from './authenticated';

test('a local administrator saves a Journal visual through the source-adapted settings and learners receive its protected projection', async ({
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

    const policyResponse = await page.request.get(
        '/api/v1/admin/journal-feedback/policy',
    );
    expect(policyResponse.ok()).toBeTruthy();
    const originalPolicy = await policyResponse.json();

    await page.goto('/settings?panel=admin-learning-support&support=journal');
    await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();
    await page.getByRole('button', { name: 'Background' }).click();
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await expect(
        page.getByLabel('Light mode background image'),
    ).toBeVisible();

    const uploadResponse = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            response.url().endsWith('/api/v1/admin/media-assets'),
    );
    await page.locator('input[type="file"]').setInputFiles({
        buffer: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#0f766e"/></svg>',
        ),
        mimeType: 'image/svg+xml',
        name: 'journal-presentation.svg',
    });
    const uploaded = await uploadResponse;
    expect(uploaded.status()).toBe(201);
    const media = (await uploaded.json()) as {
        asset: { id: string; url: string };
    };
    await expect(page.getByLabel('Light mode background image')).toHaveValue(
        media.asset.url,
    );

    const saved = page.waitForResponse(
        (response) =>
            response.request().method() === 'PATCH' &&
            response.url().endsWith('/api/v1/admin/journal-feedback/policy'),
    );
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await saved).ok()).toBe(true);

    await expect
        .poll(async () => {
            const response = await page.request.get(
                '/api/v1/admin/media-assets?page=1&per_page=12',
            );
            const assets = (await response.json()) as {
                items: Array<{ id: string; reference_count: number }>;
            };
            return assets.items.find((asset) => asset.id === media.asset.id)
                ?.reference_count;
        })
        .toBe(1);

    await page.goto('/world');
    const learnerMedia = page.waitForResponse(
        (response) =>
            response.url().endsWith(
                `/api/v1/learner/media-assets/${media.asset.id}/content`,
            ),
    );
    await page.getByLabel('Journal').click();
    expect((await learnerMedia).status()).toBe(200);

    const csrf = await page.request.get('/api/v1/security/csrf');
    expect(csrf.ok()).toBeTruthy();
    const { token } = (await csrf.json()) as { token: string };
    const restoreStatus = await page.evaluate(
        async ({ policy, token: csrfToken }) => {
            const response = await fetch('/api/v1/admin/journal-feedback/policy', {
                body: JSON.stringify(policy),
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken,
                },
                method: 'PATCH',
            });
            return response.status;
        },
        { policy: originalPolicy, token },
    );
    expect(restoreStatus).toBe(200);

    await expect
        .poll(async () => {
            const response = await page.request.get(
                '/api/v1/admin/media-assets?page=1&per_page=12',
            );
            const assets = (await response.json()) as {
                items: Array<{ id: string; reference_count: number }>;
            };
            return assets.items.find((asset) => asset.id === media.asset.id)
                ?.reference_count;
        })
        .toBe(0);
    const removeStatus = await page.evaluate(
        async ({ assetId, token: csrfToken }) => {
            const response = await fetch(`/api/v1/admin/media-assets/${assetId}`, {
                credentials: 'same-origin',
                headers: { 'X-CSRF-Token': csrfToken },
                method: 'DELETE',
            });
            return response.status;
        },
        { assetId: media.asset.id, token },
    );
    expect(removeStatus).toBe(204);
});
