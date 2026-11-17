import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`unprojected public/auth routes remain explicit at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        let apiRequests = 0;
        await page.route('**/api/v1/**', (route) => { apiRequests += 1; return route.abort(); });

        for (const path of ['/info/not-configured', '/email/verify']) {
            await page.goto(path);
            await expect(page.getByRole('heading', { name: 'This page is not available yet' })).toBeVisible();
            await expect(page.getByText(`Requested path: ${path}`, { exact: false })).toBeVisible();
        }

        expect(apiRequests).toBe(0);
    });
}
