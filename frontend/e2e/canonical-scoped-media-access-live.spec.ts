import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

test('a copied scoped upload retains originating-map access after publication and map deletion', async ({ browser, baseURL }) => {
    expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    for (const path of ['app/Http/Controllers/ProtectedMapMediaController.php', 'app/Learning/Services/LearningMapAccessService.php']) {
        expect(readFileSync(`../${path}`)).toEqual(execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:${path}`]));
    }
    const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
    const learner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
    const guest = await browser.newContext({ baseURL });
    const headers = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await admin.request.get('/api/v1/security/csrf')).json()).token };
    const maps: string[] = []; let asset: string | undefined; let key: string | undefined;
    try {
        for (const title of ['Private origin', 'Public reference']) {
            const response = await admin.request.post('/api/v1/admin/world-builder/maps', { headers, data: { title: `${title} ${randomUUID()}`, description: null, slug: null } });
            expect(response.status()).toBe(201); maps.push(uuid((await response.json()).map_id));
        }
        const [origin, destination] = maps;
        const bytes = execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=10', '-t', '1', '-an', '-c:v', 'libvpx', '-f', 'webm', 'pipe:1']);
        const uploaded = await admin.request.post(`/api/v1/admin/world-builder/maps/${origin}/visual-media`, { headers, multipart: { file: { name: 'private.webm', mimeType: 'video/webm', buffer: bytes } } });
        expect(uploaded.status()).toBe(201); const upload = await uploaded.json(); asset = uuid(upload.url.split('/').at(-2));
        key = sql(`SELECT object_key FROM reusable_media_assets WHERE id='${asset}'`).trim(); expect(key).toMatch(/^media\/[a-f0-9-]{36}$/);
        const nodeResponse = await admin.request.post(`/api/v1/admin/world-builder/maps/${destination}/nodes`, { headers, data: { title: 'Copied video', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
        expect(nodeResponse.status()).toBe(201); const node = await nodeResponse.json(); uuid(node.node_id); uuid(node.asset_id);
        const created = await admin.request.post(`/api/v1/admin/world-builder/nodes/${node.node_id}/markdown-activities`, { headers, data: {
            title: 'Reference a private upload', slug: null, introduction: null,
            markdown_pages: [{ id: 'clip', title: 'Clip', body: `![Private clip](${upload.url})`, position: { x: 0, y: 0 }, visual: { page_color_dark: '#0f172a', page_color_light: '#ffffff', border_color_dark: '#2dd4bf', border_color_light: '#0891b2', heading_color_dark: '#67e8f9', heading_color_light: '#0e7490', text_color_dark: '#f8fafc', text_color_light: '#0f172a' } }],
            markdown_transitions: [{ id: 'begin', from: 'start', to: 'clip' }, { id: 'finish', from: 'clip', to: 'end' }], markdown_graph_layout: {},
        } });
        expect(created.status()).toBe(201); const activity = uuid((await created.json()).activity_id);
        sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${destination}'; UPDATE learning_maps SET access_roles='["learner"]' WHERE id='${origin}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}'; UPDATE learning_activities SET published_at=NOW() WHERE id='${activity}'`);
        const content = `/api/v1/learner/media-assets/${asset}/content`;
        const denied = await guest.request.get(content, { headers: { Range: 'bytes=0-15' } });
        expect(denied.status()).toBe(404); expect(denied.headers()['content-range']).toBeUndefined();
        expect(await (await learner.request.get(content)).body()).toEqual(bytes);
        sql(`UPDATE learning_maps SET access_roles='["public"]' WHERE id='${origin}'`);
        expect(await (await guest.request.get(content)).body()).toEqual(bytes);
        sql(`UPDATE learning_maps SET access_roles='["platform_administrator"]' WHERE id='${origin}'`);
        expect((await learner.request.get(content)).status()).toBe(404);
        expect((await guest.request.get(content)).status()).toBe(404);
        expect(await (await admin.request.get(content)).body()).toEqual(bytes);
        expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${origin}`, { headers })).status()).toBe(204);
        expect((await admin.request.get(`/api/v1/admin/world-builder/maps/${destination}/visual-media/${asset}/content`)).status()).toBe(404);
        expect(sql(`SELECT count(*) FROM map_media_uploads WHERE asset_id='${asset}' AND map_id IS NULL`).trim()).toBe('1');
        expect((await learner.request.get(content)).status()).toBe(404);
        expect((await guest.request.get(content)).status()).toBe(404);
    } finally {
        for (const map of maps.reverse()) {
            const response = await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers }); expect([204, 404]).toContain(response.status());
        }
        // Only this fixture's now-unreferenced orphan is removed. Production
        // orphan collection is a separate acceptance gate, not emulated here.
        if (asset) sql(`DELETE FROM reusable_media_assets WHERE id='${asset}' AND NOT EXISTS (SELECT 1 FROM reusable_media_asset_references WHERE asset_id='${asset}')`);
        if (key) execFileSync('docker', ['exec', 'wicked_learning-backend-1', 'rm', '-f', '--', `/var/lib/wicked-learning/media/${key}`]);
        await Promise.all([admin.close(), learner.close(), guest.close()]);
    }
});
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
