import { expect, test } from '@playwright/test';
import type { components } from '../src/platform/api/schema';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`World continuation retains real Rust identities at ${viewport.width}x${viewport.height}`, async ({ browser }, testInfo) => {
        const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081';
        const learner = await browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath('first') });
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        try {
            const readStarted = performance.now();
            const response = await learner.request.get('/api/v1/learner/world');
            const readDurationMs = performance.now() - readStarted;
            expect(response.status()).toBe(200);
            const snapshot: components['schemas']['LearnerWorldSnapshot'] = await response.json();
            await testInfo.attach('world-read-measurement', { contentType: 'application/json', body: JSON.stringify({
                duration_ms: Math.round(readDurationMs), bytes: (await response.body()).length,
                maps: snapshot.graph.maps.length,
                activities: snapshot.graph.maps.flatMap((map) => map.nodes).reduce((count, node) => count + node.activities.length, 0),
            }) });
            const start = snapshot.start_routes.find((candidate) => snapshot.world.maps.find((map) => map.slug === candidate.map_slug)
                ?.nodes.some((node) => node.slug === candidate.node_slug && node.state === 'available'));
            expect(start, 'local seed must contain a playable start').toBeDefined();
            const map = snapshot.graph.maps.find((map) => map.slug === start!.map_slug)!;
            const node = map.nodes.find((node) => node.slug === start!.node_slug)!;
            const identity = node.starts.find((identity) => identity.id === start!.start_id)!;
            const activity = node.activities.find((activity) => activity.id === identity.activity_id)!;
            const authorResponse = await admin.request.get(`/api/v1/admin/world-builder/nodes/${node.id}`);
            expect(authorResponse.status()).toBe(200);
            const authored = await authorResponse.json();
            expect(authored.activity_graph.activities).toEqual(expect.arrayContaining([
                expect.objectContaining({ id: activity.id, title: activity.title, slug: activity.slug }),
            ]));
            const publicResponse = await learner.request.get('/api/v1/public/world');
            expect(publicResponse.status()).toBe(200);
            expect(await publicResponse.json()).not.toHaveProperty('graph');
            expect(JSON.stringify(snapshot.graph)).not.toContain('activity_config');
            const page = await learner.newPage();
            await page.goto(`/world?map=${encodeURIComponent(map.slug)}&focused=${encodeURIComponent(node.slug)}`);
            const button = page.getByRole('button', { name: start!.label, exact: true });
            await expect(button).toBeVisible();
            await expect(async () => {
                const box = await button.boundingBox();
                expect(box!.x).toBeGreaterThanOrEqual(0);
                expect(box!.y).toBeGreaterThanOrEqual(0);
                expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
                expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
            }).toPass();
            await testInfo.attach('rust-world-identity', { body: await page.screenshot(), contentType: 'image/png' });
            await button.click();
            await expect(page).toHaveURL(new RegExp(`/learning/nodes/${node.id}/play`));
            expect(await page.evaluate(() => JSON.parse(localStorage.getItem('learning.activeActivity')!))).toMatchObject({
                activityId: activity.id, activityTitle: activity.title,
                playHref: `/learning/nodes/${node.id}/play?activity=${activity.id}&route=${start!.start_id}`,
            });
        } finally {
            await learner.close();
            await admin.close();
        }
    });
}
