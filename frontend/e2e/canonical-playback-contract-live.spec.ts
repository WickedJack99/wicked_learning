import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

// This proves a native read prerequisite, not activation of the copied player.
for (const kind of ['route', 'message', 'portal', 'revisit', 'recall', 'replay'] as const) {
    test(`native ${kind} playback identifies its authorized node and map`, async ({ browser, baseURL }) => {
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
        const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
        const anonymous = await browser.newContext({ baseURL });
        const csrf = await (await admin.request.get('/api/v1/security/csrf')).json();
        const headers = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': csrf.token };
        const subject = uuid((await (await owner.request.get('/api/v1/me')).json()).subject_id);
        const principal = uuid(localSql(`SELECT id FROM application_principals WHERE identity_subject_id = '${subject}'`).trim());
        let mapId: string | undefined;
        try {
            const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers, data: { title: `Playback ${randomUUID()}`, description: null, slug: null } });
            expect(created.status()).toBe(201);
            mapId = uuid((await created.json()).map_id);
            const node = await admin.request.post(`/api/v1/admin/world-builder/maps/${mapId}/nodes`, { headers, data: { title: 'Same playback place', slug: 'same-playback-place', description: 'A disposable playback identity fixture.', position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
            expect(node.status()).toBe(201);
            const { node_id: nodeId, asset_id: assetId } = await node.json();
            uuid(nodeId); uuid(assetId);
            const activityId = randomUUID(); const startId = randomUUID(); const runId = randomUUID(); const topicId = randomUUID();
            const type = kind === 'message' ? 'message_prompt' : kind === 'portal' ? 'portal' : kind === 'recall' ? 'question' : 'open_practice';
            const config = kind === 'message' ? { messageAudience: 'support', messageTopicId: topicId }
                : kind === 'portal' ? { portalMode: 'input' }
                : kind === 'recall' ? { prompt: 'A private recall question', allowMultiple: false, options: [{ key: 'answer-1', label: 'A', body: 'Answer', isCorrect: true }] } : {};
            // All fixtures are newly created and removed with their map. Direct
            // SQL seeds run kinds whose UI activation is still pending; it is
            // not evidence for their entry writers or author publication UI.
            localSql(`
                UPDATE learning_maps SET published_at = NOW(), access_roles = '["public"]' WHERE id = '${mapId}';
                UPDATE learning_nodes SET published_at = NOW() WHERE id = '${nodeId}';
                UPDATE learning_map_assets SET published_at = NOW() WHERE id = '${assetId}';
                UPDATE learning_routes SET published_at = NOW() WHERE map_asset_id = '${assetId}';
                INSERT INTO learning_message_topics (id,map_asset_id,slug,title) VALUES ('${topicId}','${assetId}','fixture','Fixture');
                INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config)
                    SELECT '${activityId}',id,'same-activity','Same activity','',0,NOW(),'${type}','${JSON.stringify(config)}'::jsonb FROM learning_routes WHERE map_asset_id = '${assetId}';
                INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${startId}','${nodeId}','${activityId}');
            `);
            if (kind === 'route' || kind === 'message') {
                localSql(`INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${nodeId}',route_id,id,'in_progress','${startId}','${runId}' FROM learning_activities WHERE id = '${activityId}'`);
            } else if (kind === 'portal') {
                const sourceNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${mapId}/nodes`, { headers, data: { title: 'Source portal', description: null, position_q: 1, position_r: 0, state: 'available', visual_config: {} } });
                expect(sourceNode.status()).toBe(201);
                const source = await sourceNode.json();
                uuid(source.node_id); uuid(source.asset_id);
                const sourceActivityId = randomUUID();
                localSql(`
                    UPDATE learning_nodes SET published_at = NOW() WHERE id = '${source.node_id}';
                    UPDATE learning_map_assets SET published_at = NOW() WHERE id = '${source.asset_id}';
                    UPDATE learning_routes SET published_at = NOW() WHERE map_asset_id = '${source.asset_id}';
                    INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config)
                        SELECT '${sourceActivityId}',id,'source-portal','Source portal','',0,NOW(),'portal','{"portalMode":"output"}'::jsonb FROM learning_routes WHERE map_asset_id = '${source.asset_id}';
                    INSERT INTO learning_portal_links (source_activity_id,target_activity_id,source_node_id,target_node_id) VALUES ('${sourceActivityId}','${activityId}','${source.node_id}','${nodeId}');
                    INSERT INTO learner_portal_arrival_runs (id,principal_id,source_play_run_id,source_activity_id,target_activity_id) VALUES ('${runId}','${principal}','${randomUUID()}','${sourceActivityId}','${activityId}');
                `);
            } else if (kind === 'revisit') {
                const checkInId = randomUUID();
                localSql(`INSERT INTO learner_activity_check_ins (id,principal_id,activity_id,play_run_id,note) VALUES ('${checkInId}','${principal}','${activityId}','${randomUUID()}','Fixture'); INSERT INTO learner_revisit_runs (id,principal_id,check_in_id,activity_id,revisit_reason) VALUES ('${runId}','${principal}','${checkInId}','${activityId}','later')`);
            } else {
                const table = kind === 'recall' ? 'learner_recall_runs' : 'learner_activity_replay_runs';
                localSql(`INSERT INTO ${table} (id,principal_id,activity_id) VALUES ('${runId}','${principal}','${activityId}')`);
            }
            const path = `/api/v1/learner/play-runs/${runId}`;
            const response = await owner.request.get(path);
            expect(response.status()).toBe(200);
            const playback = await response.json();
            expect(playback).toMatchObject({ run_kind: kind === 'message' ? 'route' : kind, play_run_id: runId, activity: { id: activityId }, context: { node_id: nodeId, map_id: mapId, node_slug: 'same-playback-place', node_title: 'Same playback place' } });
            const authored = await (await admin.request.get(`/api/v1/admin/world-builder/nodes/${nodeId}`)).json();
            expect(authored.activity_graph.activities).toEqual(expect.arrayContaining([expect.objectContaining({ id: playback.activity.id })]));
            expect(JSON.stringify(playback.activity.config)).not.toContain('isCorrect');
            expect((await peer.request.get(path)).status()).toBe(404);
            expect((await anonymous.request.get(path)).status()).toBe(401);
            localSql(`UPDATE learning_maps SET published_at = NULL WHERE id = '${mapId}'`);
            expect((await owner.request.get(path)).status()).toBe(404);
        } finally {
            if (mapId) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${mapId}`, { headers })).status()).toBe(204);
            await admin.close(); await owner.close(); await peer.close(); await anonymous.close();
        }
    });
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function localSql(sql: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
