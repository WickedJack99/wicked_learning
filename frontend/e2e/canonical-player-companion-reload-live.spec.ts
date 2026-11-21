import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) for (const dismiss of [false, true]) {
    test(`whole player retains local state across Companion refresh ${dismiss ? 'dismissal' : 'recovery'} at ${viewport.width}`, async ({ browser, baseURL }, info) => {
        test.setTimeout(90_000);
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owner = await browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath('first') });
        const headers = async (context: typeof admin) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
        const adminHeaders = await headers(admin);
        const first = randomUUID(), second = randomUUID(), start = randomUUID();
        let map: string | undefined;
        try {
            const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: 'Companion refresh comparison', description: null, slug: null } }); expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
            const made = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Refresh place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } }); expect(made.status()).toBe(201);
            const node = await made.json(); uuid(node.node_id); uuid(node.asset_id);
            const companion = JSON.stringify({ enabled: true, display_name: 'Refresh guide', mode: 'scripted', message: 'A real activity context.', dialogue_graph: { version: 1, start: 'end', nodes: [{ id: 'end', type: 'end', message: 'Continue exploring.' }] } });
            sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config,companion_config) SELECT '${first}',id,'first','First activity','',0,NOW(),'open_practice','{"nextStep":"First source step"}','${companion}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config,companion_config) SELECT '${second}',id,'second','Second activity','',1,NOW(),'open_practice','{"nextStep":"Second source step"}','${companion}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activity_starts(id,node_id,activity_id,label) VALUES ('${start}','${node.node_id}','${first}','Refresh route');
                INSERT INTO learning_activity_transitions(from_activity_id,to_activity_id,trigger,from_connector,label) VALUES ('${first}','${second}','completed','completed','Move to second'),('${second}',NULL,'completed','completed',NULL)`);
            for (const original of [false, true]) {
                const reset = await owner.request.post(`/api/v1/learner/activity-starts/${start}/reset`, { headers: await headers(owner) }); expect(reset.status()).toBe(200);
                const run = uuid((await reset.json()).play_run_id);
                const page = await owner.newPage(); const errors: string[] = []; const documents: string[] = [];
                page.on('pageerror', (error) => errors.push(error.message));
                await page.addInitScript((original) => { window.name = original ? 'pinned-main' : 'canonical'; }, original);
                let attempts = 0;
                await page.route(`**/api/v1/learner/companion?*activity_id=${second}*`, async (route) => {
                    attempts++;
                    if (attempts === 1) return route.fulfill({ status: 503, json: { title: 'Companion temporarily unavailable' } });
                    if (attempts === 2) return route.abort('failed');
                    return route.continue();
                });
                await page.goto(`http://localhost:8084/learning/nodes/${node.node_id}/play?route=${start}&run=${run}`);
                await expect(page.getByText('First source step', { exact: true })).toBeVisible();
                page.on('request', (request) => { if (request.resourceType() === 'document') documents.push(request.url()); });
                const move = page.getByRole('button', { name: 'Move to second', exact: true });
                if (viewport.width === 390) { await move.focus(); await move.press('Enter'); }
                else await move.click();
                await page.getByRole('button', { name: 'Continue without answering', exact: true }).click();
                await expect(page.getByText('Second source step', { exact: true })).toBeVisible();
                const failure = page.getByRole('region', { name: 'Companion connection' });
                await expect(failure).toBeVisible();
                await expect(failure).toContainText('Companion temporarily unavailable');
                // The source's player and check-in state remain mounted even
                // while the independent Companion projection cannot refresh.
                const complete = page.getByRole('button', { name: 'Continue', exact: true });
                if (viewport.width === 390) { await complete.focus(); await complete.press('Enter'); }
                else await complete.click();
                await page.getByLabel('Add a note (optional)', { exact: true }).fill('Keep this private draft during recovery.');
                if (dismiss) {
                    await failure.getByRole('button', { name: 'Dismiss Companion error', exact: true }).click();
                    await expect(failure).toHaveCount(0);
                    await expect(page.getByLabel('Add a note (optional)', { exact: true })).toHaveValue('Keep this private draft during recovery.');
                    expect(attempts).toBe(1); expect(documents).toEqual([]); expect(errors).toEqual([]);
                    await page.getByRole('button', { name: 'Save note and continue', exact: true }).click();
                    await expect(page).toHaveURL(/\/world\?map=[^&]+&focused=/);
                    expect(errors).toEqual([]);
                    await page.close();
                    continue;
                }
                await failure.getByRole('button', { name: 'Retry Companion', exact: true }).click();
                await expect(failure).toContainText('The Companion connection is unavailable.');
                await expect(page.getByLabel('Add a note (optional)', { exact: true })).toHaveValue('Keep this private draft during recovery.');
                const bounds = await failure.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width); expect(bounds!.y + bounds!.height).toBeLessThan(viewport.height);
                await info.attach(`companion-failure-${original ? 'main' : 'canonical'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
                const recovered = page.waitForResponse((response) => response.url().includes(`/api/v1/learner/companion?`) && response.url().includes(second) && response.status() === 200);
                await failure.getByRole('button', { name: 'Retry Companion', exact: true }).click();
                const recoveredContext = (await (await recovered).json()).context;
                expect(recoveredContext.activity.id).toBe(second); expect(recoveredContext.play_run_id).toBe(run);
                await expect(failure).toHaveCount(0);
                await expect(page.getByLabel('Add a note (optional)', { exact: true })).toHaveValue('Keep this private draft during recovery.');
                expect(attempts).toBe(3); expect(documents).toEqual([]); expect(errors).toEqual([]);
                expect(new URL(page.url()).searchParams.get('activity_id')).toBe(second);
                expect(new URL(page.url()).searchParams.get('run')).toBe(run);
                await page.getByRole('button', { name: 'Open Refresh guide', exact: true }).click();
                await expect(page.getByRole('dialog').getByText('Second activity', { exact: true })).toBeVisible();
                await info.attach(`companion-recovered-${original ? 'main' : 'canonical'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
                await page.close();
            }
        } finally {
            if (map) {
                sql(`DELETE FROM learning_activity_transitions WHERE from_activity_id IN ('${first}','${second}')`);
                expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
            }
            await owner.close(); await admin.close();
        }
    });
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
