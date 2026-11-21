import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

test('clean player return selects only the caller current source-ordered ordinary run', async ({ browser, baseURL }, info) => {
    expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
    const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
    const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
    const anonymous = await browser.newContext({ baseURL });
    const headersFor = async (context: typeof admin) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
    const adminHeaders = await headersFor(admin), ownerHeaders = await headersFor(owner);
    const activities = [randomUUID(), randomUUID()], starts = [randomUUID(), randomUUID()];
    let map: string | undefined;
    try {
        const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Resume ${activities[0]}`, description: null, slug: null } });
        expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
        const madeNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Resume place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
        expect(madeNode.status()).toBe(201);
        const node = await madeNode.json(); uuid(node.node_id); uuid(node.asset_id);
        sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}'`);
        for (const [index, activity] of activities.entries()) {
            sql(`INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'resume-${index}','Resume ${index}','',${index},NOW(),'open_practice','{"nextStep":"Resume practice"}' FROM learning_routes WHERE map_asset_id='${node.asset_id}'; INSERT INTO learning_activity_starts(id,node_id,activity_id,label,sort_order) VALUES ('${starts[index]}','${node.node_id}','${activity}','Resume ${index}',${index}); INSERT INTO learning_activity_transitions(from_activity_id,to_activity_id,trigger,from_connector) VALUES ('${activity}',NULL,'completed','completed')`);
        }
        const path = `/api/v1/learner/nodes/${node.node_id}/resume`;
        const progress = () => sql(`SELECT row_to_json(p)::text FROM learner_route_progress p WHERE node_id='${node.node_id}' ORDER BY principal_id,activity_start_id`);
        const timings: number[] = [];
        const resume = async (run: string, context = owner) => {
            const before = progress(), started = performance.now();
            const response = await context.request.get(path);
            timings.push(Math.round(performance.now() - started));
            expect(response.status()).toBe(200);
            const document = await response.json();
            expect(document.play_run_id).toBe(run); expect(document.node.id).toBe(node.node_id);
            expect(progress()).toBe(before);
        };
        const unavailable = async (context = owner) => {
            const before = progress();
            expect((await context.request.get(path)).status()).toBe(404);
            expect(progress()).toBe(before);
        };
        const enter = async (index: number, context = owner) => {
            const response = await context.request.post(`/api/v1/learner/activity-starts/${starts[index]}/start`, { headers: await headersFor(context) });
            expect(response.status()).toBe(200); return uuid((await response.json()).play_run_id);
        };
        const complete = async (run: string, index: number) => {
            const response = await owner.request.post(`/api/v1/learner/play-runs/${run}/activities/id:${activities[index]}/complete`, { headers: ownerHeaders, data: {} });
            expect(response.status()).toBe(200);
        };
        expect((await anonymous.request.get(path)).status()).toBe(401);
        await unavailable();
        expect((await owner.request.get(`/api/v1/learner/nodes/${randomUUID()}/resume`)).status()).toBe(404);
        const first = await enter(0), second = await enter(1);
        await resume(second); // Most recently entered unfinished route.
        await unavailable(peer);
        await complete(second, 1);
        await resume(first); // Unfinished outranks a newer completed route.
        await complete(first, 0);
        await resume(first); // All completed: most recently updated route.
        sql(`UPDATE learning_activities SET published_at=NULL WHERE id='${activities[0]}'`);
        await unavailable(); // Do not silently fall back to the older second route.
        sql(`UPDATE learning_activities SET published_at=NOW() WHERE id='${activities[0]}'; UPDATE learning_nodes SET state='locked' WHERE id='${node.node_id}'`);
        await unavailable();
        sql(`UPDATE learning_nodes SET state='available' WHERE id='${node.node_id}'; UPDATE learning_maps SET published_at=NULL WHERE id='${map}'`);
        await unavailable();
        sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["admin"]' WHERE id='${map}'`);
        await unavailable();
        sql(`UPDATE learning_maps SET access_roles='["public"]' WHERE id='${map}'`);
        await resume(first);
        const peerRun = await enter(1, peer);
        expect(peerRun).not.toBe(second); await resume(peerRun, peer); await resume(first);
        const restarted = await enter(1);
        expect(restarted).not.toBe(second); await resume(restarted);
        expect((await owner.request.get(`/api/v1/learner/play-runs/${second}`)).status()).toBe(404);
        expect(sql("SELECT count(*) FROM pg_indexes WHERE indexname='learner_route_progress_principal_node_idx'").trim()).toBe('1');
        expect(sql('SELECT success FROM _sqlx_migrations WHERE version=115').trim()).toBe('t');
        info.annotations.push({ type: 'resume-read-ms', description: timings.join(', ') });
    } finally {
        if (map) {
            sql(`DELETE FROM learning_activity_transitions WHERE from_activity_id IN ('${activities.join("','")}')`);
            expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
        }
        await Promise.all([admin.close(), owner.close(), peer.close(), anonymous.close()]);
    }
});

function uuid(value: string) { expect(value).toMatch(/^[0-9a-f-]{36}$/i); return value; }
function sql(statement: string) {
    return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input: statement, encoding: 'utf8' });
}
