import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

const pin = '32c3113a5bc688c9944c20942cdf40a6a5d57d7f';
const scenarios = ['items', 'failed-roll', 'inventory-unavailable', 'tool', 'owned-tool'] as const;
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const scenario of scenarios) {
        test(`whole copied ${scenario} grant uses Rust at ${viewport.width}`, async ({ browser, baseURL }, info) => {
            test.setTimeout(75_000);
            expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
            for (const path of ['features/world/item-grant-activity.tsx', 'features/world/tool-grant-activity.tsx', 'features/world/activity-utils.tsx', 'features/items/item-inventory.ts', 'features/tools/tool-selection.ts', 'features/tools/tool-visuals.ts', 'components/ui/button.tsx', 'hooks/use-appearance.tsx', 'hooks/use-platform-translation.ts', 'lib/media-url.ts', 'lib/utils.ts']) {
                expect(readFileSync(`../resources/js/${path}`)).toEqual(execFileSync('git', ['show', `${pin}:resources/js/${path}`]));
            }
            const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
            const contexts = await Promise.all(['first', 'second'].map((name) => browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath(name as 'first' | 'second') })));
            for (const context of contexts) context.setDefaultTimeout(8_000);
            const adminHeaders = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await admin.request.get('/api/v1/security/csrf')).json()).token };
            const principals: string[] = [];
            for (const context of contexts) {
                const me = await context.request.get('/api/v1/me'); expect(me.status()).toBe(200);
                principals.push(uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim()));
            }
            const activity = randomUUID(); const next = randomUUID(); const start = randomUUID(); const catalog = randomUUID();
            const runs = [randomUUID(), randomUUID()]; const extras: string[] = [];
            const tool = scenario === 'tool' || scenario === 'owned-tool'; const type = tool ? 'tool_grant' : 'item_grant';
            let map: string | undefined;
            try {
                const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Grant browser ${randomUUID()}`, description: null, slug: null } });
                expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
                const createdNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Grant browser place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
                expect(createdNode.status()).toBe(201); const node = await createdNode.json(); uuid(node.node_id); uuid(node.asset_id);
                const config = tool ? { toolId: `grant-${catalog}`, text: 'Keep this tool for later.', typingSpeed: 1 } : { items: [{ itemId: `grant-${catalog}`, quantity: 2 }], probabilityPercent: scenario === 'failed-roll' ? 0.01 : 100 };
                sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}';
                    UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}';
                    UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                    INSERT INTO ${tool ? 'learning_tools' : 'learning_items'} (id,slug,title,config) VALUES ('${catalog}','grant-${catalog}','Grant catalog fixture','{}');
                    INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'grant','Grant activity','',0,NOW(),'${type}','${JSON.stringify(config)}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                    INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${next}',route_id,'next','Next activity','',1,NOW(),'open_practice','{}' FROM learning_activities WHERE id='${activity}';
                    INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}');
                    INSERT INTO learning_activity_transitions (from_activity_id,to_activity_id,from_connector,trigger,label) VALUES ('${activity}','${next}','completed','completed','Continue route');`);
                for (const [i, principal] of principals.entries()) {
                    sql(`INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${runs[i]}' FROM learning_activities WHERE id='${activity}'`);
                    if (!tool) sql(`INSERT INTO learner_item_holdings (principal_id,item_id,quantity) VALUES ('${principal}','${catalog}',5)`);
                    if (scenario === 'owned-tool') sql(`INSERT INTO learner_tools (principal_id,tool_id) VALUES ('${principal}','${catalog}')`);
                    if (scenario === 'failed-roll') sql(`INSERT INTO learner_item_grants (principal_id,activity_id,play_run_id,roll,chance_basis_points,success,granted_items) VALUES ('${principal}','${activity}','${runs[i]}',10000,1,false,'[]');
                        INSERT INTO learner_activity_progress (principal_id,activity_id,status,completed_at) VALUES ('${principal}','${activity}','completed',NOW())`);
                }
                if (scenario === 'inventory-unavailable') {
                    for (let i = 0; i < 100; i++) extras.push(randomUUID());
                    sql(extras.map((id) => `INSERT INTO learning_items (id,slug,title,config) VALUES ('${id}','extra-${id}','Inventory bound ${id}','{}'); ${principals.map((principal) => `INSERT INTO learner_item_holdings (principal_id,item_id,quantity) VALUES ('${principal}','${id}',1);`).join('')}`).join('\n'));
                }
                const pages = await Promise.all(contexts.map((context) => context.newPage()));
                const errors: string[] = []; const legacy: string[] = []; const completions = [0, 0]; const grants = [0, 0];
                for (const [i, page] of pages.entries()) {
                    page.on('pageerror', (error) => errors.push(error.message));
                    page.on('request', (request) => {
                        const path = new URL(request.url()).pathname;
                        if (path.startsWith('/learning/')) legacy.push(path);
                        if (request.method() === 'POST' && path.endsWith('/complete')) completions[i]++;
                        if (request.method() === 'POST' && /\/grant-(items|tool)$/.test(path)) grants[i]++;
                    });
                }
                // Delay only: every request continues to the actual Rust server.
                // No fake response, receipt, inventory or Laravel emulation.
                const barriers = await Promise.all(pages.map((page) => barrier(page, scenario === 'owned-tool' || scenario === 'failed-roll' ? '**/complete' : '**/grant-items')));
                await Promise.all(pages.map((page, i) => page.goto(`http://localhost:8084/e2e/canonical-player-grant.html?run=${runs[i]}${i ? '&original' : ''}`)));
                if (!tool) {
                    for (const page of pages) await expect(page.getByText('Rolling for items...', { exact: true })).toBeVisible();
                    await compare(pages, 'loading', info);
                } else if (scenario === 'owned-tool') {
                    for (const page of pages) await expect(page.getByText('This tool is already available. Continuing...', { exact: true })).toBeVisible();
                    await compare(pages, 'already-owned', info);
                } else {
                    for (const page of pages) await expect(page.getByText('Keep this tool for later.', { exact: true })).toBeVisible();
                    await compare(pages, 'initial-tool', info);
                }
                barriers.forEach((release) => release());
                if (scenario === 'inventory-unavailable') {
                    for (const page of pages) await expect(page.getByText('The item grant could not be resolved right now.', { exact: true })).toBeVisible();
                    await compare(pages, 'inventory-error', info);
                    for (const page of pages) expect(await page.evaluate(() => (window as any).__grantCompletion)).toBeUndefined();
                    for (const principal of principals) expect(quantity(principal)).toBe('7');
                    sql(`DELETE FROM learning_items WHERE id IN (${extras.map((id) => `'${id}'`).join(',')})`);
                    await Promise.all(pages.map((page) => page.reload()));
                }
                if (!tool && scenario !== 'failed-roll') {
                    for (const page of pages) {
                        await expect(page.getByText('Item received:', { exact: true })).toBeVisible();
                        await expect(page.locator('.sr-only').filter({ hasText: 'Grant catalog fixture' })).toHaveCount(1);
                        await expect.poll(() => page.evaluate((id) => (window as any).__grantInventory?.find((item: any) => item.id === id)?.quantity, catalog)).toBe(7);
                    }
                    await compare(pages, 'received-items', info);
                    await Promise.all(pages.map((page) => page.reload()));
                    for (const [i, page] of pages.entries()) {
                        const control = page.getByRole('button', { name: 'Continue route', exact: true });
                        await bounded(page, control, viewport);
                        expect(quantity(principals[i])).toBe('7');
                        expect(sql(`SELECT COUNT(*) FROM learner_item_grants WHERE principal_id='${principals[i]}' AND activity_id='${activity}'`).trim()).toBe('1');
                        await guards(page, runs[i], activity, false);
                        if (scenario === 'items') {
                            sql(`UPDATE learner_route_progress SET status='completed' WHERE current_play_run_id='${runs[i]}'`);
                            try {
                                expect(await page.evaluate(async ({ run, activity }) => {
                                    const api = await import('/src/platform/playback-grant-api.ts');
                                    const first = api.completeGrantActivity(activity, run);
                                    const second = api.completeGrantActivity(activity, run);
                                    const shared = first === second;
                                    try { await first; return { shared, status: 200 }; }
                                    catch (error) { return { shared, status: (error as any).status }; }
                                }, { run: runs[i], activity })).toEqual({ shared: true, status: 404 });
                            } finally { sql(`UPDATE learner_route_progress SET status='in_progress' WHERE current_play_run_id='${runs[i]}'`); }
                        }
                        await control.click();
                    }
                }
                if (scenario === 'tool') {
                    sql(`UPDATE learner_route_progress SET status='completed' WHERE current_play_run_id IN ('${runs[0]}','${runs[1]}')`);
                    for (const [i, page] of pages.entries()) {
                        await bounded(page, page.getByRole('button', { name: 'Take tool', exact: true }), viewport);
                        await guards(page, runs[i], activity, true);
                        await page.getByRole('button', { name: 'Take tool', exact: true }).click();
                        await expect(page.getByText('The tool could not be added right now.', { exact: true })).toBeVisible();
                    }
                    await compare(pages, 'tool-error', info);
                    expect(sql(`SELECT COUNT(*) FROM learner_tools WHERE tool_id='${catalog}'`).trim()).toBe('0');
                    sql(`UPDATE learner_route_progress SET status='in_progress' WHERE current_play_run_id IN ('${runs[0]}','${runs[1]}')`);
                    for (const page of pages) await page.getByRole('button', { name: 'Take tool', exact: true }).click();
                }
                for (const [i, page] of pages.entries()) {
                    await expect.poll(() => page.evaluate(() => (window as any).__grantDestination)).toEqual({ id: next });
                    const completion = await page.evaluate(() => (window as any).__grantCompletion);
                    expect(completion.receipt).toMatchObject({ play_run_id: runs[i], next_activity_id: next, activity_state: { activity_id: activity, progress: { status: 'completed' } } });
                    expect(sql(`SELECT current_activity_id FROM learner_route_progress WHERE current_play_run_id='${runs[i]}'`).trim()).toBe(next);
                    expect(completions[i]).toBe(scenario === 'items' ? 2 : 1);
                    if (scenario === 'items') {
                        // Completed results belong only to this binding. A new
                        // authoritative document must never reuse an old receipt.
                        expect(await page.evaluate(async ({ run, activity }) => {
                            const api = await import('/src/platform/playback-grant-api.ts');
                            const { apiClient } = await import('/src/platform/api/client.ts');
                            const { bindPlaybackDocument } = await import('/src/platform/playback-context.ts');
                            const cached = await api.completeGrantActivity(activity, run);
                            const fresh = await apiClient.GET('/learner/play-runs/{play_run_id}', { params: { path: { play_run_id: run } } });
                            if (!fresh.data) throw new Error('Expected current Rust document.');
                            const release = bindPlaybackDocument(fresh.data);
                            try { await api.completeGrantActivity(activity, run); return { cached: cached.receipt.next_activity_id, status: 200 }; }
                            catch (error) { return { cached: cached.receipt.next_activity_id, status: (error as any).status }; }
                            finally { release(); }
                        }, { run: runs[i], activity })).toEqual({ cached: next, status: 404 });
                        expect(completions[i]).toBe(3);
                    }
                    if (scenario === 'tool') expect(await page.evaluate(() => (window as any).__grantSelectedTool?.id)).toBe(catalog);
                    if (scenario === 'owned-tool') expect(grants[i]).toBe(0);
                    if (scenario === 'failed-roll') expect(quantity(principals[i])).toBe('5');
                }
                expect(errors).toEqual([]); expect(legacy).toEqual([]);
                info.annotations.push({ type: 'evidence-scope', description: 'Whole pinned source controls with shared documented Rust UUID/transport seams. Separate real principals/runs; component evidence, not Laravel backend or full NodePlay acceptance.' });
            } finally {
                if (extras.length) sql(`DELETE FROM learning_items WHERE id IN (${extras.map((id) => `'${id}'`).join(',')})`);
                if (map) {
                    sql(`DELETE FROM learning_activity_transitions WHERE from_activity_id IN ('${activity}','${next}') OR to_activity_id IN ('${activity}','${next}')`);
                    expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
                }
                sql(`DELETE FROM ${tool ? 'learning_tools' : 'learning_items'} WHERE id='${catalog}'`);
                await admin.close(); for (const context of contexts) await context.close();
            }
            function quantity(principal: string) { return sql(`SELECT quantity FROM learner_item_holdings WHERE principal_id='${principal}' AND item_id='${catalog}'`).trim(); }
        });
    }
}

