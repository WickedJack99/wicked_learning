import { expect, test } from './authenticated';

type Language = {
    code: string;
    is_default: boolean;
    is_enabled: boolean;
    name: string;
    native_name: string;
    updated_at: string;
};

test('the source-derived language workspace manages catalog activation', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    const updatedAt = '2026-11-13T12:00:00.000Z';
    const languages: Language[] = [{
        code: 'en',
        is_default: true,
        is_enabled: true,
        name: 'English',
        native_name: 'English',
        updated_at: updatedAt,
    }];
    let imported = false;

    await page.route('**/api/v1/admin/languages**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname.endsWith('/translation-catalog/import')) {
            imported = true;
            await route.fulfill({ status: 200 });
            return;
        }
        if (url.pathname.endsWith('/translation-catalog')) {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ catalog: { translations: {} } }),
            });
            return;
        }
        if (request.method() === 'GET') {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ languages }),
            });
            return;
        }
        if (request.method() === 'POST') {
            const requestBody = request.postDataJSON() as Pick<Language, 'code' | 'name' | 'native_name'>;
            const language: Language = {
                ...requestBody,
                is_default: false,
                is_enabled: false,
                updated_at: updatedAt,
            };
            languages.push(language);
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(language) });
            return;
        }
        if (request.method() === 'PATCH') {
            const requestBody = request.postDataJSON() as Pick<Language, 'is_enabled' | 'name' | 'native_name'>;
            const code = url.pathname.split('/').at(-1)!;
            const language = languages.find((candidate) => candidate.code === code)!;
            Object.assign(language, requestBody);
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(language) });
            return;
        }
        await route.fallback();
    });

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-presentation-localization&presentation=languages');
    await expect(page.getByRole('heading', { name: 'Language administration' })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'English English · en' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Add language' }).click();
    await page.getByLabel('Language code').fill('de');
    await page.getByLabel('Language name').first().fill('German');
    await page.getByLabel('Native name').first().fill('Deutsch');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'German' })).toBeVisible();
    const activation = page.getByRole('checkbox', { name: 'Enabled for learners' });
    await expect(activation).not.toBeChecked();
    await activation.check();

    await page.getByLabel('Language name').last().fill('German (catalog)');
    await page.getByRole('button', { name: 'Save language' }).click();
    await expect(page.getByRole('heading', { name: 'German (catalog)' })).toBeVisible();
    await expect(activation).toBeChecked();

    await page.locator('input[type="file"]').setInputFiles({
        buffer: Buffer.from('{"translations":{}}'),
        mimeType: 'application/json',
        name: 'german.json',
    });
    await expect.poll(() => imported).toBe(true);

    const desktopEditor = page.locator('[data-wl-id="settings.administration.languages.editor"]');
    await expectInsideViewport(page, desktopEditor);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectInsideViewport(page, page.getByRole('button', { name: 'German (catalog)' }));
    await expectInsideViewport(page, page.getByRole('button', { name: 'Upload translation catalog' }));
});

test('an enabled locale reaches the actual learner language selector', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-presentation-localization&presentation=languages');
    await expect(
        page.getByRole('button', { name: 'English English · en' }),
    ).toBeVisible();
    const languageList = page.locator('[data-wl-id="settings.administration.languages.list"]');
    const testLanguage = languageList.getByRole('button').filter({ hasText: 'zz' });
    const activation = page.getByRole('checkbox', { name: 'Enabled for learners' });
    if (await testLanguage.count() === 0) {
        await page.getByRole('button', { name: 'Add language' }).click();
        await page.getByLabel('Language code').fill('zz');
        await page.getByLabel('Language name').first().fill('Browser translation language');
        await page.getByLabel('Native name').first().fill('Browser translation language');
        await page.getByRole('button', { name: 'Create', exact: true }).click();
    } else {
        await testLanguage.click();
    }

    await expect(activation).toBeVisible();
    const storedLanguages = await page.evaluate(async () => {
        const response = await fetch('/api/v1/admin/languages');
        return response.json() as Promise<{ languages: Language[] }>;
    });
    const storedLanguage = storedLanguages.languages.find((language) => language.code === 'zz');
    expect(storedLanguage).toBeDefined();
    await expect(activation).toHaveAttribute(
        'aria-checked',
        String(storedLanguage!.is_enabled),
    );
    if (!storedLanguage!.is_enabled) {
        await activation.click();
        await expect(activation).toBeChecked();
        const initiallyEnabledResponse = page.waitForResponse((response) =>
            response.request().method() === 'PATCH'
            && response.url().endsWith('/api/v1/admin/languages/zz'),
        );
        await page.getByRole('button', { name: 'Save language' }).click();
        expect((await initiallyEnabledResponse).status()).toBe(200);
    }
    await activation.click();
    await expect(activation).not.toBeChecked();
    await page.getByLabel('Language name').last().fill('Browser translation language');
    await page.getByLabel('Native name').last().fill('Browser translation language');
    const disableResponse = page.waitForResponse((response) =>
        response.request().method() === 'PATCH'
        && response.url().endsWith('/api/v1/admin/languages/zz'),
    );
    await page.getByRole('button', { name: 'Save language' }).click();
    expect((await disableResponse).status()).toBe(200);
    await expect(activation).not.toBeChecked();

    await page.goto('/settings?panel=personal&personal=language');
    await expect(page.locator('#language option[value="zz"]')).toHaveCount(0);

    await page.goto('/settings?panel=admin-presentation-localization&presentation=languages');
    const languageToEnable = languageList.getByRole('button').filter({ hasText: 'zz' });
    await languageToEnable.click();
    await activation.click();
    await expect(activation).toBeChecked();
    const enableResponse = page.waitForResponse((response) =>
        response.request().method() === 'PATCH'
        && response.url().endsWith('/api/v1/admin/languages/zz'),
    );
    await page.getByRole('button', { name: 'Save language' }).click();
    expect((await enableResponse).status()).toBe(200);
    await expect(activation).toBeChecked();

    await page.goto('/settings?panel=personal&personal=language');
    await expect(page.locator('#language option[value="zz"]')).toHaveText(
        'Browser translation language (Browser translation language)',
    );
});

async function expectInsideViewport(
    page: import('@playwright/test').Page,
    locator: import('@playwright/test').Locator,
): Promise<void> {
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('the test browser has no viewport');
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
}
