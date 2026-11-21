import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

// Source LearnerActivityAccessService::assertCanPlay guards both grant writers.
// These native prerequisites do not claim copied-control or full-page parity.
for (const kind of ['route', 'replay'] as const) {
    for (const type of ['item_grant', 'tool_grant'] as const) {
        test(`native ${kind} ${type} rechecks availability before granting or replaying a receipt`, async ({ browser, baseURL }, info) => {
            test.setTimeout(45_000);
            expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
            const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
            const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
            const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
            const anonymous = await browser.newContext({ baseURL });
            const headersFor = async (context: typeof owner) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
            const adminHeaders = await headersFor(admin); const headers = await headersFor(owner);
            const peerHeaders = await headersFor(peer); const anonymousHeaders = await headersFor(anonymous);
            const me = await owner.request.get('/api/v1/me'); expect(me.status()).toBe(200);
            const principal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim());
            const activity = randomUUID(); const start = randomUUID(); const run = randomUUID(); const catalog = randomUUID();
            const slug = `grant-${catalog}`;
            let map: string | undefined;
            try {
                const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Grant contract ${randomUUID()}`, description: null, slug: null } });
                expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
                const createdNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Grant place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
                expect(createdNode.status()).toBe(201); const node = await createdNode.json(); uuid(node.node_id); uuid(node.asset_id);
                const config = type === 'item_grant' ? { items: [{ itemId: slug, quantity: 2 }], probabilityPercent: 100 } : { toolId: slug };
                sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}';
                    UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}';
                    UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                    INSERT INTO ${type === 'item_grant' ? 'learning_items' : 'learning_tools'} (id,slug,title,config) VALUES ('${catalog}','${slug}','Grant catalog fixture','{}');
                    INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'grant','Grant activity','',0,NOW(),'${type}','${JSON.stringify(config)}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                    INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}');`);
                if (type === 'item_grant') sql(`INSERT INTO learner_item_holdings (principal_id,item_id,quantity) VALUES ('${principal}','${catalog}',5)`);
                if (kind === 'route') sql(`INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${run}' FROM learning_activities WHERE id='${activity}'`);
                else sql(`INSERT INTO learner_activity_replay_runs (id,principal_id,activity_id) VALUES ('${run}','${principal}','${activity}')`);
                const path = `/api/v1/learner/play-runs/${run}/activities/${encodeURIComponent(`id:${activity}`)}/${type === 'item_grant' ? 'grant-items' : 'grant-tool'}`;
                const grant = () => owner.request.post(path, { headers });
                const facts = () => sql(`SELECT jsonb_build_object(
                    'items',(SELECT jsonb_agg(to_jsonb(h)) FROM learner_item_holdings h WHERE item_id='${catalog}'),
                    'tools',(SELECT jsonb_agg(to_jsonb(t)) FROM learner_tools t WHERE tool_id='${catalog}'),
                    'roll',(SELECT jsonb_agg(to_jsonb(g)) FROM learner_item_grants g WHERE activity_id='${activity}'),
                    'progress',(SELECT jsonb_agg(to_jsonb(p)) FROM learner_activity_progress p WHERE activity_id='${activity}'))`).trim();
                const before = facts();
                for (const state of ['locked', 'hidden']) {
                    sql(`UPDATE learning_nodes SET state='${state}' WHERE id='${node.node_id}'`);
                    try {
                        expect((await owner.request.get(`/api/v1/learner/play-runs/${run}`)).status()).toBe(404);
                        expect((await grant()).status()).toBe(404);
                        expect(facts()).toBe(before);
                    } finally { sql(`UPDATE learning_nodes SET state='available' WHERE id='${node.node_id}'`); }
                }
                for (const [table, predicate] of [
                    ['learning_maps', `id='${map}'`], ['learning_nodes', `id='${node.node_id}'`],
                    ['learning_map_assets', `id='${node.asset_id}'`], ['learning_routes', `map_asset_id='${node.asset_id}'`],
                    ['learning_activities', `id='${activity}'`],
                ]) {
                    sql(`UPDATE ${table} SET published_at=NULL WHERE ${predicate}`);
                    try { expect((await grant()).status()).toBe(404); } finally { sql(`UPDATE ${table} SET published_at=NOW() WHERE ${predicate}`); }
                }
                sql(`UPDATE learning_maps SET access_roles='[]' WHERE id='${map}'`);
                try { expect((await grant()).status()).toBe(404); } finally { sql(`UPDATE learning_maps SET access_roles='["public"]' WHERE id='${map}'`); }
                expect((await peer.request.post(path, { headers: peerHeaders })).status()).toBe(404);
                expect((await anonymous.request.post(path, { headers: anonymousHeaders })).status()).toBe(401);
                expect((await owner.request.post(path)).status()).toBe(403);
                expect((await owner.request.post(path.replace(run, randomUUID()), { headers })).status()).toBe(404);
                expect((await owner.request.post(path.replace(activity, randomUUID()), { headers })).status()).toBe(404);
                expect(facts()).toBe(before);
                // Evaluate the real learner-specific policy, not just a blanket
                // rejection of every node authored as locked.
                sql(`UPDATE learning_nodes SET state='locked' WHERE id='${node.node_id}'; INSERT INTO learner_node_manual_unlocks (principal_id,node_id) VALUES ('${principal}','${node.node_id}')`);
                expect((await owner.request.get(`/api/v1/learner/play-runs/${run}`)).status()).toBe(200);
                const started = Date.now(); const result = await grant(); const elapsed = Date.now() - started;
                expect(result.status()).toBe(200); const first = await result.json();
                const completedAt = () => sql(`SELECT completed_at::text FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim();
                const stamp = completedAt();
                expect(sql(`SELECT COUNT(*) FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}' AND status='completed'`).trim()).toBe(type === 'item_grant' ? '1' : '0');
                if (type === 'item_grant') expect(stamp).not.toBe('');
                const after = facts();
                sql(`UPDATE learner_node_manual_unlocks SET revoked_at=NOW() WHERE principal_id='${principal}' AND node_id='${node.node_id}'`);
                expect((await owner.request.get(`/api/v1/learner/play-runs/${run}`)).status()).toBe(404);
                expect((await grant()).status()).toBe(404); expect(facts()).toBe(after);
                sql(`UPDATE learning_nodes SET state='available' WHERE id='${node.node_id}'`);
                const repeated = await grant(); expect(repeated.status()).toBe(200);
                if (type === 'item_grant') {
                    expect(first).toMatchObject({ success: true, items: [{ slug, quantity: 2 }] });
                    expect(await repeated.json()).toEqual(first); expect(facts()).toBe(after);
                    expect(sql(`SELECT quantity FROM learner_item_holdings WHERE principal_id='${principal}' AND item_id='${catalog}'`).trim()).toBe('7');
                    expect(sql(`SELECT COUNT(*) FROM learner_item_grants WHERE activity_id='${activity}'`).trim()).toBe('1');
                } else {
                    expect(first).toMatchObject({ already_owned: false, tool: { id: catalog, slug } });
                    expect(await repeated.json()).toMatchObject({ already_owned: true, tool: first.tool }); expect(facts()).toBe(after);
                    expect(sql(`SELECT COUNT(*) FROM learner_tools WHERE principal_id='${principal}' AND tool_id='${catalog}'`).trim()).toBe('1');
                }
                // A saved item roll or already-owned tool must not bypass a
                // newly locked place. No private receipt is returned while locked.
                sql(`UPDATE learning_nodes SET state='locked' WHERE id='${node.node_id}'`);
                try { expect((await grant()).status()).toBe(404); expect(facts()).toBe(after); }
                finally { sql(`UPDATE learning_nodes SET state='available' WHERE id='${node.node_id}'`); }
                const table = kind === 'route' ? 'learner_route_progress' : 'learner_activity_replay_runs';
                const column = kind === 'route' ? 'current_play_run_id' : 'id';
                sql(`UPDATE ${table} SET status='completed'${kind === 'route' ? '' : ',completed_at=NOW()'} WHERE ${column}='${run}'`);
                try { expect((await grant()).status()).toBe(404); expect(facts()).toBe(after); }
                finally { sql(`UPDATE ${table} SET status='in_progress'${kind === 'route' ? '' : ',completed_at=NULL'} WHERE ${column}='${run}'`); }
                const shell = await owner.request.get('/api/v1/learner/shell'); expect(shell.status()).toBe(200);
                const inventory = await shell.json();
                if (type === 'item_grant') expect(inventory.items).toContainEqual(expect.objectContaining({ id: catalog, quantity: 7 }));
                else expect(inventory.tools).toContainEqual(expect.objectContaining({ id: catalog }));
                const playback = await owner.request.get(`/api/v1/learner/play-runs/${run}`);
                expect(playback.status()).toBe(200); const active = await playback.json();
                expect(active.activity.id).toBe(activity);
                if (type === 'item_grant') expect(active.private_state.activities).toContainEqual(expect.objectContaining({ activity_id: activity, status: 'completed' }));
                const complete = await owner.request.post(`/api/v1/learner/play-runs/${run}/activities/${encodeURIComponent(`id:${activity}`)}/complete`, { headers, data: {} });
                expect(complete.status()).toBe(200);
                expect(await complete.json()).toMatchObject({ status: 'completed', activity_state: { activity_id: activity, progress: { status: 'completed' } } });
                if (type === 'item_grant') {
                    expect(completedAt()).toBe(stamp);
                    const freshRun = randomUUID();
                    if (kind === 'route') sql(`UPDATE learner_route_progress SET current_play_run_id='${freshRun}',current_activity_id='${activity}',status='in_progress' WHERE principal_id='${principal}' AND current_play_run_id='${run}'`);
                    else sql(`INSERT INTO learner_activity_replay_runs (id,principal_id,activity_id) VALUES ('${freshRun}','${principal}','${activity}')`);
                    expect((await owner.request.post(path.replace(run, freshRun), { headers })).status()).toBe(200);
                    expect(sql(`SELECT quantity FROM learner_item_holdings WHERE principal_id='${principal}' AND item_id='${catalog}'`).trim()).toBe('9');
                    expect(sql(`SELECT COUNT(*) FROM learner_item_grants WHERE activity_id='${activity}'`).trim()).toBe('2');
                    expect(completedAt()).toBe(stamp);
                    expect((await owner.request.get(`/api/v1/learner/play-runs/${freshRun}`)).status()).toBe(200);
                }
                info.annotations.push({ type: 'native-grant-duration', description: `${kind}/${type}: ${elapsed} ms` });
            } finally {
                if (map) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
                sql(`DELETE FROM ${type === 'item_grant' ? 'learning_items' : 'learning_tools'} WHERE id='${catalog}'`);
                await admin.close(); await owner.close(); await peer.close(); await anonymous.close();
            }
        });
    }
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
