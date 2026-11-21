import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) for (const failure of [false, true]) {
    test(`whole player page ${failure ? 'check-in retry' : 'journey'} at ${viewport.width}`, async ({ browser, baseURL }, info) => {
        test.setTimeout(100_000);
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        for (const path of ['pages/learning/node-play.tsx', 'features/world/activity-panel.tsx', 'features/world/learning-check-in.tsx', 'features/world/active-activity.ts', 'features/localization/activity-translation.ts', 'layouts/app-layout.tsx', 'layouts/app/app-sidebar-layout.tsx', 'features/world/standard-activities.tsx']) {
            expect(readFileSync(`../resources/js/${path}`)).toEqual(execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:resources/js/${path}`]));
        }
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owners = await Promise.all(['first', 'second'].map((name) => browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath(name as 'first' | 'second') })));
        const headersFor = async (context: typeof admin) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
        const adminHeaders = await headersFor(admin);
        const first = randomUUID(), second = randomUUID(), start = randomUUID(), alternative = randomUUID();
        const profiles: Record<string, unknown>[] = []; const principals: string[] = []; const runs: string[] = []; const errors: string[] = []; const legacy: string[] = [];
        let map: string | undefined;
        try {
            for (const owner of owners) {
                owner.setDefaultTimeout(8_000);
                const profileResponse = await owner.request.get('/api/v1/account/profile'); expect(profileResponse.status()).toBe(200);
                const { name, email, username, profile_image_id } = await profileResponse.json();
                const profile = { name, email, username, profile_image_id }; profiles.push(profile);
                expect((await owner.request.patch('/api/v1/account/profile', { headers: await headersFor(owner), data: { ...profile, name: 'Player comparison' } })).status()).toBe(200);
                const me = await owner.request.get('/api/v1/me'); expect(me.status()).toBe(200);
                principals.push(uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim()));
            }
            const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Player lifecycle ${first}`, description: null, slug: null } }); expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
            const madeNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Player place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } }); expect(madeNode.status()).toBe(201);
            const node = await madeNode.json(); uuid(node.node_id); uuid(node.asset_id);
            sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${first}',id,'first','First activity','',0,NOW(),'open_practice','{"nextStep":"First source step"}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${second}',id,'second','Second activity','',1,NOW(),'open_practice','{"nextStep":"Second source step"}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activity_starts(id,node_id,activity_id,label,sort_order) VALUES ('${start}','${node.node_id}','${first}','Primary route',0),('${alternative}','${node.node_id}','${second}','Alternative route',1);
                INSERT INTO learning_activity_transitions(from_activity_id,to_activity_id,trigger,from_connector,label) SELECT id,'${second}','completed','completed','Move to second' FROM learning_activities WHERE id='${first}';
                INSERT INTO learning_activity_transitions(from_activity_id,to_activity_id,trigger,from_connector) SELECT id,NULL,'completed','completed' FROM learning_activities WHERE id='${second}'`);
            const pages: Page[] = [];
            for (const [index, owner] of owners.entries()) {
                if (!failure) {
                    const invalidEntry = await owner.request.post(`/api/v1/learner/activity-starts/${start}/start?node_id=${randomUUID()}`, { headers: await headersFor(owner) });
                    expect(invalidEntry.status()).toBe(404);
                    expect(sql(`SELECT count(*) FROM learner_route_progress WHERE principal_id='${principals[index]}' AND activity_start_id='${start}'`).trim()).toBe('0');
                }
                const opened = await owner.request.post(`/api/v1/learner/activity-starts/${start}/start`, { headers: await headersFor(owner) }); expect(opened.status()).toBe(200); runs.push(uuid((await opened.json()).play_run_id));
                if (!failure) {
                    const progress = () => sql(`SELECT row_to_json(progress)::text FROM learner_route_progress AS progress WHERE principal_id='${principals[index]}' AND activity_start_id='${start}'`).trim();
                    const before = progress();
                    for (const command of ['start', 'reset']) {
                        for (const [query, status] of [[`node_id=${randomUUID()}`, 404], ['node_id=invalid', 400], [`node_id=${node.node_id}&node_id=${node.node_id}`, 400], [`node_id=${node.node_id}&principal_id=${principals[index]}`, 400]] as const) {
                            expect((await owner.request.post(`/api/v1/learner/activity-starts/${start}/${command}?${query}`, { headers: await headersFor(owner) })).status()).toBe(status);
                        }
                        expect((await owner.request.post(`/api/v1/learner/activity-starts/${start}/${command}?node_id=${node.node_id}`)).status()).toBe(403);
                    }
                    expect(progress()).toBe(before);
                }
                const page = await owner.newPage(); pages.push(page);
                await page.addInitScript((original) => { window.name = original ? 'pinned-main' : 'canonical'; }, Boolean(index));
                page.on('pageerror', (error) => errors.push(error.message));
                page.on('request', (request) => { if (['fetch', 'xhr'].includes(request.resourceType()) && new URL(request.url()).pathname.startsWith('/learning/')) legacy.push(request.url()); });
                if (!failure) {
                    const mutations: string[] = [];
                    const recordMutation = (request: import('@playwright/test').Request) => { if (request.method() !== 'GET') mutations.push(request.method() + ' ' + new URL(request.url()).pathname); };
                    page.on('request', recordMutation);
                    for (const [requestedNode, requestedStart, requestedRun, message] of [
                        [node.node_id, start, randomUUID(), 'The player is currently unavailable.'],
                        [randomUUID(), start, runs[index], 'The player context is unavailable.'],
                        [node.node_id, alternative, runs[index], 'The player context is unavailable.'],
                    ]) {
                        await page.goto(`http://localhost:8084/learning/nodes/${requestedNode}/play?route=${requestedStart}&run=${requestedRun}`);
                        await expect(page.getByText(message, { exact: true })).toBeVisible();
                        await expect(page.getByText('First source step', { exact: true })).toHaveCount(0);
                    }
                    expect(mutations).toEqual([]);
                    page.off('request', recordMutation);
                    await page.goto(`http://localhost:8084/learning/nodes/${randomUUID()}/play?route=${start}`);
                    await expect(page.getByText('The player entry is currently unavailable.', { exact: true })).toBeVisible();
                    expect(sql(`SELECT current_play_run_id FROM learner_route_progress WHERE principal_id='${principals[index]}' AND activity_start_id='${start}'`).trim()).toBe(runs[index]);
                }
                await page.goto(`http://localhost:8084/learning/nodes/${node.node_id}/play?route=${start}${failure ? `&run=${runs[index]}` : ''}`);
                await expect(page.getByText('First source step', { exact: true })).toBeVisible();
                expect(new URL(page.url()).searchParams.get('run')).toBe(runs[index]);
                await expect.poll(() => sql(`SELECT status FROM learner_activity_progress WHERE principal_id='${principals[index]}' AND activity_id='${first}'`).trim()).toBe('reached');
                await page.getByRole('button', { name: 'Bookmark this place', exact: true }).click();
                await expect(page.getByRole('button', { name: 'Remove place bookmark', exact: true })).toHaveAttribute('aria-pressed', 'true');
                await page.reload(); await expect(page.getByRole('button', { name: 'Remove place bookmark', exact: true })).toBeVisible();
                await page.getByText('Other routes', { exact: true }).click();
                const alternativeLink = page.getByRole('link').filter({ hasText: 'Alternative route' });
                await expect(alternativeLink).toHaveAttribute('href', `/learning/nodes/${node.node_id}/play?route=${alternative}`);
                await alternativeLink.click();
                await expect(page.getByText('Second source step', { exact: true })).toBeVisible();
                const alternativeRun = uuid(new URL(page.url()).searchParams.get('run')!);
                expect(alternativeRun).not.toBe(runs[index]);
                expect(new URL(page.url()).searchParams.get('route')).toBe(alternative);
                expect(sql(`SELECT current_play_run_id FROM learner_route_progress WHERE principal_id='${principals[index]}' AND activity_start_id='${alternative}'`).trim()).toBe(alternativeRun);
                await page.reload(); await expect(page.getByText('Second source step', { exact: true })).toBeVisible();
                expect(new URL(page.url()).searchParams.get('run')).toBe(alternativeRun);
                await page.getByText('Other routes', { exact: true }).click();
                await page.getByRole('link').filter({ hasText: 'Primary route' }).click();
                await expect(page.getByText('First source step', { exact: true })).toBeVisible();
                expect(new URL(page.url()).searchParams.get('run')).toBe(runs[index]);
                await bounded(page.getByRole('button', { name: 'Move to second', exact: true }), viewport);
                await page.getByRole('button', { name: 'From beginning', exact: true }).click();
                await expect.poll(() => new URL(page.url()).searchParams.get('run')).not.toBe(runs[index]);
                runs[index] = uuid(new URL(page.url()).searchParams.get('run')!);
                await expect(page.getByText('First source step', { exact: true })).toBeVisible();
            }
            await compare(pages, 'initial', info);
            for (const page of pages) {
                await activate(page, 'Move to second', viewport, info);
                await expect(page.getByRole('heading', { name: 'A small pause after First activity', exact: true })).toBeVisible();
                await page.getByRole('button', { name: 'Hide conclusion', exact: true }).click();
                await page.getByRole('button', { name: 'Show conclusion', exact: true }).click();
                await page.getByLabel('Add a note (optional)', { exact: true }).fill('An actual private observation.');
                await bounded(page.getByRole('button', { name: 'Something clicked', exact: false }), viewport);
            }
            await compare(pages, 'check-in', info);
            if (failure) {
                sql(`UPDATE learning_maps SET published_at=NULL WHERE id='${map}'`);
                for (const page of pages) {
                    await page.getByRole('button', { name: 'Something clicked', exact: false }).click();
                    await expect(page.getByText('The player action is currently unavailable.', { exact: true })).toBeVisible();
                    await expect(page.getByLabel('Add a note (optional)', { exact: true })).toHaveValue('An actual private observation.');
                    await bounded(page.getByText('The player action is currently unavailable.', { exact: true }), viewport);
                }
                expect(sql(`SELECT count(*) FROM learner_activity_check_ins WHERE activity_id='${first}'`).trim()).toBe('0');
                await compare(pages, 'retained-failure', info);
                sql(`UPDATE learning_maps SET published_at=NOW() WHERE id='${map}'`);
            }
            for (const [index, page] of pages.entries()) {
                const documents: string[] = []; page.on('request', (request) => { if (request.resourceType() === 'document') documents.push(request.url()); });
                await page.getByRole('button', { name: 'Something clicked', exact: false }).click();
                await expect(page.getByText('Second source step', { exact: true })).toBeVisible();
                await expect.poll(() => sql(`SELECT note FROM learner_activity_check_ins WHERE principal_id='${principals[index]}' AND activity_id='${first}' AND play_run_id='${runs[index]}'`).trim()).toBe('An actual private observation.');
                await expect.poll(() => sql(`SELECT status FROM learner_activity_progress WHERE principal_id='${principals[index]}' AND activity_id='${second}'`).trim()).toBe('reached');
                expect(documents).toEqual([]); expect(new URL(page.url()).searchParams.get('activity_id')).toBe(second);
            }
            await compare(pages, 'next-activity', info);
            for (const page of pages) {
                await activate(page, 'Continue', viewport, info);
                await expect(page.getByRole('heading', { name: 'A small pause after Second activity', exact: true })).toBeVisible();
                await page.getByRole('button', { name: 'Continue without answering', exact: true }).click();
                await expect(page).toHaveURL(/\/world\?map=[^&]+&focused=/);
            }
            expect(sql(`SELECT count(*) FROM learner_route_progress WHERE current_play_run_id IN ('${runs.join("','")}') AND status='completed'`).trim()).toBe('2');
            expect(sql(`SELECT count(*) FROM learner_activity_check_ins WHERE activity_id='${second}'`).trim()).toBe('0');
            expect(errors).toEqual([]); expect(legacy).toEqual([]);
        } finally {
            if (map) {
                sql(`DELETE FROM learning_activity_transitions WHERE from_activity_id IN ('${first}','${second}')`);
                expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
            }
            for (const [index, profile] of profiles.entries()) expect((await owners[index].request.patch('/api/v1/account/profile', { headers: await headersFor(owners[index]), data: profile })).status()).toBe(200);
            await Promise.all([admin.close(), ...owners.map((owner) => owner.close())]);
        }
    });
}
async function bounded(control: ReturnType<Page['getByRole']>, viewport: { width: number; height: number }) { await expect(control).toBeVisible(); await control.scrollIntoViewIfNeeded(); const box = await control.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1); expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1); }
async function compare(pages: Page[], name: string, info: TestInfo) { for (const page of pages) await page.mouse.move(0, 0); expect(await pages[0].locator('#learner-main-content').innerText()).toBe(await pages[1].locator('#learner-main-content').innerText()); for (const [index, page] of pages.entries()) await info.attach(`${name}-${index ? 'main' : 'canonical'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' }); }
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }

async function activate(page: Page, name: string, viewport: { width: number }, info: TestInfo) {
    const control = page.getByRole('button', { name, exact: true });
    const obstruction = await control.evaluate((element) => {
        const bounds = element.getBoundingClientRect(); const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        return element.contains(hit) ? null : hit?.closest('aside')?.getAttribute('aria-label');
    });
    if (viewport.width === 390) {
        expect(obstruction).toBe('Player actions');
        info.annotations.push({ type: 'source-defect', description: 'Pinned full-page mobile Player actions obscure the primary button center in both source trees. Keyboard activation remains usable; this is not accepted pointer-control parity.' });
        await control.focus(); await control.press('Enter');
    } else { expect(obstruction).toBeNull(); await control.click(); }
}
