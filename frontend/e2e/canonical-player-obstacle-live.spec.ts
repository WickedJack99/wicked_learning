import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const scenario of ['items', 'item-reset', 'item-lock', 'tool', 'tool-transient', 'tool-revisit', 'tool-error'] as const) {
        const kind = scenario.startsWith('item') ? 'items' : 'tool';
        test(`whole copied ${scenario} obstacle uses Rust at ${viewport.width}`, async ({ browser, baseURL }, info) => {
            test.setTimeout(75_000);
            expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
            for (const path of ['features/world/item-obstacle-activity.tsx', 'features/world/obstacle-activity.tsx', 'features/world/activity-utils.tsx', 'components/app-side-action-bar.tsx', 'features/items/item-inventory.ts', 'features/tools/tool-selection.ts', 'features/tools/tool-visuals.ts', 'features/sounds/sound-player.ts']) {
                expect(readFileSync(`../resources/js/${path}`)).toEqual(execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:resources/js/${path}`]));
            }
            const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
            const contexts = await Promise.all(['first', 'second'].map((name) => browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath(name as 'first' | 'second') })));
            const headersFor = async (context: typeof admin) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
            const adminHeaders = await headersFor(admin); const headers = await Promise.all(contexts.map(headersFor));
            const principals: string[] = []; const preferences: any[] = [];
            for (const context of contexts) {
                context.setDefaultTimeout(8_000);
                const me = await context.request.get('/api/v1/me'); expect(me.status()).toBe(200);
                principals.push(uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim()));
                preferences.push(await (await context.request.get('/api/v1/learner/sound-preferences')).json());
            }
            const activity = randomUUID(); const next = randomUUID(); const start = randomUUID(); const catalog = randomUUID(); const wrong = randomUUID(); const sound = randomUUID();
            const runs = [randomUUID(), randomUUID()]; let map: string | undefined;
            try {
                for (const [i, context] of contexts.entries()) expect((await context.request.patch('/api/v1/learner/sound-preferences', { headers: headers[i], data: { ambience_volume: 100, effects_volume: 100, muted: false } })).status()).toBe(200);
                const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Obstacle browser ${randomUUID()}`, description: null, slug: null } });
                expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
                const createdNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Obstacle browser place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
                expect(createdNode.status()).toBe(201); const node = await createdNode.json(); uuid(node.node_id); uuid(node.asset_id);
                const config = kind === 'items' ? { slots: [{ itemId: `catalog-${catalog}`, x: 50, y: 35, width: 16 }], consumeOnEachEntry: scenario === 'item-reset',
                    sounds: Object.fromEntries(['notMet', 'transition', 'met'].map((key) => [key, { enabled: true, soundId: sound }])) } :
                    { allowedToolIds: [`catalog-${catalog}`], persistAfterSolved: scenario !== 'tool-transient', promptText: 'Find a useful tool.', successText: 'The way is open.', revisitText: 'This way is already open.', typingSpeed: 1, successAnimation: 'none', obstacleY: 28 };
                sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}';
                    UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                    INSERT INTO ${kind === 'items' ? 'learning_items' : 'learning_tools'} (id,slug,title,config) VALUES ('${catalog}','catalog-${catalog}','Useful catalog fixture','{}'),('${wrong}','catalog-${wrong}','Different catalog fixture','{}');
                    INSERT INTO learning_sounds (id,slug,name,icon,url,volume,play_seconds,loop,published_at) VALUES ('${sound}','${sound}','Obstacle sound fixture','music','/sounds/soft-chime.wav',30,1,FALSE,NOW());
                    INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'obstacle','Obstacle activity','',0,NOW(),'${kind === 'items' ? 'item_obstacle' : 'obstacle'}','${JSON.stringify(config)}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                    INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${next}',route_id,'next','Next activity','',1,NOW(),'open_practice','{}' FROM learning_activities WHERE id='${activity}';
                    INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}');
                    INSERT INTO learning_activity_transitions (from_activity_id,to_activity_id,from_connector,trigger,label) VALUES ('${activity}','${next}','completed','completed','Continue route');`);
                if (kind === 'items') sql(`UPDATE learning_items SET image_light='/images/tools/pattern-lens-light.svg',image_dark='/images/tools/pattern-lens-light.svg' WHERE id='${catalog}'`);
                for (const [i, principal] of principals.entries()) {
                    sql(`INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${runs[i]}' FROM learning_activities WHERE id='${activity}'`);
                    if (kind === 'items') sql(`INSERT INTO learner_item_holdings (principal_id,item_id,quantity) VALUES ('${principal}','${catalog}',5),('${principal}','${wrong}',3)`);
                    else sql(`INSERT INTO learner_tools (principal_id,tool_id) VALUES ('${principal}','${catalog}'),('${principal}','${wrong}')`);
                    if (scenario === 'item-lock') sql(`INSERT INTO learner_item_obstacle_states (principal_id,activity_id,locked_until) VALUES ('${principal}','${activity}','2030-01-01T12:00:00Z'); INSERT INTO learner_activity_progress (principal_id,activity_id,status) VALUES ('${principal}','${activity}','reached')`);
                    if (scenario === 'tool-revisit') sql(`INSERT INTO learner_obstacle_resolutions (principal_id,activity_id) VALUES ('${principal}','${activity}'); INSERT INTO learner_activity_progress (principal_id,activity_id,status) VALUES ('${principal}','${activity}','reached')`);
                }
                const pages = await Promise.all(contexts.map((context) => context.newPage())); const errors: string[] = []; const legacy: string[] = [];
                for (const page of pages) {
                    page.on('pageerror', (error) => errors.push(error.message));
                    page.on('request', (request) => { if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/learning/')) legacy.push(request.url()); });
                    await page.addInitScript(() => {
                        (window as any).__obstacleSounds = [];
                        const original = HTMLMediaElement.prototype.play;
                        HTMLMediaElement.prototype.play = function () {
                            const event = { url: this.src, volume: this.volume, loop: this.loop, played: false };
                            (window as any).__obstacleSounds.push(event);
                            const result = original.call(this);
                            void result.then(() => { event.played = true; }, () => {});
                            return result;
                        };
                    });
                }
                const url = (i: number) => `http://localhost:8084/learning/obstacle-evidence?run=${runs[i]}${i ? '&original' : ''}`;
                await Promise.all(pages.map((page, i) => page.goto(url(i))));
                for (const page of pages) await bounded(page.getByRole('button', { name: kind === 'items' ? 'Open inventory' : 'Open tools', exact: true }), viewport);
                if (kind === 'tool') for (const page of pages) await expect(page.getByText(scenario === 'tool-revisit' ? 'This way is already open.' : 'Find a useful tool.', { exact: true })).toBeVisible();
                await compare(pages, 'initial', info);
                if (scenario === 'tool-revisit') {
                    for (const [i, page] of pages.entries()) {
                        const control = page.getByRole('button', { name: 'Continue route', exact: true });
                        await bounded(control, viewport); await control.click();
                        await expect.poll(() => page.evaluate(() => (window as any).__obstacleDestination)).toEqual({ id: next });
                        expect(await page.evaluate(() => (window as any).__obstacleCompletion)).toBeUndefined();
                        expect(sql(`SELECT current_activity_id FROM learner_route_progress WHERE current_play_run_id='${runs[i]}'`).trim()).toBe(activity);
                    }
                    // The source's cleared-revisit control emits movement only.
                    // Its owning-page reach/navigation adapter remains separate.
                    expect(errors).toEqual([]); expect(legacy).toEqual([]); return;
                }
                await guards(pages[0], runs[0], activity, kind);
                if (kind === 'items') {
                    if (scenario === 'item-lock') {
                        for (const page of pages) {
                            await expect(page.getByText(/Locked until/)).toBeVisible();
                            await expect(page.getByRole('button', { name: 'Continue route', exact: true })).toBeDisabled();
                        }
                        sql(`UPDATE learner_item_obstacle_states SET locked_until='2020-01-01T12:00:00Z' WHERE activity_id='${activity}'`);
                        await Promise.all(pages.map((page) => page.reload()));
                        for (const page of pages) await expect(page.getByRole('button', { name: 'Continue route', exact: true })).toBeEnabled();
                    }
                    for (const [i, page] of pages.entries()) {
                        const audio = await page.request.get('/sounds/soft-chime.wav'); expect(audio.status()).toBe(200);
                        expect(await audio.body()).toEqual(readFileSync('../public/sounds/soft-chime.wav'));
                        const image = await page.request.get('/images/tools/pattern-lens-light.svg'); expect(image.status()).toBe(200);
                        expect(await image.body()).toEqual(readFileSync('../public/images/tools/pattern-lens-light.svg'));
                        sql(`UPDATE learner_route_progress SET status='completed' WHERE current_play_run_id='${runs[i]}'`);
                        expect((await drop(page, 'Useful catalog fixture')).status()).toBe(404);
                        await expect(page.getByText('That item cannot be placed there.', { exact: true })).toBeVisible();
                        expect(quantity(principals[i])).toBe('5');
                        sql(`UPDATE learner_route_progress SET status='in_progress' WHERE current_play_run_id='${runs[i]}'`);
                    }
                    await compare(pages, 'item-error', info);
                    for (const [i, page] of pages.entries()) {
                        expect((await drop(page, 'Useful catalog fixture')).status()).toBe(200);
                        await expect.poll(() => quantity(principals[i])).toBe('4');
                        await expect.poll(() => page.evaluate(() => (window as any).__obstacleSounds.filter((event: any) => event.played).length)).toBeGreaterThanOrEqual(2);
                        expect(await page.evaluate(() => (window as any).__obstacleSounds.every((event: any) => event.volume === 0.3 && event.loop === false))).toBe(true);
                        await page.keyboard.press('Escape');
                        await filledImage(page);
                    }
                    await compare(pages, 'filled', info);
                    await Promise.all(pages.map((page) => page.reload()));
                    for (const [i, page] of pages.entries()) {
                        await expect(page.getByRole('button', { name: 'Continue route', exact: true })).toBeVisible();
                        await filledImage(page);
                        expect((await drop(page, 'Useful catalog fixture')).status()).toBe(200); expect(quantity(principals[i])).toBe('4');
                        await page.keyboard.press('Escape');
                    }
                    await compare(pages, 'filled-refresh', info);
                } else {
                    if (scenario === 'tool-error') {
                        sql(`UPDATE learner_route_progress SET status='completed' WHERE current_play_run_id IN ('${runs[0]}','${runs[1]}')`);
                        for (const page of pages) {
                            await equip(page, 'Useful catalog fixture');
                            const denied = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/use-obstacle-tool'));
                            await page.getByRole('button', { name: 'Use an equipped tool on the gate', exact: true }).click();
                            expect((await denied).status()).toBe(404);
                            await expect(page.getByRole('button', { name: 'Use an equipped tool on the gate', exact: true })).toBeEnabled();
                            expect(await page.evaluate(() => (window as any).__obstacleCompletion)).toBeUndefined();
                        }
                        expect(sql(`SELECT COUNT(*) FROM learner_obstacle_resolutions WHERE activity_id='${activity}'`).trim()).toBe('0');
                        await compare(pages, 'tool-unavailable', info);
                        sql(`UPDATE learner_route_progress SET status='in_progress' WHERE current_play_run_id IN ('${runs[0]}','${runs[1]}')`);
                    }
                    for (const page of pages) {
                        await equip(page, 'Different catalog fixture');
                        await page.getByRole('button', { name: 'Use an equipped tool on the gate', exact: true }).click();
                        await expect(page.getByText('That tool does not seem useful here.', { exact: true })).toBeVisible();
                    }
                    await compare(pages, 'unhelpful-tool', info);
                    for (const page of pages) {
                        await equip(page, 'Useful catalog fixture');
                        await page.getByRole('button', { name: 'Use an equipped tool on the gate', exact: true }).click();
                        await expect(page.getByText('The way is open.', { exact: true })).toBeVisible();
                        await expect.poll(() => page.evaluate(() => (window as any).__obstacleCompletion?.receipt.next_activity_id)).toBe(next);
                    }
                    await compare(pages, 'cleared', info);
                }
                for (const [i, page] of pages.entries()) {
                    const control = page.getByRole('button', { name: 'Continue route', exact: true });
                    await bounded(control, viewport); await control.click();
                    await expect.poll(() => page.evaluate(() => (window as any).__obstacleDestination)).toEqual({ id: next });
                    expect((await page.evaluate(() => (window as any).__obstacleCompletion)).receipt).toMatchObject({ play_run_id: runs[i], next_activity_id: next });
                    expect(sql(`SELECT current_activity_id FROM learner_route_progress WHERE current_play_run_id='${runs[i]}'`).trim()).toBe(next);
                    if (scenario === 'item-reset') expect(sql(`SELECT COUNT(*) FROM learner_item_obstacle_slots WHERE principal_id='${principals[i]}' AND activity_id='${activity}'`).trim()).toBe('0');
                    if (kind === 'tool') expect(sql(`SELECT COUNT(*) FROM learner_obstacle_resolutions WHERE principal_id='${principals[i]}' AND activity_id='${activity}'`).trim()).toBe(scenario === 'tool-transient' ? '0' : '1');
                }
                if (scenario === 'tool-error') {
                    // Inherited source try/finally has no catch/inline error.
                    // Preserve and record the defect; do not hide the failure
                    // with a fabricated useful-tool result or completion.
                    expect(errors.length).toBeGreaterThanOrEqual(2);
                    expect(errors.every((error) => error.includes('The obstacle action is currently unavailable.'))).toBe(true);
                } else expect(errors).toEqual([]);
                expect(legacy).toEqual([]);
            } finally {
                if (map) {
                    sql(`DELETE FROM learning_activity_transitions WHERE from_activity_id IN ('${activity}','${next}') OR to_activity_id IN ('${activity}','${next}')`);
                    expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
                }
                sql(`DELETE FROM ${kind === 'items' ? 'learning_items' : 'learning_tools'} WHERE id IN ('${catalog}','${wrong}'); DELETE FROM learning_sounds WHERE id='${sound}'`);
                for (const [i, context] of contexts.entries()) {
                    expect((await context.request.patch('/api/v1/learner/sound-preferences', { headers: headers[i], data: preferences[i] })).status()).toBe(200);
                    await context.close();
                }
                await admin.close();
            }
            function quantity(principal: string) { return sql(`SELECT quantity FROM learner_item_holdings WHERE principal_id='${principal}' AND item_id='${catalog}'`).trim(); }
        });
    }
}
async function filledImage(page: Page) {
    const image = page.getByTestId('obstacle-evidence').locator('div.absolute.z-10.aspect-square img');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
}
async function guards(page: Page, run: string, activity: string, kind: string) {
    expect(await page.evaluate(async ({ run, activity, kind }) => {
        const api = await import('/src/platform/playback-obstacle-api.ts');
        const path = `/learning/activities/${activity}/${kind === 'items' ? 'item-obstacle-slot' : 'obstacle-tool'}`;
        const payload = kind === 'items' ? { play_run_id: run, item_id: crypto.randomUUID(), slot_index: 0 } : { play_run_id: run, tool_id: crypto.randomUUID() };
        const status = async (url: string, value: Record<string, unknown>) => {
            try { await api.playbackObstaclePost(url, value); return 200; } catch (error) { return (error as any).status; }
        };
        let premature: number;
        try { await api.completeObstacleActivity(activity, run); premature = 200; } catch (error) { premature = (error as any).status; }
        return {
            premature, foreign: await status(`https://example.invalid${path}`, payload),
            unbound: await status(path, { ...payload, play_run_id: crypto.randomUUID() }),
            invalid: await status(path, { ...payload, play_run_id: 12 }),
            absent: await status(path, payload),
            wrongType: await status(`/learning/activities/${activity}/${kind === 'items' ? 'obstacle-tool' : 'item-obstacle-continue'}`, payload),
        };
    }, { run, activity, kind })).toEqual({ premature: 404, foreign: 501, unbound: 409, invalid: 400, absent: 404, wrongType: 409 });
}
async function drop(page: Page, title: string) {
    const trigger = page.getByRole('button', { name: 'Open inventory', exact: true });
    if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
    const transfer = await page.evaluateHandle(() => new DataTransfer());
    await bounded(page.getByTitle(title, { exact: true }), page.viewportSize()!);
    await page.getByTitle(title, { exact: true }).dispatchEvent('dragstart', { dataTransfer: transfer });
    const response = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/item-obstacle-slots/0'));
    await page.getByTestId('obstacle-evidence').locator('div.absolute.z-10.aspect-square').dispatchEvent('drop', { dataTransfer: transfer });
    await transfer.dispose();
    return response;
}
async function equip(page: Page, title: string) {
    await page.getByRole('button', { name: 'Open tools', exact: true }).click();
    await bounded(page.getByTitle(title, { exact: true }), page.viewportSize()!);
    await page.getByTitle(title, { exact: true }).click();
}
async function compare(pages: Page[], label: string, info: TestInfo) {
    for (const page of pages) { await page.evaluate(() => window.scrollTo(0, 0)); await page.mouse.move(0, 0); }
    expect(await pages[0].getByTestId('obstacle-evidence').innerText()).toBe(await pages[1].getByTestId('obstacle-evidence').innerText());
    expect(await pages[0].getByTestId('obstacle-evidence').boundingBox()).toEqual(await pages[1].getByTestId('obstacle-evidence').boundingBox());
    for (const [i, page] of pages.entries()) await info.attach(`${label}-${i ? 'main' : 'canonical'}`, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
}
async function bounded(control: ReturnType<Page['getByRole']>, viewport: { width: number; height: number }) {
    await control.scrollIntoViewIfNeeded(); await expect(control).toBeVisible(); const box = await control.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
