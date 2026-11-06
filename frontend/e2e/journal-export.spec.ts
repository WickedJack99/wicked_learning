import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('the Journal export downloads only the source-shaped Markdown document', async ({
    page,
}) => {
    const email = process.env.E2E_JOURNAL_EMAIL;
    const password = process.env.E2E_JOURNAL_PASSWORD;
    test.skip(!email || !password, 'requires a disposable local administrator');

    const title = `Exportable journal page ${Date.now()}`;
    const topic = 'Field studies';
    const markdown = 'A private observation retained in the exported page.';

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

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
    await page.getByLabel('Topic', { exact: true }).fill(topic);
    await page.getByPlaceholder('Write in Markdown...').fill(markdown);
    const savePage = page.waitForResponse(
        (response) =>
            /\/api\/v1\/learner\/journal\/pages\/[0-9a-f-]+$/.test(
                new URL(response.url()).pathname,
            ) && response.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await savePage).ok()).toBe(true);

    const exportResponse = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === '/api/v1/learner/journal/export',
    );
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Export' }).click();
    const response = await exportResponse;
    expect(response.headers()['content-type']).toContain('text/markdown');
    expect(response.headers()['cache-control']).toBe('no-store');
    expect(response.headers()['content-disposition']).toContain(
        'learning-journal.md',
    );
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('learning-journal.md');
    const filePath = await download.path();
    expect(filePath).not.toBeNull();
    const content = await readFile(filePath!, 'utf8');
    expect(content).toContain(`# ${title}\n\n_Category: ${topic}_\n\n${markdown}`);
    expect(content).not.toContain('Review request sent.');
});
