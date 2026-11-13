import { expect, test } from './authenticated';

test('a local administrator can save encrypted provider metadata and a reusable template', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
        !email || !password,
        'requires the disposable local administrator',
    );

    const suffix = Date.now();
    const providerLabel = `AI provider ${suffix}`;
    const templateName = `Activity reviewer ${suffix}`;
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);
    await page.goto('/settings?panel=admin-ai-integrations&ai=providers');
    await expect(
        page.getByRole('heading', { name: 'AI support' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByLabel('Label').fill(providerLabel);
    await page.getByLabel('API key').fill('local-test-key-1234');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(providerLabel, { exact: true })).toBeVisible();
    await expect(page.getByLabel(/Replace API key/)).toHaveValue('');

    await page.getByRole('button', { name: 'Agent templates' }).click();
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByLabel('Name').fill(templateName);
    await page.getByLabel('Purpose').selectOption('activity_review');
    await page
        .getByLabel('Provider credential')
        .selectOption({ label: providerLabel });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(templateName, { exact: true })).toBeVisible();

    const testPanel = page.locator('[data-wl-id="settings.ai.template-test"]');
    await expect(testPanel).toBeVisible();
    await expect(testPanel.getByLabel('Test prompt')).toBeEnabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await testPanel.scrollIntoViewIfNeeded();
    const testPanelBox = await testPanel.boundingBox();
    const testButtonBox = await testPanel
        .getByRole('button', { name: 'Send test' })
        .boundingBox();
    expect(testPanelBox).not.toBeNull();
    expect(testButtonBox).not.toBeNull();
    expect(testPanelBox!.x + testPanelBox!.width).toBeLessThanOrEqual(390);
    expect(testButtonBox!.x + testButtonBox!.width).toBeLessThanOrEqual(390);
    await testPanel
        .getByLabel('Test prompt')
        .fill('Check the saved template boundary.');
    await testPanel.getByRole('button', { name: 'Send test' }).click();
    await expect(testPanel.getByRole('alert')).toHaveText(
        'The template test could not be completed safely.',
    );

    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Provider keys' }).click();
    await page.getByText(providerLabel, { exact: true }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
});
