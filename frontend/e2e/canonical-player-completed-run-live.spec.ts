import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

for (const kind of ['replay', 'revisit', 'portal'] as const) for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`whole copied ${kind} player check-in at ${viewport.width}`, async ({ browser, baseURL }, info) => {
        test.setTimeout(80_000);
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owners = await Promise.all(['first', 'second'].map((name) => browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath(name as 'first' | 'second') })));
        const headers = async (context: typeof admin) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
        const adminHeaders = await headers(admin);
        const activity = randomUUID(), source = randomUUID();
        const profiles: Record<string, unknown>[] = []; const principals: string[] = []; const runs: string[] = []; const pages: Page[] = []; const errors: string[] = [];
        let map: string | undefined;
        try {
            const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: 'Completed run comparison', description: null, slug: null } }); expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
            const createdNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Review place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } }); expect(createdNode.status()).toBe(201);
            const node = await createdNode.json(); uuid(node.node_id); uuid(node.asset_id);
            const config = kind === 'portal' ? '{"portalMode":"input","portalShowOnArrival":true}' : '{"nextStep":"A private return to this activity."}';
            sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'return','Return activity','',0,NOW(),'${kind === 'portal' ? 'portal' : 'open_practice'}','${config}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';`);
            if (kind === 'portal') sql(`INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${source}',id,'source','Source portal','',1,NOW(),'portal','{"portalMode":"output"}' FROM learning_routes WHERE map_asset_id='${node.asset_id}'`);
            for (const [index, owner] of owners.entries()) {
                owner.setDefaultTimeout(8_000);
                const { name, email, username, profile_image_id } = await (await owner.request.get('/api/v1/account/profile')).json();
                profiles.push({ name, email, username, profile_image_id });
                expect((await owner.request.patch('/api/v1/account/profile', { headers: await headers(owner), data: { ...profiles[index], name: 'Player comparison' } })).status()).toBe(200);
                const principal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await (await owner.request.get('/api/v1/me')).json()).subject_id)}'`).trim()); principals.push(principal);
                const run = randomUUID(); runs.push(run);
                if (kind === 'revisit') {
                    const invitation = randomUUID();
                    sql(`INSERT INTO learner_activity_check_ins(id,principal_id,activity_id,play_run_id,note) VALUES ('${invitation}','${principal}','${activity}','${randomUUID()}','Earlier observation'); INSERT INTO learner_activity_progress(principal_id,activity_id,status,completed_at,revisit_status,revisit_available_at,revisit_check_in_id) VALUES ('${principal}','${activity}','completed','2026-01-01T00:00:00Z','pending',NOW()-INTERVAL '1 day','${invitation}'); INSERT INTO learner_revisit_runs(id,principal_id,check_in_id,activity_id,revisit_reason) VALUES ('${run}','${principal}','${invitation}','${activity}','later')`);
                } else if (kind === 'portal') {
                    sql(`INSERT INTO learner_portal_arrival_runs(id,principal_id,source_play_run_id,source_activity_id,target_activity_id) VALUES ('${run}','${principal}','${randomUUID()}','${source}','${activity}')`);
                } else sql(`INSERT INTO learner_activity_replay_runs(id,principal_id,activity_id) VALUES ('${run}','${principal}','${activity}')`);
                const page = await owner.newPage(); pages.push(page);
                await page.addInitScript((original) => { window.name = original ? 'pinned-main' : 'canonical'; }, Boolean(index));
                page.on('pageerror', (error) => errors.push(error.message));
                await page.goto(`http://localhost:8084/learning/nodes/${node.node_id}/play?run=${run}`);
                await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible();
            }
            for (const [index, page] of pages.entries()) {
                await info.attach(`initial-${index ? 'main' : 'canonical'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
                const control = page.getByRole('button', { name: 'Continue', exact: true });
                await control.scrollIntoViewIfNeeded();
                const hit = await control.evaluate((element) => { const b = element.getBoundingClientRect(); const target = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return element.contains(target) ? null : target?.closest('aside')?.getAttribute('aria-label'); });
                if (hit === 'Player actions' && viewport.width === 390) {
                    info.annotations.push({ type: 'source-defect', description: 'The unchanged source toolbar obscures this primary control; keyboard lifecycle evidence is not pointer acceptance.' });
                    await control.focus(); await control.press('Enter');
                } else { expect(hit).toBeNull(); await control.click(); }
                await expect(page.getByRole('heading', { name: 'A small pause after Return activity', exact: true })).toBeVisible();
                await page.getByLabel('Add a note (optional)', { exact: true }).fill('A private note after this return.');
            }
            expect(await pages[0].locator('#learner-main-content').innerText()).toBe(await pages[1].locator('#learner-main-content').innerText());
            sql(`UPDATE learning_nodes SET state='locked' WHERE id='${node.node_id}'`);
            for (const page of pages) {
                await page.getByRole('button', { name: 'Save note and continue', exact: true }).click();
                await expect(page.getByText('The player action is currently unavailable.', { exact: true })).toBeVisible();
                await expect(page.getByLabel('Add a note (optional)', { exact: true })).toHaveValue('A private note after this return.');
            }
            sql(`UPDATE learning_nodes SET state='available' WHERE id='${node.node_id}'`);
            for (const [index, page] of pages.entries()) {
                await page.getByText('The player action is currently unavailable.', { exact: true }).scrollIntoViewIfNeeded();
                await info.attach(`retained-failure-${index ? 'main' : 'canonical'}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
                await page.getByRole('button', { name: 'Save note and continue', exact: true }).click();
                await expect(page).toHaveURL(/\/world\?map=[^&]+&focused=/);
                expect(sql(`SELECT note FROM learner_activity_check_ins WHERE principal_id='${principals[index]}' AND activity_id='${activity}' AND play_run_id='${runs[index]}'`).trim()).toBe('A private note after this return.');
                expect(sql(`SELECT count(*) FROM learner_route_progress WHERE principal_id='${principals[index]}' AND node_id='${node.node_id}'`).trim()).toBe('0');
            }
            expect(errors).toEqual([]);
        } finally {
            if (map) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
            for (const [index, profile] of profiles.entries()) expect((await owners[index].request.patch('/api/v1/account/profile', { headers: await headers(owners[index]), data: profile })).status()).toBe(200);
            await Promise.all([admin.close(), ...owners.map((owner) => owner.close())]);
        }
    });
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
