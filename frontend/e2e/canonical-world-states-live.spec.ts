import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`native World retains authored visible states and schedule precedence at ${viewport.width}`, async ({ browser, baseURL }, info) => {
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const learner = await browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath('first') });
        const headers = async (context) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
        const adminHeaders = await headers(admin);
        const learnerHeaders = await headers(learner);
        const shell = await (await learner.request.get('/api/v1/learner/shell')).json();
        const worldId = uuid((await (await learner.request.get('/api/v1/learner/world')).json()).graph.id);
        let mapId: string | undefined;
        try {
            const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `States ${randomUUID()}`, description: null, slug: null } });
            expect(created.status()).toBe(201);
            mapId = uuid((await created.json()).map_id);
            const states = ['active', 'available', 'completed', 'hinted', 'recommended'] as const;
            for (const [index, state] of [...states, 'scheduled'].entries()) {
                const node = await admin.request.post(`/api/v1/admin/world-builder/maps/${mapId}/nodes`, { headers: adminHeaders, data: {
                    title: `State ${state}`, description: 'Authored state does not imply learner progress.', position_q: index, position_r: 0,
                    state: state === 'scheduled' ? 'recommended' : state,
                    visual_config: state === 'scheduled' ? { schedule: { lockAt: '2000-01-01T00:00:00Z' } } : {},
                } });
                expect(node.status()).toBe(201);
            }
            // Publish and position only this disposable local fixture; these are
            // not acceptance evidence for the author publication workflow.
            localSql(`UPDATE learning_maps SET world_id = '${worldId}', published_at = NOW(), access_roles = '["public"]' WHERE id = '${mapId}'; UPDATE learning_nodes SET published_at = NOW() WHERE map_id = '${mapId}'; UPDATE learning_map_assets SET published_at = NOW(), position_x = 50, position_y = 50 WHERE map_id = '${mapId}'`);
            const started = performance.now();
            const response = await learner.request.get('/api/v1/learner/world');
            expect(response.status()).toBe(200);
            const snapshot = await response.json();
            info.annotations.push({ type: 'native-world-read', description: `${Math.round(performance.now() - started)} ms; ${Buffer.byteLength(JSON.stringify(snapshot))} bytes` });
            const graph = snapshot.graph.maps.find((map) => map.id === mapId);
            const map = snapshot.world.maps.find((map) => map.slug === graph.slug);
            for (const state of states) expect(map.nodes.find((node) => node.title === `State ${state}`).state).toBe(state);
            expect(map.nodes.find((node) => node.title === 'State scheduled').state).toBe('locked');
            const page = await learner.newPage();
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            for (const state of states) {
                const node = map.nodes.find((node) => node.title === `State ${state}`);
                await page.goto(`/world?map=${map.slug}&focused=${node.slug}`);
                await expect(page.getByRole('heading', { name: node.title, exact: true })).toBeVisible();
                await expect(page.getByLabel('Node completed')).toHaveCount(0);
                await expect(page.getByText('Locked for now', { exact: true })).toHaveCount(0);
                const drawer = page.locator('aside').filter({ has: page.getByRole('heading', { name: node.title, exact: true }) });
                await expect.poll(async () => Math.round((await drawer.boundingBox())!.x)).toBe(viewport.width === 1440 ? 1020 : 0);
                const box = (await drawer.boundingBox())!;
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
                expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
                await info.attach(`native-${state}-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' });
            }
            const scheduled = map.nodes.find((node) => node.title === 'State scheduled');
            await page.goto(`/world?map=${map.slug}&focused=${scheduled.slug}`);
            await expect(page.getByRole('heading', { name: map.title, exact: true })).toBeVisible();
            await expect(page.getByRole('heading', { name: scheduled.title, exact: true })).toHaveCount(0);
            expect(errors).toEqual([]);
        } finally {
            if (shell.menu_theme) expect((await learner.request.post('/api/v1/learner/map-location', { headers: learnerHeaders, data: { map: shell.menu_theme.map_id } })).status()).toBe(200);
            if (mapId) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${mapId}`, { headers: adminHeaders })).status()).toBe(204);
            await admin.close(); await learner.close();
        }
    });
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function localSql(sql: string) { execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input: sql, stdio: ['pipe', 'pipe', 'pipe'] }); }
