import { expect, test } from '@playwright/test';

type Language = { code: string; is_enabled: boolean; name: string; native_name: string };
type Catalog = {
    activities: Record<string, Record<string, unknown>>;
    meta: { format: string; locale: string; source_updated_at?: string; version: number };
    platform: Record<string, string>;
};

test('a language administrator maintains a safe disabled translation catalog through the browser contract', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const csrfResponse = await page.request.get('/api/v1/security/csrf');
    expect(csrfResponse.ok()).toBeTruthy();
    const { token } = (await csrfResponse.json()) as { token: string };

    async function json(path: string, method: 'GET' | 'PATCH' | 'POST', body?: Record<string, unknown>) {
        return page.evaluate(async ({ body, method, path, token }) => {
            const response = await fetch(path, {
                body: body ? JSON.stringify(body) : undefined,
                credentials: 'same-origin',
                headers: body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': token } : undefined,
                method,
            });
            const text = await response.text();
            return {
                body: text ? JSON.parse(text) : null,
                status: response.status,
            };
        }, { body, method, path, token });
    }

    const languages = await json('/api/v1/admin/languages', 'GET');
    expect(languages.status).toBe(200);
    const existing = (languages.body as { languages: Language[] }).languages;
    const code = ['zz', 'xy', 'qx', 'zy', 'xx'].find((candidate) => !existing.some((language) => language.code === candidate));
    expect(code).toBeTruthy();

    const created = await json('/api/v1/admin/languages', 'POST', {
        code,
        name: 'Browser translation language',
        native_name: 'Browser translation language',
    });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ code, is_enabled: false });

    const updated = await json(`/api/v1/admin/languages/${code}`, 'PATCH', {
        name: 'Browser translation language revised',
        native_name: 'Browser translation language revised',
    });
    expect(updated.status).toBe(200);

    const english = await json('/api/v1/admin/localization/catalogs/english', 'GET');
    expect(english.status).toBe(200);
    const englishCatalog = (english.body as { catalog: Catalog }).catalog;
    expect(englishCatalog.meta.locale).toBe('en');
    expect(Object.keys(englishCatalog.platform).length).toBeGreaterThan(100);

    const localeExport = await json(`/api/v1/admin/languages/${code}/translation-catalog`, 'GET');
    expect(localeExport.status).toBe(200);
    const localeCatalog = (localeExport.body as { catalog: Catalog }).catalog;
    const [activityId] = Object.keys(englishCatalog.activities);
    expect(activityId).toBeTruthy();
    const catalog: Catalog = {
        activities: {
            [activityId!]: { ...englishCatalog.activities[activityId!], title: 'Browser translated activity' },
        },
        meta: {
            format: englishCatalog.meta.format,
            locale: code!,
            source_updated_at: localeCatalog.meta.source_updated_at,
            version: englishCatalog.meta.version,
        },
        platform: { 'common.cancel': 'Browser translated cancel' },
    };
    const imported = await page.evaluate(async ({ catalog, code, token }) => {
        const form = new FormData();
        form.append('catalog', new File([JSON.stringify(catalog)], `${code}.json`, { type: 'application/json' }));
        const response = await fetch(`/api/v1/admin/languages/${code}/translation-catalog/import`, {
            body: form,
            credentials: 'same-origin',
            headers: { 'X-CSRF-Token': token },
            method: 'POST',
        });
        return response.status;
    }, { catalog, code, token });
    expect(imported).toBe(200);

    const exported = await json(`/api/v1/admin/languages/${code}/translation-catalog`, 'GET');
    expect(exported.status).toBe(200);
    const saved = (exported.body as { catalog: Catalog }).catalog;
    expect(saved.platform['common.cancel']).toBe('Browser translated cancel');
    expect(saved.activities[activityId!]?.title).toBe('Browser translated activity');
});
