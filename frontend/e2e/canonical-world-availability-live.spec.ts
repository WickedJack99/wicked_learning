import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`native World evaluates tool availability without exposing concealed content at ${viewport.width}`, async ({ browser, baseURL }, info) => {
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
        try {
            const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Availability ${randomUUID()}`, description: null, slug: null } });
            expect(created.status()).toBe(201);
            mapId = uuid((await created.json()).map_id);
            const tool = await admin.request.post('/api/v1/admin/assets/tools', { headers: adminHeaders, data: { title: `Lens ${randomUUID()}`, slug: null, description: null, image_dark: null, image_light: null, animation_dark: null, animation_light: null, image_width_percent: 18 } });
            expect(tool.status()).toBe(201);
            const catalog = (await tool.json()).tool;
            toolId = uuid(catalog.id);
            const subject = uuid((await (await owner.request.get('/api/v1/me')).json()).subject_id);
            // Only this newly-created local catalog entry is granted. Playback
            // grant UI is outside this read-contract acceptance test.
            localSql(`INSERT INTO learner_tools (principal_id, tool_id) SELECT id, '${toolId}' FROM application_principals WHERE identity_subject_id = '${subject}' ON CONFLICT DO NOTHING`);
            for (const [index, state, config] of [
                [0, 'locked', { unlock: { enabled: true, tool: { enabled: true, toolId }, }, schedule: { unlockAt: '2099-01-01T00:00:00Z' } }],
                [2, 'hidden', { label: 'Concealed custom label', reveal: { enabled: true, toolId } }],
            ] as const) {
                const node = await admin.request.post(`/api/v1/admin/world-builder/maps/${mapId}/nodes`, { headers: adminHeaders, data: { title: state === 'locked' ? 'Timed tool gate' : 'Concealed discovery', description: 'Concealed authored description', position_q: index, position_r: 0, state, visual_config: config } });
                expect(node.status()).toBe(201);
            }
            // Publish only this disposable fixture; author publication UI is not under test.
            localSql(`UPDATE learning_maps SET world_id = '${worldId}', published_at = NOW(), access_roles = '["public"]' WHERE id = '${mapId}'; UPDATE learning_nodes SET published_at = NOW() WHERE map_id = '${mapId}'; UPDATE learning_map_assets SET published_at = NOW() WHERE map_id = '${mapId}'`);
            const readStarted = performance.now();
            const snapshot = await (await owner.request.get('/api/v1/learner/world')).json();
            info.annotations.push({ type: 'native-world-read', description: `${Math.round(performance.now() - readStarted)} ms; ${Buffer.byteLength(JSON.stringify(snapshot))} bytes` });
            const graph = snapshot.graph.maps.find((map) => map.id === mapId);
            expect(graph).toBeDefined();
            const map = snapshot.world.maps.find((map) => map.slug === graph.slug);
            const locked = map.nodes.find((node) => node.state === 'locked');
            const hidden = map.nodes.find((node) => node.state === 'hidden');
            expect(hidden).toMatchObject({ title: 'Undiscovered place', description: '', visual_config: { hideEmptySpace: true, reveal: { isDiscoverable: true, isDiscovered: false } } });
            expect(hidden.visual_config.label).toBeUndefined();
            expect(graph.nodes.find((node) => node.slug === hidden.slug)).toMatchObject({ activities: [], starts: [], start_activity_id: null });
            expect(locked.visual_config.unlock).toMatchObject({ isUnlocked: false, isToolUnlockable: true, toolUsed: false, requirements: { type: 'group', operator: 'and', satisfied: false, requirements: [ { type: 'tool_used', toolTitle: catalog.title, satisfied: false }, { type: 'time_after', satisfied: false } ] } });
            const page = await owner.newPage();
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await page.goto(`/world?map=${map.slug}&focused=${locked.slug}`);
            // The pinned World refuses locked selection even with complete
            // requirements. Preserve and record this source defect.
            await expect(page.getByRole('heading', { name: map.title, exact: true })).toBeVisible();
            await expect(page.getByText('Locked for now', { exact: true })).toHaveCount(0);
            await page.getByRole('button', { name: 'Open tools', exact: true }).click();
            await expect(page.getByRole('dialog', { name: 'Select a tool' })).toBeVisible();
            await expect(page.getByRole('dialog').getByText(catalog.title, { exact: true })).toBeVisible();
            await page.keyboard.press('Escape');
            await info.attach(`native-availability-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' });
            for (const node of [locked, hidden]) {
                const path = `/api/v1/learner/maps/${map.slug}/nodes/${node.slug}/use-tool`;
                expect((await peer.request.post(path, { headers: peerHeaders, data: { tool_slug: catalog.slug } })).status()).toBe(404);
                expect((await owner.request.post(path, { headers: { Origin: ownerHeaders.Origin }, data: { tool_slug: catalog.slug } })).status()).toBe(403);
                const used = await owner.request.post(path, { headers: ownerHeaders, data: { tool_slug: catalog.slug } });
                expect(used.status()).toBe(200);
                expect(await used.json()).toMatchObject({ is_useful: true, is_unlocked: node === hidden, discovered: node === hidden });
            }
            const after = await (await owner.request.get('/api/v1/learner/world')).json();
            const afterMap = after.world.maps.find((candidate) => candidate.slug === map.slug);
            expect(afterMap.nodes.find((node) => node.slug === hidden.slug)).toMatchObject({ title: 'Concealed discovery', state: 'available', visual_config: { reveal: { isDiscovered: true } } });
            expect(afterMap.nodes.find((node) => node.slug === locked.slug)).toMatchObject({ state: 'locked', visual_config: { unlock: { isUnlocked: false, toolUsed: true } } });
            const peerMap = (await (await peer.request.get('/api/v1/learner/world')).json()).world.maps.find((candidate) => candidate.slug === map.slug);
            expect(peerMap.nodes.find((node) => node.slug === hidden.slug).title).toBe('Undiscovered place');
            await page.reload();
            await expect(page.getByText('Locked for now', { exact: true })).toHaveCount(0);
            expect(errors).toEqual([]);
        } finally {
            if (shell.menu_theme) expect((await owner.request.post('/api/v1/learner/map-location', { headers: ownerHeaders, data: { map: shell.menu_theme.map_id } })).status()).toBe(200);
            if (mapId) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${mapId}`, { headers: adminHeaders })).status()).toBe(204);
            if (toolId) localSql(`DELETE FROM learning_tools WHERE id = '${toolId}'`);
            await admin.close(); await owner.close(); await peer.close();
        }
    });
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function localSql(sql: string) { execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input: sql, stdio: ['pipe', 'pipe', 'pipe'] }); }
