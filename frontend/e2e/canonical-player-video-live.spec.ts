import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

test.beforeAll(() => {
    for (const path of ['features/world/markdown-activity.tsx', 'features/platform-info/markdown-renderer.tsx', 'features/world/activity-utils.tsx', 'components/ui/button.tsx', 'hooks/use-appearance.tsx', 'hooks/use-platform-translation.ts', 'lib/media-url.ts', 'lib/utils.ts']) expect(readFileSync(`../resources/js/${path}`)).toEqual(execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:resources/js/${path}`]));
});

const clip = (color: string, format: 'webm' | 'mp4' | 'mov' | 'm4v' | 'ogg' = 'webm') => execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=160x90:r=10`, '-t', '1', '-an',
    ...(format === 'webm' ? ['-c:v', 'libvpx', '-f', 'webm'] : format === 'ogg' ? ['-c:v', 'libtheora', '-f', 'ogg'] : ['-c:v', 'libx264', '-movflags', 'frag_keyframe+empty_moov', ...(format === 'm4v' ? ['-brand', 'M4V '] : []), '-f', format === 'mov' ? 'mov' : 'mp4']), 'pipe:1']);
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) test(`whole copied Markdown video lifecycle at ${viewport.width}`, async ({ browser, baseURL }, info) => {
    test.setTimeout(90_000);
    expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
    const owner = await browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath('first') });
    const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
    const guest = await browser.newContext({ baseURL });
    const headers = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await admin.request.get('/api/v1/security/csrf')).json()).token };
    const peerHeaders = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await peer.request.get('/api/v1/security/csrf')).json()).token };
    const uploads: string[] = []; let map: string | undefined; let otherMap: string | undefined;
    const green = clip('green'), blue = clip('blue', 'mp4');
    try {
        const createMap = await admin.request.post('/api/v1/admin/world-builder/maps', { headers, data: { title: `Video ${randomUUID()}`, description: null, slug: null } }); expect(createMap.status()).toBe(201); map = uuid((await createMap.json()).map_id);
        const endpoint = `/api/v1/admin/world-builder/maps/${map}/visual-media`;
        const upload = async (bytes: Buffer, name = 'clip.webm') => {
            const response = await admin.request.post(endpoint, { headers, multipart: { file: { name, mimeType: 'application/octet-stream', buffer: bytes } } }); expect(response.status()).toBe(201);
            const body = await response.json(); const id = uuid(body.url.split('/').at(-2)); uploads.push(id); return { ...body, id, learner: `/api/v1/learner/media-assets/${id}/content` };
        };
        if (viewport.width === 1440) for (const [format, mime] of [['mov','video/quicktime'], ['m4v','video/x-m4v'], ['ogg','video/ogg']] as const) {
            const bytes = clip('red', format); const value = await upload(bytes, `clip.${format}`);
            const read = await admin.request.get(value.preview_url); expect(read.headers()['content-type']).toBe(mime); expect(await read.body()).toEqual(bytes);
            expect((await admin.request.delete(`${endpoint}/${value.id}`, { headers })).status()).toBe(204);
        }
        const first = await upload(green);
        const firstKey = objectKey(first.id); expect(objectExists(firstKey)).toBe(true);
        const another = await admin.request.post('/api/v1/admin/world-builder/maps', { headers, data: { title: `Other video scope ${randomUUID()}`, description: null, slug: null } }); expect(another.status()).toBe(201); otherMap = uuid((await another.json()).map_id);
        const wrongScope = `/api/v1/admin/world-builder/maps/${otherMap}/visual-media/${first.id}`;
        expect((await admin.request.get(`${wrongScope}/content`)).status()).toBe(404);
        expect((await admin.request.delete(wrongScope, { headers })).status()).toBe(404);
        expect((await admin.request.delete(`${endpoint}/${first.id}`)).status()).toBe(403);
        expect((await peer.request.delete(`${endpoint}/${first.id}`, { headers: peerHeaders })).status()).toBe(404);
        expect((await admin.request.get(`${first.preview_url}?download=true`)).headers()['content-disposition']).toBe('attachment');
        const previewRange = await admin.request.get(first.preview_url, { headers: { Range: 'bytes=5-15' } }); expect(previewRange.status()).toBe(206); expect(await previewRange.body()).toEqual(green.subarray(5, 16));
        expect((await owner.request.get(first.learner)).status()).toBe(404);
        expect((await peer.request.get(first.preview_url)).status()).toBe(404);
        expect((await admin.request.get(first.preview_url)).headers()['content-type']).toBe('video/webm');
        expect(await (await admin.request.get(first.preview_url)).body()).toEqual(green);
        expect((await admin.request.post(endpoint, { multipart: { file: { name: 'clip.webm', mimeType: 'video/webm', buffer: green } } })).status()).toBe(403);
        expect((await peer.request.post(endpoint, { headers: peerHeaders, multipart: { file: { name: 'clip.webm', mimeType: 'video/webm', buffer: green } } })).status()).toBe(404);
        expect((await admin.request.post(endpoint, { headers, multipart: { file: { name: 'fake.webm', mimeType: 'video/webm', buffer: Buffer.from('not video data') } } })).status()).toBe(422);
        if (viewport.width === 1440) {
            const largeClip = execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30', '-t', '2', '-an', '-c:v', 'libx264', '-qp', '0', '-preset', 'ultrafast', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1'], { maxBuffer: 50 * 1024 * 1024 });
            expect(largeClip.length).toBeGreaterThan(5 * 1024 * 1024);
            const large = await upload(largeClip, 'large-real.mp4');
            expect(await (await admin.request.get(large.preview_url)).body()).toEqual(largeClip);
            expect((await admin.request.delete(`${endpoint}/${large.id}`, { headers })).status()).toBe(204);
            const before = sql('SELECT count(*) FROM reusable_media_assets').trim();
            expect((await admin.request.post(endpoint, { headers, multipart: { file: { name: 'large.webm', mimeType: 'video/webm', buffer: Buffer.alloc(50 * 1024 * 1024 + 1) } } })).status()).toBe(422);
            expect(sql('SELECT count(*) FROM reusable_media_assets').trim()).toBe(before);
        }
        const madeNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers, data: { title: 'Video place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } }); expect(madeNode.status()).toBe(201); const node = await madeNode.json(); uuid(node.node_id); uuid(node.asset_id);
        const form = (url: string) => ({ title: 'Watch a source clip', slug: null, introduction: null,
            markdown_pages: [{ id: 'clip', title: 'Clip', body: `# Watch the clip\n\n![Authored clip](${url})`, position: { x: 0, y: 0 }, visual: { page_color_dark: '#0f172a', page_color_light: '#ffffff', border_color_dark: '#2dd4bf', border_color_light: '#0891b2', heading_color_dark: '#67e8f9', heading_color_light: '#0e7490', text_color_dark: '#f8fafc', text_color_light: '#0f172a' } }],
            markdown_transitions: [{ id: 'start', from: 'start', to: 'clip' }, { id: 'end', from: 'clip', to: 'end' }], markdown_graph_layout: {} });
        const created = await admin.request.post(`/api/v1/admin/world-builder/nodes/${node.node_id}/markdown-activities`, { headers, data: form(first.url) }); expect(created.status()).toBe(201); const activity = uuid((await created.json()).activity_id);
        const me = await owner.request.get('/api/v1/me'); expect(me.status()).toBe(200); const principal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim());
        const start = randomUUID(), run = randomUUID();
        sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["learner"]' WHERE id='${map}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}'; UPDATE learning_activities SET published_at=NOW() WHERE id='${activity}'; INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}'); INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${run}' FROM learning_activities WHERE id='${activity}'`);
        const readStarted = performance.now();
        const documentResponse = await owner.request.get(`/api/v1/learner/play-runs/${run}`); expect(documentResponse.status()).toBe(200);
        const document = await documentResponse.json();
        await info.attach('playback-read-measurement', { body: JSON.stringify({ durationMs: performance.now() - readStarted, bytes: (await documentResponse.body()).length, mediaEntries: document.graph.activities.find((entry: any) => entry.id === activity).presentation.markdown_media.length }), contentType: 'application/json' });
        expect(document.graph.activities.find((entry: any) => entry.id === activity).presentation.markdown_media).toEqual([{ id: first.id, url: first.learner, content_type: 'video/webm' }]);
        expect((await guest.request.get(first.learner)).status()).toBe(404);
        const partial = await owner.request.get(first.learner, { headers: { Range: 'bytes=0-15' } }); expect(partial.status()).toBe(206); expect(await partial.body()).toEqual(green.subarray(0, 16)); expect(partial.headers()['content-range']).toBe(`bytes 0-15/${green.length}`);
        const suffix = await owner.request.get(first.learner, { headers: { Range: 'bytes=-12' } }); expect(suffix.status()).toBe(206); expect(await suffix.body()).toEqual(green.subarray(-12));
        expect((await owner.request.get(first.learner, { headers: { Range: `bytes=${green.length}-` } })).status()).toBe(416);
        expect((await admin.request.delete(`${endpoint}/${first.id}`, { headers })).status()).toBe(404);
        const pages = await Promise.all([owner.newPage(), owner.newPage()]); const errors: string[] = [];
        for (const [i, page] of pages.entries()) {
            page.on('pageerror', (error) => errors.push(error.message));
            await page.goto(`http://localhost:8084/e2e/canonical-player-markdown.html?run=${run}${i ? '&original' : ''}`);
            const video = page.locator('video'); await expect(video).toHaveAttribute('controls', ''); await expect(video).toHaveAttribute('src', first.learner);
            await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
            expect(await video.evaluate((element) => (element as HTMLVideoElement).videoWidth)).toBe(160);
            await video.evaluate(async (element) => { const video = element as HTMLVideoElement; video.muted = true; await video.play(); });
            await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
            await video.evaluate((element) => { const video = element as HTMLVideoElement; video.pause(); video.currentTime = 0; });
            const box = await video.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width); expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
            await page.mouse.move(0, 0); await info.attach(`video-${i ? 'main' : 'canonical'}`, { body: await page.screenshot(), contentType: 'image/png' });
        }
        const second = await upload(blue, 'replacement.mp4'); const secondKey = objectKey(second.id); expect(objectExists(secondKey)).toBe(true);
        const updated = sql(`SELECT to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') FROM learning_activities WHERE id='${activity}'`).trim();
        const replacement = await admin.request.patch(`/api/v1/admin/world-builder/activities/${activity}/markdown`, { headers, data: { ...form(second.url), updated_at: updated } }); expect(replacement.status()).toBe(200);
        expect((await owner.request.get(first.learner)).status()).toBe(404);
        for (const page of pages) {
            await page.reload(); await expect(page.locator('video')).toHaveAttribute('src', second.learner);
            await expect.poll(() => page.locator('video').evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
            await page.locator('video').evaluate(async (element) => { const video = element as HTMLVideoElement; video.muted = true; await video.play(); });
            await expect.poll(() => page.locator('video').evaluate((element) => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
            expect(await page.evaluate(async (url) => (await import('/src/platform/playback-context.ts')).playbackMediaType(url), first.learner)).toBeUndefined();
        }
        const replacedBytes = await owner.request.get(second.learner); expect(replacedBytes.headers()['content-type']).toBe('video/mp4'); expect(await replacedBytes.body()).toEqual(blue);
        expect((await admin.request.delete(`${endpoint}/${first.id}`, { headers })).status()).toBe(204); expect(objectExists(firstKey)).toBe(false);
        sql(`UPDATE learning_maps SET published_at=NULL WHERE id='${map}'`);
        expect((await owner.request.get(second.learner, { headers: { Range: 'bytes=0-15' } })).status()).toBe(404);
        await pages[0].reload(); await expect(pages[0].getByRole('alert')).toHaveText('The Markdown activity is currently unavailable.'); await expect(pages[0].locator('video')).toHaveCount(0);
        sql(`UPDATE learning_maps SET published_at=NOW() WHERE id='${map}'`);
        const removed = await admin.request.patch(`/api/v1/admin/world-builder/activities/${activity}/markdown`, { headers, data: { ...form('/images/tools/pattern-lens-light.svg'), updated_at: (await replacement.json()).updated_at } }); expect(removed.status()).toBe(200);
        expect((await owner.request.get(second.learner)).status()).toBe(404);
        expect((await admin.request.delete(`${endpoint}/${second.id}`, { headers })).status()).toBe(204); expect(objectExists(secondKey)).toBe(false);
        for (const page of pages) {
            await page.reload(); await expect(page.locator('article img')).toHaveAttribute('src', '/images/tools/pattern-lens-light.svg'); await expect(page.locator('video')).toHaveCount(0);
            expect(await page.evaluate(async (url) => (await import('/src/platform/playback-context.ts')).playbackMediaType(url), second.learner)).toBeUndefined();
        }
        expect(errors).toEqual([]);
    } finally {
        if (map) {
            // Remove only this fixture's saved references before releasing its uploads.
            sql(`DELETE FROM reusable_media_asset_references WHERE owner_kind='activity' AND owner_id IN (SELECT a.id FROM learning_activities a JOIN learning_routes r ON r.id=a.route_id JOIN learning_map_assets m ON m.id=r.map_asset_id WHERE m.map_id='${map}')`);
            for (const id of uploads) { const response = await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}/visual-media/${id}`, { headers }); expect([204, 404]).toContain(response.status()); }
            expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers })).status()).toBe(204);
        }
        if (otherMap) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${otherMap}`, { headers })).status()).toBe(204);
        await Promise.all([admin.close(), owner.close(), peer.close(), guest.close()]);
    }
});
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }

function objectKey(id: string) { const key = sql(`SELECT object_key FROM reusable_media_assets WHERE id='${uuid(id)}'`).trim(); expect(key).toMatch(/^media\/[a-f0-9-]{36}$/); return key; }
function objectExists(key: string) { return spawnSync('docker', ['exec', 'wicked_learning-backend-1', 'test', '-f', `/var/lib/wicked-learning/media/${key}`]).status === 0; }
