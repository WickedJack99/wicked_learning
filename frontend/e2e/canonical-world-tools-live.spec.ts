import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`copied World uses owned tools through Rust and refreshes without losing local state at ${viewport.width}`, async ({ browser, baseURL }, info) => {
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owner = await browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath('first') });
        const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
        const headers = async (context) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
        const adminHeaders = await headers(admin);
        const ownerHeaders = await headers(owner);
        const peerHeaders = await headers(peer);
        const shell = await (await owner.request.get('/api/v1/learner/shell')).json();
        const worldId = uuid((await (await owner.request.get('/api/v1/learner/world')).json()).graph.id);
        let mapId: string | undefined;
        let toolId: string | undefined;
        let wrongToolId: string | undefined;
        try {
            const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Availability ${randomUUID()}`, description: null, slug: null } });
            expect(created.status()).toBe(201);
            mapId = uuid((await created.json()).map_id);
            const tool = await admin.request.post('/api/v1/admin/assets/tools', { headers: adminHeaders, data: { title: `Lens ${randomUUID()}`, slug: null, description: null, image_dark: null, image_light: null, animation_dark: null, animation_light: null, image_width_percent: 18 } });
            expect(tool.status()).toBe(201);
            const catalog = (await tool.json()).tool;
            toolId = uuid(catalog.id);
            const wrongCreated = await admin.request.post('/api/v1/admin/assets/tools', { headers: adminHeaders, data: { title: `Wrong lens ${randomUUID()}`, slug: null, description: null, image_dark: null, image_light: null, animation_dark: null, animation_light: null, image_width_percent: 18 } });
            expect(wrongCreated.status()).toBe(201);
            const wrong = (await wrongCreated.json()).tool;
            wrongToolId = uuid(wrong.id);
            const subject = uuid((await (await owner.request.get('/api/v1/me')).json()).subject_id);
            // Only this newly-created local catalog entry is granted. Playback
            // grant UI is outside this read-contract acceptance test.
            localSql(`INSERT INTO learner_tools (principal_id, tool_id) SELECT id, '${toolId}' FROM application_principals WHERE identity_subject_id = '${subject}' ON CONFLICT DO NOTHING`);
            localSql(`INSERT INTO learner_tools (principal_id, tool_id) SELECT id, '${wrongToolId}' FROM application_principals WHERE identity_subject_id = '${subject}' ON CONFLICT DO NOTHING`);
            for (const [index, state, config] of [
                [0, 'locked', { unlock: { enabled: true, tool: { enabled: true, toolId }, } }],
                [2, 'hidden', { label: 'Concealed custom label', reveal: { enabled: true, toolId } }],
            ] as const) {
                const node = await admin.request.post(`/api/v1/admin/world-builder/maps/${mapId}/nodes`, { headers: adminHeaders, data: { title: state === 'locked' ? 'Tool gate' : 'Concealed discovery', description: 'Concealed authored description', position_q: index, position_r: 0, state, visual_config: config } });
                expect(node.status()).toBe(201);
            }
            // Publish only this disposable fixture; author publication UI is not under test.
            localSql(`UPDATE learning_maps SET world_id = '${worldId}', published_at = NOW(), access_roles = '["public"]' WHERE id = '${mapId}'; UPDATE learning_nodes SET published_at = NOW() WHERE map_id = '${mapId}'; UPDATE learning_map_assets SET published_at = NOW(), position_x = CASE WHEN slug = 'tool-gate' THEN 35 ELSE 65 END, position_y = 50 WHERE map_id = '${mapId}'`);
            const readStarted = performance.now();
            const snapshot = await (await owner.request.get('/api/v1/learner/world')).json();
            info.annotations.push({ type: 'native-world-read', description: `${Math.round(performance.now() - readStarted)} ms; ${Buffer.byteLength(JSON.stringify(snapshot))} bytes` });
            const graph = snapshot.graph.maps.find((map) => map.id === mapId);
            expect(graph).toBeDefined();
            const map = snapshot.world.maps.find((map) => map.slug === graph.slug);
            const locked = map.nodes.find((node) => node.state === 'locked');
            const hidden = map.nodes.find((node) => node.state === 'hidden');
            const page = await owner.newPage();
            const errors: string[] = [];
            const reads = new Map<string, number>();
            page.on('pageerror', (error) => errors.push(error.message));
            page.on('request', (request) => {
                const path = new URL(request.url()).pathname;
                if (path.startsWith('/api/v1/') && request.method() === 'GET') reads.set(path, (reads.get(path) ?? 0) + 1);
            });
            await page.goto(`/world?map=${map.slug}`);
            await expect(page.getByRole('heading', { name: map.title, exact: true })).toBeVisible();
            await page.evaluate(() => { window.nativeToolDocument = 'retained'; });
            const initialReads = new Map(reads);
            const equip = async (title: string) => {
                await page.getByRole('button', { name: 'Open tools', exact: true }).click();
                const toolButton = page.getByRole('button', { name: title, exact: true });
                await expect(toolButton).toBeVisible();
                const box = await toolButton.boundingBox();
                expect(box!.x).toBeGreaterThanOrEqual(0);
                expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
                await toolButton.click();
            };
            const lockedPath = `/api/v1/learner/maps/${map.slug}/nodes/${locked.slug}/use-tool`;
            const hiddenPath = `/api/v1/learner/maps/${map.slug}/nodes/${hidden.slug}/use-tool`;
            await equip(wrong.title);
            const noOp = page.waitForResponse((response) => new URL(response.url()).pathname === lockedPath);
            await page.getByRole('button', { name: 'Tool gate', exact: true }).click();
            expect(await (await noOp).json()).toMatchObject({ is_useful: false, is_unlocked: false });
            expect(reads.get('/api/v1/learner/world')).toBe(1);
            await page.getByRole('button', { name: 'Open tools', exact: true }).click(); // clear wrong tool
            await equip(catalog.title);
            await page.route(`**${lockedPath}`, (route) => route.fulfill({ status: 503 }));
            await page.getByRole('button', { name: 'Tool gate', exact: true }).click();
            await expect(page.getByRole('alert')).toHaveText('The tool could not be used.');
            expect(reads.get('/api/v1/learner/world')).toBe(1);
            await page.unroute(`**${lockedPath}`);
            const unlock = page.waitForResponse((response) => new URL(response.url()).pathname === lockedPath);
            await page.getByRole('button', { name: 'Tool gate', exact: true }).click();
            expect(await (await unlock).json()).toMatchObject({ is_useful: true, is_unlocked: true, discovered: false });
            await expect.poll(() => reads.get('/api/v1/learner/world')).toBe(2);
            await expect(page.getByRole('alert')).toHaveCount(0);
            // The same equipped tool survives the partial World update.
            const reveal = page.waitForResponse((response) => new URL(response.url()).pathname === hiddenPath);
            await page.getByRole('button', { name: 'Undiscovered place', exact: true }).click();
            expect(await (await reveal).json()).toMatchObject({ is_useful: true, discovered: true });
            await expect(page.getByRole('button', { name: 'Concealed custom label', exact: true })).toBeVisible();
            await expect.poll(() => reads.get('/api/v1/learner/world')).toBe(3);
            expect(await page.evaluate(() => window.nativeToolDocument)).toBe('retained');
            for (const [path, count] of initialReads) if (!['/api/v1/learner/world', '/api/v1/security/csrf'].includes(path)) expect(reads.get(path), path).toBe(count);
            expect(reads.get('/api/v1/security/csrf')).toBe(5);
            const afterMap = (await (await owner.request.get('/api/v1/learner/world')).json()).world.maps.find((candidate) => candidate.slug === map.slug);
            expect(afterMap.nodes.find((node) => node.slug === hidden.slug)).toMatchObject({ state: 'available', visual_config: { reveal: { isDiscovered: true } } });
            expect(afterMap.nodes.find((node) => node.slug === locked.slug)).toMatchObject({ state: 'available', visual_config: { unlock: { isUnlocked: true, toolUsed: true } } });
            const peerMap = (await (await peer.request.get('/api/v1/learner/world')).json()).world.maps.find((candidate) => candidate.slug === map.slug);
            expect(peerMap.nodes.find((node) => node.slug === hidden.slug).title).toBe('Undiscovered place');
            expect(peerMap.nodes.find((node) => node.slug === locked.slug).state).toBe('locked');
            expect((await peer.request.post(hiddenPath, { headers: peerHeaders, data: { tool_slug: catalog.slug } })).status()).toBe(404);
            expect((await owner.request.post(lockedPath, { headers: { Origin: ownerHeaders.Origin }, data: { tool_slug: catalog.slug } })).status()).toBe(403);
            await info.attach(`native-world-tools-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' });
            await page.reload();
            await page.getByRole('button', { name: 'Tool gate', exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Tool gate', exact: true })).toBeVisible();
            expect(errors).toEqual(['The tool could not be used.']);
        } finally {
            if (shell.menu_theme) expect((await owner.request.post('/api/v1/learner/map-location', { headers: ownerHeaders, data: { map: shell.menu_theme.map_id } })).status()).toBe(200);
            if (mapId) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${mapId}`, { headers: adminHeaders })).status()).toBe(204);
            if (toolId) localSql(`DELETE FROM learning_tools WHERE id = '${toolId}'`);
            if (wrongToolId) localSql(`DELETE FROM learning_tools WHERE id = '${wrongToolId}'`);
            await admin.close(); await owner.close(); await peer.close();
        }
    });
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function localSql(sql: string) { execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input: sql, stdio: ['pipe', 'pipe', 'pipe'] }); }
