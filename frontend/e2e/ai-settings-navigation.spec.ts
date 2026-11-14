import { expect, test } from './authenticated';

test('AI settings retain the source Settings hierarchy on desktop and narrow layouts', async ({
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

    await page.goto('/settings?panel=admin-ai-integrations&ai=guardrails');
    const sections = page.getByRole('tablist', {
        name: 'AI settings sections',
    });
    await expect(sections).toBeVisible();
    await expect(
        sections.getByRole('tab', { name: 'Guardrails' }),
    ).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'Agent templates' }).click();
    await expect(page).toHaveURL(/ai=templates/);

    await page.setViewportSize({ height: 844, width: 390 });
    const mobileSections = page.getByLabel('AI settings section', {
        exact: true,
    });
    await expect(mobileSections).toHaveValue('templates');
    await mobileSections.selectOption('providers');
    await expect(page).toHaveURL(/ai=providers/);
    await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
});
