import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { toDirectPlaybackPageProps } from '../src/platform/playback-projection';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

test('runless node reads preserve empty and unstarted source state without route authority', async ({ browser, baseURL }) => {
    expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
    const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
    const anonymous = await browser.newContext({ baseURL });
    const headers = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await admin.request.get('/api/v1/security/csrf')).json()).token };
    const activity = randomUUID();
    let map: string | undefined;
    try {
        const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers, data: { title: `Direct entry ${activity}`, description: null, slug: null } });
        expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
        const madeNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers, data: { title: 'Unstarted place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
        expect(madeNode.status()).toBe(201);
        const node = await madeNode.json(); uuid(node.node_id); uuid(node.asset_id);
        sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}'`);
        const path = `/api/v1/learner/nodes/${node.node_id}/playback`;
        const read = async () => { const response = await owner.request.get(path); expect(response.status()).toBe(200); return response.json(); };
        const noWrites = () => {
            expect(sql(`SELECT count(*) FROM learning_activity_starts WHERE node_id='${node.node_id}'`).trim()).toBe('0');
            expect(sql(`SELECT count(*) FROM learner_route_progress WHERE node_id='${node.node_id}'`).trim()).toBe('0');
            expect(sql(`SELECT count(*) FROM learner_activity_progress WHERE activity_id='${activity}'`).trim()).toBe('0');
            expect(sql(`SELECT count(*) FROM learner_evidence_events WHERE activity_id='${activity}'`).trim()).toBe('0');
        };
        const empty = toDirectPlaybackPageProps(await read());
        expect(empty.node.activities).toEqual([]); expect(empty.node.startRoutes).toEqual([]);
        expect(empty.playActivityId).toBeNull(); expect(empty.playRunId).toBeNull();
        expect(empty.progress).toEqual({ activities: {}, answers: {}, recallQuestionIds: [] });
        expect((await anonymous.request.get(path)).status()).toBe(401);
        noWrites();
        sql(`INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'direct','Direct activity','',0,NOW(),'open_practice','{"nextStep":"An unstarted activity"}' FROM learning_routes WHERE map_asset_id='${node.asset_id}'; UPDATE learning_nodes SET start_activity_id='${activity}' WHERE id='${node.node_id}'`);
        const populated = toDirectPlaybackPageProps(await read());
        expect(populated.node.activities.map((item) => item.id)).toEqual([activity]);
        expect(populated.node.startActivityId).toBe(activity);
        expect(populated.playActivityId).toBeNull(); expect(populated.playRouteId).toBeNull();
        const selected = await owner.request.get(`${path}?activity_id=${activity}`); expect(selected.status()).toBe(200);
        expect(toDirectPlaybackPageProps(await selected.json()).playActivityId).toBe(activity);
        expect((await owner.request.get(`/api/v1/learner/nodes/${node.node_id}/resume`)).status()).toBe(404);
        for (const state of ['locked', 'hidden']) {
            sql(`UPDATE learning_nodes SET state='${state}' WHERE id='${node.node_id}'`);
            expect((await owner.request.get(path)).status()).toBe(404);
        }
        sql(`UPDATE learning_nodes SET state='available' WHERE id='${node.node_id}'; UPDATE learning_maps SET access_roles='[]' WHERE id='${map}'`);
        expect((await owner.request.get(path)).status()).toBe(404);
        sql(`UPDATE learning_maps SET access_roles='["public"]',published_at=NULL WHERE id='${map}'`);
        expect((await owner.request.get(path)).status()).toBe(404);
        sql(`UPDATE learning_maps SET published_at=NOW() WHERE id='${map}'`);
        await read(); noWrites();
        const reachPath = `/api/v1/learner/nodes/${node.node_id}/activities/${activity}/reach`;
        expect((await anonymous.request.post(reachPath)).status()).toBe(401);
        const reachHeaders = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await owner.request.get('/api/v1/security/csrf')).json()).token };
        const reached = await owner.request.post(reachPath, { headers: reachHeaders }); expect(reached.status()).toBe(200);
        expect((await reached.json()).progress.status).toBe('reached');
        expect((await read()).private_state.activities).toEqual([{ activity_id: activity, status: 'reached', completed_at: null }]);
        expect(sql(`SELECT count(*) FROM learner_route_progress WHERE node_id='${node.node_id}'`).trim()).toBe('0');
        expect(sql(`SELECT count(*) FROM learner_evidence_events WHERE activity_id='${activity}'`).trim()).toBe('0');
        sql(`DELETE FROM learner_activity_progress WHERE activity_id='${activity}'`);
        noWrites();
        sql(`INSERT INTO learning_activities(id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT gen_random_uuid(),route_id,'overflow-' || n,'Overflow','',n,NOW(),'open_practice','{}' FROM learning_activities CROSS JOIN generate_series(1,1000) n WHERE id='${activity}'`);
        expect((await owner.request.get(path)).status()).toBe(503);
        noWrites();
    } finally {
        if (map) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers })).status()).toBe(204);
        await Promise.all([admin.close(), owner.close(), anonymous.close()]);
    }
});

function uuid(value: string) { expect(value).toMatch(/^[0-9a-f-]{36}$/i); return value; }
function sql(statement: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input: statement, encoding: 'utf8' }); }