async function barrier(page: Page, pattern: string) {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route(pattern, async (route) => { await pending; await route.continue(); });
    return release;
}
async function guards(page: Page, run: string, activity: string, tool: boolean) {
    expect(await page.evaluate(async ({ run, activity, tool }) => {
        const api = await import('/src/platform/playback-grant-api.ts');
        const path = `/learning/activities/${activity}/grant-${tool ? 'tool' : 'items'}`;
        const status = async (url: string, play_run_id: unknown) => {
            try { await api.playbackGrantPost(url, { play_run_id }); return 200; } catch (error) { return (error as any).status; }
        };
        return [await status(`https://example.invalid${path}`, run), await status(path, crypto.randomUUID()), await status(path, 12), await status(path.replace(tool ? 'grant-tool' : 'grant-items', tool ? 'grant-items' : 'grant-tool'), run)];
    }, { run, activity, tool })).toEqual([501, 409, 400, 409]);
}
async function compare(pages: Page[], label: string, info: TestInfo) {
    for (const page of pages) { await page.evaluate(() => window.scrollTo(0, 0)); await page.mouse.move(0, 0); }
    const [copied, main] = pages.map((page) => page.getByTestId('grant-evidence'));
    expect(await copied.innerText()).toBe(await main.innerText()); expect(await copied.boundingBox()).toEqual(await main.boundingBox());
    for (const [i, page] of pages.entries()) await info.attach(`${label}-${i ? 'main' : 'canonical'}`, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
}
async function bounded(page: Page, control: ReturnType<Page['getByRole']>, viewport: { width: number; height: number }) {
    await control.scrollIntoViewIfNeeded(); await expect(control).toBeVisible(); const box = await control.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
