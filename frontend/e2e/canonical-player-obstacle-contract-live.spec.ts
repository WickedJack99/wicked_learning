import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

const pin = '32c3113a5bc688c9944c20942cdf40a6a5d57d7f';
for (const kind of ['route', 'replay'] as const) {
    for (const action of ['place', 'continue', 'tool'] as const) {
        for (const scope of action === 'tool' ? ['access', 'progress'] : ['access', 'inventory', 'progress']) {
            test(`native ${kind} obstacle ${action} preserves ${scope} contract`, async ({ browser, baseURL }, info) => {
                test.setTimeout(45_000);
                expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
                for (const path of ['app/Http/Controllers/LearningItemActivityController.php', 'app/Http/Controllers/LearningWorldController.php', 'app/Learning/Services/LearnerActivityAccessService.php', 'app/Learning/Services/ItemObstacleService.php', 'app/Learning/Services/ObstacleToolService.php', 'app/Learning/Services/LearnerProgressService.php']) {
                    expect(readFileSync(`../${path}`)).toEqual(execFileSync('git', ['show', `${pin}:${path}`]));
                }
                const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
                const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
                const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
                const anonymous = await browser.newContext({ baseURL });
                const headersFor = async (context: typeof owner) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
                const headers = await headersFor(owner); const adminHeaders = await headersFor(admin); const peerHeaders = await headersFor(peer); const anonymousHeaders = await headersFor(anonymous);
                const me = await owner.request.get('/api/v1/me'); expect(me.status()).toBe(200);
                const principal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim());
                const activity = randomUUID(); const start = randomUUID(); const run = randomUUID(); const catalog = randomUUID(); const slug = `obstacle-${catalog}`;
                const extras: string[] = []; let map: string | undefined;
                try {
                    const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Obstacle contract ${randomUUID()}`, description: null, slug: null } });
                    expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
                    const createdNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Obstacle place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
                    expect(createdNode.status()).toBe(201); const node = await createdNode.json(); uuid(node.node_id); uuid(node.asset_id);
                    const config = action === 'tool' ? { allowedToolIds: [slug], persistAfterSolved: true } : { slots: [{ itemId: slug, x: 50, y: 50, width: 10 }], consumeOnEachEntry: false };
                    sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}';
                        UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}';
                        UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                        INSERT INTO ${action === 'tool' ? 'learning_tools' : 'learning_items'} (id,slug,title,config) VALUES ('${catalog}','${slug}','Obstacle contract catalog','{}');
                        INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'obstacle','Obstacle activity','',0,NOW(),'${action === 'tool' ? 'obstacle' : 'item_obstacle'}','${JSON.stringify(config)}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                        INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}');`);
                    if (action === 'tool') sql(`INSERT INTO learner_tools (principal_id,tool_id) VALUES ('${principal}','${catalog}')`);
                    else sql(`INSERT INTO learner_item_holdings (principal_id,item_id,quantity) VALUES ('${principal}','${catalog}',${action === 'continue' ? 4 : 5})`);
                    if (action === 'continue') sql(`INSERT INTO learner_item_obstacle_states (principal_id,activity_id) VALUES ('${principal}','${activity}'); INSERT INTO learner_item_obstacle_slots (principal_id,activity_id,slot_index,item_id) VALUES ('${principal}','${activity}',0,'${catalog}')`);
                    if (kind === 'route') sql(`INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${run}' FROM learning_activities WHERE id='${activity}'`);
                    else sql(`INSERT INTO learner_activity_replay_runs (id,principal_id,activity_id) VALUES ('${run}','${principal}','${activity}')`);
                    const path = `/api/v1/learner/play-runs/${run}/activities/${encodeURIComponent(`id:${activity}`)}/${action === 'place' ? 'item-obstacle-slots/0' : action === 'continue' ? 'item-obstacle/continue' : 'use-obstacle-tool'}`;
                    const data = action === 'place' ? { item_slug: slug } : action === 'tool' ? { tool_slug: slug } : {};
                    const send = () => owner.request.post(path, { headers, data });
                    const facts = () => sql(`SELECT jsonb_build_object(
                        'holdings',(SELECT jsonb_agg(to_jsonb(h)) FROM learner_item_holdings h WHERE item_id='${catalog}'),
                        'slots',(SELECT jsonb_agg(to_jsonb(s)) FROM learner_item_obstacle_slots s WHERE activity_id='${activity}'),
                        'states',(SELECT jsonb_agg(to_jsonb(s)) FROM learner_item_obstacle_states s WHERE activity_id='${activity}'),
                        'passes',(SELECT jsonb_agg(to_jsonb(p)) FROM learner_obstacle_run_passes p WHERE activity_id='${activity}'),
                        'resolved',(SELECT jsonb_agg(to_jsonb(r)) FROM learner_obstacle_resolutions r WHERE activity_id='${activity}'),
                        'progress',(SELECT jsonb_agg(to_jsonb(p)) FROM learner_activity_progress p WHERE activity_id='${activity}'))`).trim();
                    const before = facts();
                    if (scope === 'progress') {
                        if (action === 'continue') {
                            sql(`DELETE FROM learner_item_obstacle_slots WHERE activity_id='${activity}'`);
                            const unmet = await send(); expect(unmet.status()).toBe(200);
                            expect((await unmet.json()).state).toMatchObject({ conditions_met: false, can_continue: false });
                            expect(sql(`SELECT status FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('reached');
                            expect(sql(`SELECT failed_attempts FROM learner_item_obstacle_states WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('1');
                            sql(`INSERT INTO learner_item_obstacle_slots (principal_id,activity_id,slot_index,item_id) VALUES ('${principal}','${activity}',0,'${catalog}')`);
                        }
                        expect((await send()).status()).toBe(200);
                        const status = action === 'continue' ? 'completed' : 'reached';
                        expect(sql(`SELECT status FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe(status);
                        const stamp = () => sql(`SELECT completed_at::text FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim();
                        const firstStamp = stamp();
                        expect((await send()).status()).toBe(200); expect(stamp()).toBe(firstStamp);
                        const playback = await owner.request.get(`/api/v1/learner/play-runs/${run}`); expect(playback.status()).toBe(200);
                        const document = await playback.json();
                        expect(document.activity.id).toBe(activity);
                        expect(document.private_state.activities).toContainEqual(expect.objectContaining({ activity_id: activity, status }));
                        if (action === 'place') expect(document.private_state.item_obstacles[0].state.conditions_met).toBe(true);
                        if (action === 'tool') expect(document.private_state.obstacle_resolutions).toContainEqual(expect.objectContaining({ activity_id: activity }));
                        if (action === 'continue') {
                            expect(firstStamp).not.toBe('');
                            const complete = await owner.request.post(`/api/v1/learner/play-runs/${run}/activities/${encodeURIComponent(`id:${activity}`)}/complete`, { headers, data: {} });
                            expect(complete.status()).toBe(200); expect(stamp()).toBe(firstStamp);
                        } else {
                            // A new reached event cannot downgrade completion
                            // from an earlier visit to the same activity.
                            sql(`UPDATE learner_activity_progress SET status='completed',completed_at='2026-01-01T00:00:00Z' WHERE principal_id='${principal}' AND activity_id='${activity}'`);
                            const previousStamp = stamp(); expect((await send()).status()).toBe(200);
                            expect(stamp()).toBe(previousStamp);
                            expect(sql(`SELECT status FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('completed');
                        }
                        if (action === 'tool') {
                            // The source only records a durable reached clear
                            // for persistent obstacles, not every useful tool.
                            sql(`DELETE FROM learner_activity_progress WHERE activity_id='${activity}'; DELETE FROM learner_obstacle_resolutions WHERE activity_id='${activity}'; UPDATE learning_activities SET activity_config=jsonb_set(activity_config,'{persistAfterSolved}','false') WHERE id='${activity}'`);
                            expect((await send()).status()).toBe(200);
                            expect(sql(`SELECT COUNT(*) FROM learner_activity_progress WHERE activity_id='${activity}'`).trim()).toBe('0');
                            expect(sql(`SELECT COUNT(*) FROM learner_obstacle_resolutions WHERE activity_id='${activity}'`).trim()).toBe('0');
                        }
                        return;
                    }
                    if (scope === 'inventory') {
                        for (let i = 0; i < 100; i++) extras.push(randomUUID());
                        sql(extras.map((id) => `INSERT INTO learning_items (id,slug,title,config) VALUES ('${id}','extra-${id}','Obstacle inventory ${id}','{}'); INSERT INTO learner_item_holdings (principal_id,item_id,quantity) VALUES ('${principal}','${id}',1);`).join('\n'));
                        expect((await send()).status()).toBe(503);
                        expect(facts()).toBe(before);
                        sql(`DELETE FROM learning_items WHERE id IN (${extras.map((id) => `'${id}'`).join(',')})`);
                        expect((await send()).status()).toBe(200);
                        expect(sql(`SELECT quantity FROM learner_item_holdings WHERE principal_id='${principal}' AND item_id='${catalog}'`).trim()).toBe('4');
                        return;
                    }
                    for (const state of ['locked', 'hidden']) {
                        sql(`UPDATE learning_nodes SET state='${state}' WHERE id='${node.node_id}'`);
                        try {
                            expect((await owner.request.get(`/api/v1/learner/play-runs/${run}`)).status()).toBe(404);
                            expect((await send()).status()).toBe(404); expect(facts()).toBe(before);
                        } finally { sql(`UPDATE learning_nodes SET state='available' WHERE id='${node.node_id}'`); }
                    }
                    for (const [table, predicate] of [['learning_maps', `id='${map}'`], ['learning_nodes', `id='${node.node_id}'`], ['learning_map_assets', `id='${node.asset_id}'`], ['learning_routes', `map_asset_id='${node.asset_id}'`], ['learning_activities', `id='${activity}'`]]) {
                        sql(`UPDATE ${table} SET published_at=NULL WHERE ${predicate}`);
                        try { expect((await send()).status()).toBe(404); } finally { sql(`UPDATE ${table} SET published_at=NOW() WHERE ${predicate}`); }
                    }
                    sql(`UPDATE learning_maps SET access_roles='[]' WHERE id='${map}'`);
                    try { expect((await send()).status()).toBe(404); } finally { sql(`UPDATE learning_maps SET access_roles='["public"]' WHERE id='${map}'`); }
                    expect((await peer.request.post(path, { headers: peerHeaders, data })).status()).toBe(404);
                    expect((await anonymous.request.post(path, { headers: anonymousHeaders, data })).status()).toBe(401);
                    expect((await owner.request.post(path, { data })).status()).toBe(403);
                    expect((await owner.request.post(path.replace(run, randomUUID()), { headers, data })).status()).toBe(404);
                    expect((await owner.request.post(path.replace(activity, randomUUID()), { headers, data })).status()).toBe(404);
                    expect(facts()).toBe(before);
                    sql(`UPDATE learning_nodes SET state='locked' WHERE id='${node.node_id}'; INSERT INTO learner_node_manual_unlocks (principal_id,node_id) VALUES ('${principal}','${node.node_id}')`);
                    expect((await owner.request.get(`/api/v1/learner/play-runs/${run}`)).status()).toBe(200);
                    const started = Date.now(); const result = await send(); const elapsed = Date.now() - started;
                    expect(result.status()).toBe(200); const first = await result.json();
                    if (action === 'tool') expect(first).toEqual({ is_resolved: true, is_useful: true });
                    else {
                        expect(first.state.conditions_met).toBe(true);
                        if (action === 'continue') expect(first.state.can_continue).toBe(true);
                        expect(first.inventory).toContainEqual(expect.objectContaining({ id: catalog, quantity: 4 }));
                    }
                    const after = facts();
                    sql(`UPDATE learner_node_manual_unlocks SET revoked_at=NOW() WHERE principal_id='${principal}' AND node_id='${node.node_id}'`);
                    expect((await send()).status()).toBe(404); expect(facts()).toBe(after);
                    sql(`UPDATE learning_nodes SET state='available' WHERE id='${node.node_id}'`);
                    expect((await send()).status()).toBe(200);
                    if (action !== 'tool') expect(sql(`SELECT quantity FROM learner_item_holdings WHERE principal_id='${principal}' AND item_id='${catalog}'`).trim()).toBe('4');
                    const table = kind === 'route' ? 'learner_route_progress' : 'learner_activity_replay_runs'; const column = kind === 'route' ? 'current_play_run_id' : 'id';
                    sql(`UPDATE ${table} SET status='completed'${kind === 'route' ? '' : ',completed_at=NOW()'} WHERE ${column}='${run}'`);
                    const completed = facts(); expect((await send()).status()).toBe(404); expect(facts()).toBe(completed);
                    expect(sql(`SELECT COUNT(*) FROM learner_activity_progress WHERE activity_id='${activity}' AND status='completed'`).trim()).toBe(action === 'continue' ? '1' : '0');
                    info.annotations.push({ type: 'obstacle-command-duration', description: `${kind}/${action}: ${elapsed} ms` });
                } finally {
                    if (map) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
                    if (extras.length) sql(`DELETE FROM learning_items WHERE id IN (${extras.map((id) => `'${id}'`).join(',')})`);
                    sql(`DELETE FROM ${action === 'tool' ? 'learning_tools' : 'learning_items'} WHERE id='${catalog}'`);
                    await admin.close(); await owner.close(); await peer.close(); await anonymous.close();
                }
            });
        }
    }
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
