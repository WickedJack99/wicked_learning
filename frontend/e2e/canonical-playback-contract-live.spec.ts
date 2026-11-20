import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

// This proves a native read prerequisite, not activation of the copied player.
for (const kind of ['route', 'message', 'portal', 'revisit', 'recall', 'replay'] as const) {
    test(`native ${kind} playback identifies its authorized node and map`, async ({ browser, baseURL }, info) => {
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
            const readStarted = performance.now();
            const response = await owner.request.get(path);
            expect(response.status()).toBe(200);
            const playback = await response.json();
            info.annotations.push({ type: 'native-playback-read', description: `${kind}: ${Math.round(performance.now() - readStarted)} ms; ${Buffer.byteLength(JSON.stringify(playback))} bytes` });
            expect(playback).toMatchObject({ run_kind: kind === 'message' ? 'route' : kind, play_run_id: runId, activity: { id: activityId }, context: { node_id: nodeId, map_id: mapId, node_slug: 'same-playback-place', node_title: 'Same playback place' } });
            expect.soft(playback.graph).toMatchObject({ node_id: nodeId, activities: [expect.objectContaining({ id: activityId, slug: 'same-activity', activity_type: type, transitions: [] })] });
            const authored = await (await admin.request.get(`/api/v1/admin/world-builder/nodes/${nodeId}`)).json();
            expect(authored.activity_graph.activities).toEqual(expect.arrayContaining([expect.objectContaining({ id: playback.activity.id })]));
            expect(JSON.stringify(playback.activity.config)).not.toContain('isCorrect');
            expect(JSON.stringify(playback.graph)).not.toContain('isCorrect');
            if (kind === 'portal') expect(playback.graph.starts).toEqual([]);
            else expect(playback.graph.starts).toEqual([expect.objectContaining({ id: startId, activity_id: activityId })]);
            if (kind === 'route') {
                const secondId = randomUUID(); const secondRouteId = randomUUID(); const secondStartId = randomUUID(); const draftId = randomUUID();
                const edgeIds = Array.from({ length: 4 }, () => randomUUID());
                const peerSubject = uuid((await (await peer.request.get('/api/v1/me')).json()).subject_id);
                const peerPrincipal = uuid(localSql(`SELECT id FROM application_principals WHERE identity_subject_id = '${peerSubject}'`).trim());
                const question = JSON.stringify({ prompt: 'Graph question', allowMultiple: false, options: [{ key: 'a', label: 'A', body: 'Choose', isCorrect: true }], feedbackCorrect: 'Hidden answer feedback', timeGuideMinutes: 7, evidenceObjective: 'Notice alternatives' });
                localSql(`
                    INSERT INTO learning_routes (id,map_asset_id,slug,title,description,position,published_at) VALUES ('${secondRouteId}','${assetId}','alternate','Alternate','',1,NOW());
                    INSERT INTO learning_activities (id,route_id,slug,title,description,introduction,position,published_at,activity_type,activity_config) VALUES ('${secondId}','${secondRouteId}','same-activity','Alternate question','','Exact source introduction',0,NOW(),'question','${question}');
                    INSERT INTO learning_activities (id,route_id,slug,title,description,position,activity_type,activity_config) VALUES ('${draftId}','${secondRouteId}','draft','Private draft','',1,'open_practice','{}');
                    INSERT INTO learning_activity_starts (id,node_id,activity_id,label,sort_order,button_color_light,image_light) VALUES ('${secondStartId}','${nodeId}','${secondId}','Alternate route',2,'#123456','/images/source-start.png');
                    UPDATE learning_nodes SET start_activity_id = '${secondId}' WHERE id = '${nodeId}';
                    INSERT INTO learning_activity_transitions (id,from_activity_id,to_activity_id,from_connector,to_connector,trigger,label) VALUES
                        ('${edgeIds[0]}','${activityId}','${secondId}','completed','in','completed','Next'),
                        ('${edgeIds[1]}','${activityId}','${activityId}','retry','in','completed','Retry'),
                        ('${edgeIds[2]}','${activityId}','${secondId}','choice','in','completed','Choice'),
                        ('${edgeIds[3]}','${secondId}',NULL,'completed',NULL,'completed','Finish');
                    INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id,completion_count) VALUES ('${peerPrincipal}','${nodeId}','${secondRouteId}','${secondId}','completed','${secondStartId}','${randomUUID()}',7);
                `);
                const expandedStarted = performance.now();
                const expandedResponse = await owner.request.get(path);
                expect(expandedResponse.status()).toBe(200);
                const expanded = await expandedResponse.json();
                info.annotations.push({ type: 'native-playback-graph-read', description: `${Math.round(performance.now() - expandedStarted)} ms; ${Buffer.byteLength(JSON.stringify(expanded))} bytes` });
                const graph = expanded.graph;
                expect(graph.start_activity_id).toBe(secondId);
                expect(graph.activities.map((activity) => activity.id)).toEqual([activityId, secondId]);
                expect(graph.activities.map((activity) => activity.slug)).toEqual(['same-activity', 'same-activity']);
                expect(graph.activities[0].transitions.map((edge) => edge.id).sort()).toEqual(edgeIds.slice(0, 3).sort());
                expect(graph.activities[1]).toMatchObject({ introduction: 'Exact source introduction', time_guide_minutes: 7, check_in: { objective: 'Notice alternatives' }, transitions: [{ id: edgeIds[3], to_activity_id: null, to_connector: 'in', label: 'Finish' }] });
                expect(graph.starts).toEqual([
                    expect.objectContaining({ id: startId, progress: expect.objectContaining({ play_run_id: runId, current_activity_id: activityId, status: 'in_progress', completion_count: 0 }) }),
                    expect.objectContaining({ id: secondStartId, activity_id: secondId, label: 'Alternate route', button_color_light: '#123456', image_light: '/images/source-start.png', progress: null }),
                ]);
                expect(JSON.stringify(graph)).not.toContain('Private draft');
                expect(JSON.stringify(graph)).not.toContain('isCorrect');
                expect(JSON.stringify(graph)).not.toContain('Hidden answer feedback');
                const brokenEdgeId = randomUUID();
                localSql(`INSERT INTO learning_activity_transitions (id,from_activity_id,to_activity_id,from_connector,trigger) VALUES ('${brokenEdgeId}','${activityId}','${draftId}','unavailable','completed')`);
                expect((await owner.request.get(path)).status()).toBe(503);
                localSql(`DELETE FROM learning_activity_transitions WHERE id = '${brokenEdgeId}'; UPDATE learning_activities SET activity_config = '{}' WHERE id = '${secondId}'`);
                expect((await owner.request.get(path)).status()).toBe(503);
                localSql(`UPDATE learning_activities SET activity_config = '${question}' WHERE id = '${secondId}'; INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT gen_random_uuid(),'${secondRouteId}','overflow-' || n,'Overflow','',n,NOW(),'open_practice','{}' FROM generate_series(2,1001) AS n`);
                expect((await owner.request.get(path)).status()).toBe(503);
                localSql(`DELETE FROM learning_activities WHERE route_id = '${secondRouteId}' AND slug LIKE 'overflow-%'`);
                expect((await owner.request.get(path)).status()).toBe(200);
                localSql(`INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT gen_random_uuid(),'${secondRouteId}','scale-' || n,'Scale fixture','',n,NOW(),'open_practice','{}' FROM generate_series(2,101) AS n`);
                const scaledStarted = performance.now();
                const scaledResponse = await owner.request.get(path);
                expect(scaledResponse.status()).toBe(200);
                const scaled = await scaledResponse.json();
                expect(scaled.graph.activities).toHaveLength(102);
                info.annotations.push({ type: 'native-playback-graph-scale', description: `102 activities: ${Math.round(performance.now() - scaledStarted)} ms; ${Buffer.byteLength(JSON.stringify(scaled))} bytes` });
                localSql(`DELETE FROM learning_activities WHERE route_id = '${secondRouteId}' AND slug LIKE 'scale-%'`);
            }

            expect((await peer.request.get(path)).status()).toBe(404);
            expect((await anonymous.request.get(path)).status()).toBe(401);
            localSql(`UPDATE learning_nodes SET state = 'locked' WHERE id = '${nodeId}'`);
            expect((await owner.request.get(path)).status()).toBe(404);
            localSql(`UPDATE learning_nodes SET state = 'available', visual_config = '{"schedule":{"lockAt":"2000-01-01T00:00:00Z"}}' WHERE id = '${nodeId}'`);
            expect((await owner.request.get(path)).status()).toBe(404);
            localSql(`UPDATE learning_nodes SET state = 'hidden', visual_config = '{}' WHERE id = '${nodeId}'`);
            expect((await owner.request.get(path)).status()).toBe(404);
            localSql(`UPDATE learning_nodes SET state = 'available' WHERE id = '${nodeId}'`);
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
