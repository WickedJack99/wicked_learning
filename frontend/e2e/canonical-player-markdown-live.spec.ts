import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) for (const scenario of ['journey', 'large', 'empty', 'failure', 'overflow', 'replay', 'replay-failure'] as const) {
    test(`whole copied Markdown ${scenario} uses Rust at ${viewport.width}`, async ({ browser, baseURL }, info) => {
        test.setTimeout(90_000);
        const replay = scenario.startsWith('replay'); const failure = scenario === 'failure' || scenario === 'replay-failure';
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        for (const path of ['features/world/markdown-activity.tsx', 'features/platform-info/markdown-renderer.tsx', 'features/world/activity-utils.tsx', 'components/ui/button.tsx', 'hooks/use-appearance.tsx', 'hooks/use-platform-translation.ts', 'lib/media-url.ts', 'lib/utils.ts']) expect(readFileSync(`../resources/js/${path}`)).toEqual(execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:resources/js/${path}`]));
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owners = await Promise.all(['first', 'second'].map((name) => browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath(name as 'first' | 'second') })));
        const adminHeaders = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await admin.request.get('/api/v1/security/csrf')).json()).token };
        const activity = randomUUID(), next = randomUUID(), start = randomUUID(); const runs = [randomUUID(), randomUUID()];
        const principals: string[] = []; const errors: string[] = [], legacy: string[] = []; const completionStatuses: number[] = [];
        let map: string | undefined; let media: string | undefined;
        try {
            for (const owner of owners) {
                owner.setDefaultTimeout(8_000); const me = await owner.request.get('/api/v1/me'); expect(me.status()).toBe(200);
                principals.push(uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim()));
            }
            const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Markdown browser ${activity}`, description: null, slug: null } }); expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
            const madeNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Markdown place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } }); expect(madeNode.status()).toBe(201); const node = await madeNode.json(); uuid(node.node_id); uuid(node.asset_id);
            const picture = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="#0891b2"/></svg>');
            if (scenario === 'journey') {
                const uploaded = await admin.request.post('/api/v1/admin/media-assets', { headers: adminHeaders, multipart: { file: { name: 'markdown.svg', mimeType: 'image/svg+xml', buffer: picture } } }); expect(uploaded.status()).toBe(201); media = uuid((await uploaded.json()).asset.id);
            }
            const authorUrl = `/api/v1/admin/media-assets/${media}/content`; const learnerUrl = `/api/v1/learner/media-assets/${media}/content`;
            const count = scenario === 'empty' ? 0 : scenario === 'overflow' ? 1001 : scenario === 'large' ? 31 : 3;
            const pages = Array.from({ length: count }, (_, i) => ({ id: `page-${i}`, title: `Page ${i}`, body: `# Reading ${i}\n\nA source-authored explanation.`, visual: { pageColorLight: '#ffffff', headingColorLight: '#0e7490' } }));
            if (media) pages[1].body += `\n\n![Source diagram](${authorUrl})\n\n[Open diagram](${authorUrl})\n\n\`${authorUrl}\``;
            const entry = scenario === 'large' ? 30 : 1;
            const transitions = [{ from: 'start', to: `page-${entry}` }, { from: 'page-1', to: 'page-2' }, { from: 'page-2', to: 'end' }];
            if (scenario === 'large') for (let i = 0; i < 58; i++) transitions.push({ from: 'page-30', to: 'end' });
            const config = { markdownPages: pages, markdownTransitions: transitions };
            sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'markdown','Markdown activity','',0,NOW(),'markdown','${JSON.stringify(config)}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${next}',route_id,'next','Next activity','',1,NOW(),'open_practice','{}' FROM learning_activities WHERE id='${activity}';
                INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}');
                ${replay ? '' : `INSERT INTO learning_activity_transitions (from_activity_id,to_activity_id,from_connector,trigger,label) VALUES ('${activity}','${next}','completed','completed','Continue reading');`}
                ${media ? `INSERT INTO reusable_media_asset_references (asset_id,owner_kind,owner_id,field_key) VALUES ('${media}','activity','${activity}','markdownPages[1].body');` : ''}`);
            for (const [i, principal] of principals.entries()) sql(replay
                ? `INSERT INTO learner_activity_replay_runs (id,principal_id,activity_id) VALUES ('${runs[i]}','${principal}','${activity}')`
                : `INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${runs[i]}' FROM learning_activities WHERE id='${activity}'`);
            expect((await owners[1].request.get(`/api/v1/learner/play-runs/${runs[0]}`)).status()).toBe(404);
            if (scenario !== 'overflow') {
                const response = await owners[0].request.get(`/api/v1/learner/play-runs/${runs[0]}`); expect(response.status()).toBe(200); const document = await response.json();
                for (const projected of [document.activity.config, document.graph.activities.find((row: any) => row.id === activity).config]) {
                    expect(projected.markdownPages).toHaveLength(count); expect(projected.markdownTransitions).toEqual(transitions);
                    expect(projected.markdownPages.map((page: any) => page.body)).toEqual(pages.map((page) => page.body));
                }
            }
            const browsers = await Promise.all(owners.map((owner) => owner.newPage()));
            for (const page of browsers) {
                page.on('pageerror', (error) => errors.push(error.message));
                page.on('response', (response) => { if (new URL(response.url()).pathname.endsWith('/complete')) completionStatuses.push(response.status()); });
                page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/learning/')) legacy.push(request.url()); });
            }
            await Promise.all(browsers.map((page, i) => page.goto(`http://localhost:8084/e2e/canonical-player-markdown.html?run=${runs[i]}${i ? '&original' : ''}`)));
            if (scenario === 'overflow') {
                for (const page of browsers) await expect(page.getByRole('alert')).toHaveText('The Markdown activity is currently unavailable.');
                for (const [i, page] of browsers.entries()) await info.attach(`overflow-${i ? 'main' : 'canonical'}`, { body: await page.screenshot(), contentType: 'image/png' });
            } else if (scenario === 'empty') {
                for (const page of browsers) { await expect(page.getByText('No markdown pages', { exact: true })).toBeVisible(); await expect(page.getByRole('button')).toHaveCount(0); }
                await compare(browsers, 'empty', info);
            } else {
                for (const page of browsers) { await expect(page.getByRole('heading', { name: `Reading ${entry}`, exact: true })).toBeVisible(); await bounds(page, viewport); }
                if (media) for (const page of browsers) {
                    const diagram = page.getByRole('img', { name: 'Source diagram' }); await expect(diagram).toHaveAttribute('src', learnerUrl); await expect.poll(() => diagram.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(80);
                    await expect(page.getByRole('link', { name: 'Open diagram' })).toHaveAttribute('href', learnerUrl); await expect(page.locator('code')).toHaveText(authorUrl);
                    expect(await (await page.request.get(learnerUrl)).body()).toEqual(picture);
                    const mapping = await page.evaluate(async () => { const { learnerMarkdownUrl } = await import('/src/platform/playback-markdown-api.ts'); return ['https://example.invalid/api/v1/admin/media-assets/00000000-0000-0000-0000-000000000000/content','/api/v1/admin/media-assets/not-a-uuid/content','/images/clue.svg'].map((url) => learnerMarkdownUrl(url) === url); }); expect(mapping).toEqual([true, true, true]);
                }
                await compare(browsers, 'entry', info);
                if (scenario !== 'large') {
                    for (const page of browsers) { await page.keyboard.press('ArrowRight'); await expect(page.getByRole('heading', { name: 'Reading 2', exact: true })).toBeVisible(); await page.keyboard.press('ArrowLeft'); await expect(page.getByRole('heading', { name: 'Reading 1', exact: true })).toBeVisible(); }
                    await Promise.all(browsers.map((page) => page.reload()));
                    for (const page of browsers) { await expect(page.getByRole('heading', { name: 'Reading 1', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled(); await forward(page).click(); await expect(page.getByRole('heading', { name: 'Reading 2', exact: true })).toBeVisible(); await bounds(page, viewport); }
                    await compare(browsers, 'last', info);
                }
                if (failure) sql(`UPDATE learning_nodes SET state='locked' WHERE id='${node.node_id}'`);
                for (const page of browsers) await forward(page).click();
                if (failure) {
                    await expect.poll(() => errors.length).toBe(2); expect(completionStatuses).toEqual([404, 404]);
                    for (const page of browsers) { expect(await page.evaluate(() => (window as any).__markdownCompletion)).toBeUndefined(); expect(await page.evaluate(() => (window as any).__markdownDestination)).toBeUndefined(); await expect(page.getByRole('heading', { name: 'Reading 2', exact: true })).toBeVisible(); }
                    expect(sql(`SELECT count(*) FROM learner_activity_progress WHERE activity_id='${activity}' AND status='completed'`).trim()).toBe('0');
                    await compare(browsers, 'denied-completion', info);
                    info.annotations.push({ type: 'source-defect', description: 'Markdown invokes completion without catch/pending/inline error. Denied writes retain the last page and reject; adapter does not manufacture completion or navigation.' });
                } else for (const page of browsers) {
                    await expect.poll(() => page.evaluate(() => (window as any).__markdownCompletion?.receipt.status)).toBe(replay ? 'completed' : 'in_progress');
                    expect(await page.evaluate(() => (window as any).__markdownDestination)).toEqual({ id: replay ? null : next });
                    expect(await page.evaluate(() => (window as any).__markdownCompletion.receipt.next_activity_id)).toBe(replay ? null : next);
                }
                if (replay) expect(sql(`SELECT count(*) FROM learner_route_progress WHERE current_play_run_id IN ('${runs[0]}','${runs[1]}')`).trim()).toBe('0');
                if (media) {
                    sql(`UPDATE learning_maps SET published_at=NULL WHERE id='${map}'`);
                    expect((await owners[0].request.get(learnerUrl)).status()).toBe(404);
                    sql(`UPDATE learning_maps SET published_at=NOW() WHERE id='${map}'`);
                }
            }
            expect(legacy).toEqual([]); if (!failure) expect(errors).toEqual([]);
        } finally {
            if (map) {
                sql(`DELETE FROM learning_activity_transitions WHERE from_activity_id='${activity}' OR to_activity_id IN ('${activity}','${next}')`);
                expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
            }
            if (media) expect((await admin.request.delete(`/api/v1/admin/media-assets/${media}`, { headers: adminHeaders })).status()).toBe(204);
            await Promise.all([admin.close(), ...owners.map((owner) => owner.close())]);
        }
    });
}
function forward(page: Page) { return page.getByTestId('markdown-evidence').getByRole('button').last(); }
async function bounds(page: Page, viewport: { width: number; height: number }) { for (const control of [page.getByRole('button', { name: 'Previous page' }), forward(page)]) { await expect(control).toBeVisible(); const box = await control.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1); expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1); } }
async function compare(pages: Page[], name: string, info: TestInfo) { for (const page of pages) await page.mouse.move(0, 0); expect(await pages[0].getByTestId('markdown-evidence').innerText()).toBe(await pages[1].getByTestId('markdown-evidence').innerText()); expect(await pages[0].getByTestId('markdown-evidence').boundingBox()).toEqual(await pages[1].getByTestId('markdown-evidence').boundingBox()); for (const [i, page] of pages.entries()) await info.attach(`${name}-${i ? 'main' : 'canonical'}`, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' }); }
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
