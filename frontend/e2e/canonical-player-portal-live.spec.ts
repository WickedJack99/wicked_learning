import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

test.beforeAll(() => {
    // The whole reference import tree, not only PortalActivity's own file.
    expect(execFileSync('git', ['diff', '--exit-code', '32c3113a5bc688c9944c20942cdf40a6a5d57d7f', '--', ':(top)resources/js', ':(top)resources/css/app.css']).length).toBe(0);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) for (const scenario of ['journey', 'recovery', 'automatic', 'automatic-recovery', 'automatic-return']) {
    const recovery = scenario === 'recovery'; const automatic = scenario.startsWith('automatic'); const automaticRecovery = scenario === 'automatic-recovery' || scenario === 'automatic-return';
    test(`whole portal ${scenario} at ${viewport.width}`, async ({ browser, baseURL }, info) => {
        test.setTimeout(100_000);
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owners = await Promise.all(['first', 'second'].map((name) => browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath(name as 'first' | 'second') })));
        const headers = async (context: typeof admin) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
        const adminHeaders = await headers(admin);
        const first = randomUUID(), output = randomUUID(), input = randomUUID(), targetPractice = randomUUID(), start = randomUUID(), targetStart = randomUUID();
        const profiles: Record<string, unknown>[] = []; const maps: string[] = []; const principals: string[] = [];
        try {
            const nodes = [];
            for (const [index, title] of ['Departure', 'Arrival'].entries()) {
                const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title, description: null, slug: null } }); expect(created.status()).toBe(201); maps.push(uuid((await created.json()).map_id));
                const made = await admin.request.post(`/api/v1/admin/world-builder/maps/${maps[index]}/nodes`, { headers: adminHeaders, data: { title: `${title} place`, description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } }); expect(made.status()).toBe(201);
                const node = await made.json(); uuid(node.node_id); uuid(node.asset_id); nodes.push(node);
                sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${maps[index]}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}'`);
            }
            sql(`INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config)
                SELECT '${first}',id,'first','First step','',0,NOW(),'open_practice','{"nextStep":"Prepare to travel."}' FROM learning_routes WHERE map_asset_id='${nodes[0].asset_id}';
                INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config)
                SELECT '${output}',id,'departure','Departure portal','',1,NOW(),'portal','{"portalMode":"output","portalSwirlEnabled":false}' FROM learning_routes WHERE map_asset_id='${nodes[0].asset_id}';
                INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config)
                SELECT '${input}',id,'arrival','Arrival portal','',0,NOW(),'portal','{"portalMode":"input","portalShowOnArrival":${!automatic},"portalSwirlEnabled":false}' FROM learning_routes WHERE map_asset_id='${nodes[1].asset_id}';
                INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config)
                SELECT '${targetPractice}',id,'independent','Independent target route','',1,NOW(),'open_practice','{}' FROM learning_routes WHERE map_asset_id='${nodes[1].asset_id}';
                INSERT INTO learning_activity_starts(id,node_id,activity_id,label) VALUES ('${start}','${nodes[0].node_id}','${first}','Departure route'),('${targetStart}','${nodes[1].node_id}','${targetPractice}','Independent route');
                INSERT INTO learning_activity_transitions(from_activity_id,to_activity_id,trigger,from_connector,label) VALUES ('${first}','${output}','completed','completed','Go to portal');
                INSERT INTO learning_portal_links(source_activity_id,target_activity_id,source_node_id,target_node_id,label) VALUES ('${output}','${input}','${nodes[0].node_id}','${nodes[1].node_id}','Linked arrival')`);
            for (const [index, owner] of owners.entries()) {
                const profileResponse = await owner.request.get('/api/v1/account/profile'); expect(profileResponse.status()).toBe(200);
                const { name, email, username, profile_image_id } = await profileResponse.json(); const profile = { name, email, username, profile_image_id }; profiles.push(profile);
                expect((await owner.request.patch('/api/v1/account/profile', { headers: await headers(owner), data: { ...profile, name: 'Portal comparison' } })).status()).toBe(200);
                const me = await owner.request.get('/api/v1/me'); expect(me.status()).toBe(200);
                const principal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim()); principals.push(principal);
                const entered = await owner.request.post(`/api/v1/learner/activity-starts/${start}/start`, { headers: await headers(owner) }); expect(entered.status()).toBe(200); const run = uuid((await entered.json()).play_run_id);
                expect((await owner.request.post(`/api/v1/learner/activity-starts/${targetStart}/start`, { headers: await headers(owner) })).status()).toBe(200);
                const targetProgress = () => sql(`SELECT row_to_json(p)::text FROM learner_route_progress p WHERE principal_id='${principal}' AND activity_start_id='${targetStart}'`).trim();
                const beforeTarget = targetProgress();
                const page = await owner.newPage(); const errors: string[] = []; const legacy: string[] = []; const commands: string[] = [];
                page.on('pageerror', (error) => errors.push(error.message));
                page.on('request', (request) => { const path = new URL(request.url()).pathname; if (request.method() === 'POST') commands.push(path); if (['fetch', 'xhr'].includes(request.resourceType()) && path.startsWith('/learning/')) legacy.push(path); });
                await page.addInitScript((original) => { window.name = original ? 'pinned-main' : 'canonical'; }, Boolean(index));
                await page.goto(`http://localhost:8084/learning/nodes/${nodes[0].node_id}/play?route=${start}&run=${run}`);
                await expect(page.getByText('Prepare to travel.', { exact: true })).toBeVisible();
                await activate(page, 'Go to portal', viewport.width, info);
                await page.getByRole('button', { name: 'Continue without answering', exact: true }).click();
                await expect(page.getByText('Linked arrival', { exact: true })).toBeVisible();
                await info.attach(`departure-${index ? 'main' : 'canonical'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
                const failure = page.getByRole('region', { name: 'Portal connection' });
                if (recovery) {
                    sql(`UPDATE learning_nodes SET state='locked' WHERE id='${nodes[1].node_id}'`);
                    await activate(page, 'Traverse', viewport.width, info);
                    await expect(failure).toBeVisible();
                    await boundedRecovery(page, viewport);
                    await info.attach(`travel-unavailable-${index ? 'main' : 'canonical'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
                    await expect(page.getByRole('heading', { name: 'A small pause after Departure portal', exact: true })).toHaveCount(0);
                    expect(sql(`SELECT status FROM learner_route_progress WHERE principal_id='${principal}' AND current_play_run_id='${run}'`).trim()).toBe('in_progress');
                    expect(sql(`SELECT count(*) FROM learner_portal_arrival_runs WHERE source_play_run_id='${run}'`).trim()).toBe('0');
                    await failure.getByRole('button', { name: 'Dismiss portal error', exact: true }).click();
                    await expect(failure).toHaveCount(0);
                    sql(`UPDATE learning_nodes SET state='available' WHERE id='${nodes[1].node_id}'`);
                    await page.route('**/portal/travel', async (route) => {
                        const response = await route.fetch(); expect(response.status()).toBe(200);
                        await route.abort('failed');
                    }, { times: 1 });
                    await activate(page, 'Traverse', viewport.width, info);
                    await expect(failure).toBeVisible();
                    await expect.poll(() => sql(`SELECT count(*) FROM learner_portal_arrival_runs WHERE source_play_run_id='${run}'`).trim()).toBe('1');
                    await failure.getByRole('button', { name: 'Retry portal', exact: true }).click();
                } else await activate(page, 'Traverse', viewport.width, info);
                await expect(page.getByRole('heading', { name: 'A small pause after Departure portal', exact: true })).toBeVisible();
                await expect(failure).toHaveCount(0);
                const arrival = uuid(sql(`SELECT id FROM learner_portal_arrival_runs WHERE source_play_run_id='${run}'`).trim());
                if (!recovery) {
                    await page.reload();
                    await expect(page.getByText('Linked arrival', { exact: true })).toBeVisible();
                    expect(new URL(page.url()).searchParams.get('run')).toBe(run);
                    await activate(page, 'Traverse', viewport.width, info);
                    await expect(page.getByRole('heading', { name: 'A small pause after Departure portal', exact: true })).toBeVisible();
                    expect(sql(`SELECT id FROM learner_portal_arrival_runs WHERE source_play_run_id='${run}'`).trim()).toBe(arrival);
                }
                if (!automatic) await page.getByLabel('Add a note (optional)', { exact: true }).fill('A private note before crossing.');
                if (recovery) {
                    sql(`UPDATE learning_nodes SET state='locked' WHERE id='${nodes[0].node_id}'`);
                    await page.getByRole('button', { name: 'Save note and continue', exact: true }).click();
                    await expect(page.getByText('The player action is currently unavailable.', { exact: true })).toBeVisible();
                    await expect(page.getByLabel('Add a note (optional)', { exact: true })).toHaveValue('A private note before crossing.');
                    sql(`UPDATE learning_nodes SET state='available' WHERE id='${nodes[0].node_id}'; UPDATE learning_nodes SET state='locked' WHERE id='${nodes[1].node_id}'`);
                }
                await info.attach(`departure-check-in-${index ? 'main' : 'canonical'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
                let arrivalAttempts = 0;
                let completedArrival = '';
                let completedProgress = '';
                let deniedStatus: number | undefined;
                if (automaticRecovery) await page.route('**/complete', async (route) => {
                    if (!decodeURIComponent(new URL(route.request().url()).pathname).endsWith(`/activities/id:${input}/complete`)) return route.continue();
                    arrivalAttempts++;
                    if (arrivalAttempts === 1) {
                        sql(`UPDATE learning_nodes SET state='locked' WHERE id='${nodes[1].node_id}'`);
                        const denied = await route.fetch(); deniedStatus = denied.status(); await route.fulfill({ response: denied });
                    } else if (arrivalAttempts === 2) {
                        const saved = await route.fetch(); expect(saved.status()).toBe(200);
                        completedArrival = sql(`SELECT row_to_json(r)::text FROM learner_portal_arrival_runs r WHERE id='${arrival}'`).trim();
                        completedProgress = sql(`SELECT row_to_json(p)::text FROM learner_activity_progress p WHERE principal_id='${principal}' AND activity_id='${input}'`).trim();
                        await route.abort('failed');
                    } else await route.continue();
                });
                await page.getByRole('button', { name: automatic ? 'Continue without answering' : 'Save note and continue', exact: true }).click();
                if (recovery) {
                    await expect(failure).toBeVisible();
                    await boundedRecovery(page, viewport);
                    await info.attach(`arrival-unavailable-${index ? 'main' : 'canonical'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
                    expect(new URL(page.url()).searchParams.get('run')).toBe(run);
                    sql(`UPDATE learning_nodes SET state='available' WHERE id='${nodes[1].node_id}'`);
                    await failure.getByRole('button', { name: 'Retry portal', exact: true }).click();
                }
                await expect(page).toHaveURL(new RegExp(`/learning/nodes/${nodes[1].node_id}/play\\?.*run=${arrival}`));
                if (automaticRecovery) {
                    await expect(failure).toBeVisible();
                    expect(deniedStatus).toBe(404);
                    await boundedRecovery(page, viewport, 'Return to map');
                    await expect(page.getByText('Continuing from this exit portal...', { exact: true })).toBeVisible();
                    expect(sql(`SELECT status FROM learner_portal_arrival_runs WHERE id='${arrival}'`).trim()).toBe('in_progress');
                    await info.attach(`automatic-unavailable-${index ? 'main' : 'canonical'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
                    sql(`UPDATE learning_nodes SET state='available' WHERE id='${nodes[1].node_id}'`);
                    if (scenario === 'automatic-return') {
                        const unfinishedProgress = sql(`SELECT row_to_json(p)::text FROM learner_activity_progress p WHERE principal_id='${principal}' AND activity_id='${input}'`).trim();
                        await failure.getByRole('button', { name: 'Return to map', exact: true }).click();
                        await expect(page).toHaveURL(/\/world\?map=[^&]+&focused=/);
                        expect(sql(`SELECT status FROM learner_portal_arrival_runs WHERE id='${arrival}'`).trim()).toBe('in_progress');
                        expect(sql(`SELECT count(*) FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${input}' AND status='completed'`).trim()).toBe('0');
                        expect(sql(`SELECT row_to_json(p)::text FROM learner_activity_progress p WHERE principal_id='${principal}' AND activity_id='${input}'`).trim()).toBe(unfinishedProgress);
                        expect(targetProgress()).toBe(beforeTarget);
                        expect(arrivalAttempts).toBe(1); expect(errors).toEqual([]); expect(legacy).toEqual([]);
                        await page.close();
                        continue;
                    }
                    await failure.getByRole('button', { name: 'Retry portal', exact: true }).click();
                    await expect(failure).toBeVisible();
                    expect(completedArrival).not.toBe('');
                    const completionUrl = `/api/v1/learner/play-runs/${arrival}/activities/id:${input}/complete`;
                    expect((await owner.request.post(completionUrl, { data: {} })).status()).toBe(403);
                    const peer = owners[1 - index];
                    expect((await peer.request.post(completionUrl, { headers: await headers(peer), data: {} })).status()).toBe(404);
                    expect((await owner.request.post(completionUrl.replace(input, output), { headers: await headers(owner), data: {} })).status()).toBe(404);
                    for (const [table, where] of [
                        ['learning_maps', `id='${maps[1]}'`], ['learning_nodes', `id='${nodes[1].node_id}'`],
                        ['learning_map_assets', `id='${nodes[1].asset_id}'`], ['learning_routes', `map_asset_id='${nodes[1].asset_id}'`],
                        ['learning_activities', `id='${input}'`],
                    ]) {
                        const timestamp = sql(`SELECT published_at FROM ${table} WHERE ${where}`).trim();
                        sql(`UPDATE ${table} SET published_at=NULL WHERE ${where}`);
                        try { expect((await owner.request.post(completionUrl, { headers: await headers(owner), data: {} })).status()).toBe(404); }
                        finally { sql(`UPDATE ${table} SET published_at='${timestamp}' WHERE ${where}`); }
                    }
                    sql(`UPDATE learning_nodes SET state='locked' WHERE id='${nodes[1].node_id}'`);
                    expect((await owner.request.post(completionUrl, { headers: await headers(owner), data: {} })).status()).toBe(404);
                    sql(`UPDATE learning_nodes SET state='available' WHERE id='${nodes[1].node_id}'; UPDATE learning_maps SET access_roles='["unassigned-portal-test-role"]' WHERE id='${maps[1]}'`);
                    expect((await owner.request.post(completionUrl, { headers: await headers(owner), data: {} })).status()).toBe(404);
                    sql(`UPDATE learning_maps SET access_roles='["public"]' WHERE id='${maps[1]}'`);
                    await failure.getByRole('button', { name: 'Retry portal', exact: true }).click();
                    await expect(failure).toHaveCount(0);
                    await expect.poll(() => arrivalAttempts).toBe(3);
                    await expect(page.getByRole('heading', { name: 'A small pause after Arrival portal', exact: true })).toBeVisible();
                    expect(sql(`SELECT row_to_json(r)::text FROM learner_portal_arrival_runs r WHERE id='${arrival}'`).trim()).toBe(completedArrival);
                    expect(sql(`SELECT row_to_json(p)::text FROM learner_activity_progress p WHERE principal_id='${principal}' AND activity_id='${input}'`).trim()).toBe(completedProgress);
                }
                if (!automatic) await expect(page.getByText('This portal is configured as the exit point for paths that arrive here.', { exact: true })).toBeVisible();
                else await expect(page.getByRole('heading', { name: 'A small pause after Arrival portal', exact: true })).toBeVisible();
                expect(new URL(page.url()).searchParams.get('activity_id')).toBe(input);
                expect(new URL(page.url()).searchParams.has('route')).toBe(false);
                expect(targetProgress()).toBe(beforeTarget);
                await info.attach(`arrival-${index ? 'main' : 'canonical'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
                if (!automatic) {
                    await page.reload(); await expect(page.getByText('This portal is configured as the exit point for paths that arrive here.', { exact: true })).toBeVisible();
                    await activate(page, 'Continue', viewport.width, info);
                }
                await expect(page.getByRole('heading', { name: 'A small pause after Arrival portal', exact: true })).toBeVisible();
                await page.getByRole('button', { name: 'Continue without answering', exact: true }).click();
                await expect(page).toHaveURL(/\/world\?map=[^&]+&focused=/);
                expect(sql(`SELECT note FROM learner_activity_check_ins WHERE principal_id='${principal}' AND activity_id='${output}' AND play_run_id='${run}'`).trim()).toBe(automatic ? '' : 'A private note before crossing.');
                expect(sql(`SELECT count(*) FROM learner_activity_check_ins WHERE principal_id='${principal}' AND activity_id='${input}'`).trim()).toBe('0');
                expect(sql(`SELECT completion_count FROM learner_route_progress WHERE principal_id='${principal}' AND current_play_run_id='${run}'`).trim()).toBe('1');
                expect(sql(`SELECT status FROM learner_portal_arrival_runs WHERE id='${arrival}'`).trim()).toBe('completed');
                expect((await owner.request.get(`/api/v1/learner/play-runs/${run}`)).status()).toBe(404);
                expect(targetProgress()).toBe(beforeTarget);
                expect(commands.filter((path) => path.endsWith('/portal/travel'))).toHaveLength(recovery ? 3 : 2);
                expect(commands.filter((path) => path.endsWith('/check-ins'))).toHaveLength(automatic ? 0 : recovery ? 2 : 1);
                expect(errors).toEqual([]); expect(legacy).toEqual([]);
                await page.close();
            }
        } finally {
            sql(`DELETE FROM learning_portal_links WHERE source_activity_id='${output}'; DELETE FROM learning_activity_transitions WHERE from_activity_id='${first}'`);
            for (const map of maps) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
            for (const [index, profile] of profiles.entries()) expect((await owners[index].request.patch('/api/v1/account/profile', { headers: await headers(owners[index]), data: profile })).status()).toBe(200);
            await Promise.all([admin.close(), ...owners.map((owner) => owner.close())]);
        }
    });
}
async function activate(page: Page, name: string, width: number, info: TestInfo) {
    const button = page.getByRole('button', { name, exact: true }); await expect(button).toBeVisible();
    const obstruction = await button.evaluate((element) => { const box = element.getBoundingClientRect(); const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2); return element.contains(hit) ? null : hit?.closest('aside')?.getAttribute('aria-label') ?? 'unknown'; });
    if (obstruction !== null && width === 390) { expect(obstruction).toBe('Player actions'); info.annotations.push({ type: 'source-defect', description: 'Inherited mobile toolbar obstruction: keyboard activation tests the lifecycle, not pointer acceptance.' }); await button.focus(); await button.press('Enter'); }
    else { expect(obstruction).toBeNull(); await button.click(); }
}
async function boundedRecovery(page: Page, viewport: { width: number; height: number }, dismiss = 'Dismiss portal error') {
    const region = page.getByRole('region', { name: 'Portal connection' });
    const bounds = await region.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width); expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    for (const name of ['Retry portal', dismiss]) {
        expect(await region.getByRole('button', { name, exact: true }).evaluate((element) => { const box = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); })).toBe(true);
    }
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
