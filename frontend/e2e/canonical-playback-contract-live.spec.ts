import { verifyPlaybackReach, verifyReachEntryContext } from './canonical-playback-reach-evidence';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { verifyPlaybackNode } from './canonical-playback-node-evidence';
import { verifyPlaybackProjection } from './canonical-playback-projection-evidence';
import { verifyPlaybackReviews } from './canonical-playback-review-evidence';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';
import { verifyCompletedRunCheckIn } from './canonical-playback-check-in-evidence';

// These prove native graph/progression prerequisites, not copied-player activation.
for (const kind of ['route', 'message', 'portal', 'revisit', 'recall', 'replay'] as const) {
    test(`native ${kind} playback identifies its authorized node and map`, async ({ browser, baseURL }, info) => {
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
        const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
        const anonymous = await browser.newContext({ baseURL });
        const csrf = await (await admin.request.get('/api/v1/security/csrf')).json();
        const headers = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': csrf.token };
        const currentUser = await owner.request.get('/api/v1/me');
        expect(currentUser.status(), 'The disposable learner session must be valid before testing playback.').toBe(200);
        const subject = uuid((await currentUser.json()).subject_id);
        const principal = uuid(localSql(`SELECT id FROM application_principals WHERE identity_subject_id = '${subject}'`).trim());
        let mapId: string | undefined;
        let avatarId: string | undefined;
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
            const companionConfig: Record<string, unknown> = { enabled: true, mode: 'guided_ai', ai: { enabled: true }, dialogue_graph: { version: 1, start: 'ai', nodes: [
                { id: 'ai', type: 'ai', instruction: 'Use only authored context.', next: 'end', capabilities: ['current-context'], response_mode: 'message' },
                { id: 'end', type: 'end', message: 'Continue at your own pace.' },
            ] } };
            const avatarBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#123456"/></svg>');
            if (kind === 'replay') {
                const uploaded = await admin.request.post('/api/v1/admin/media-assets', { headers, multipart: { file: { name: 'run-avatar.svg', mimeType: 'image/svg+xml', buffer: avatarBytes } } });
                expect(uploaded.status()).toBe(201); avatarId = uuid((await uploaded.json()).asset.id);
                companionConfig.avatar_url = `/api/v1/admin/media-assets/${avatarId}/content`;
            }
            localSql(`UPDATE learning_activities SET companion_config='${JSON.stringify(companionConfig).replaceAll("'", "''")}' WHERE id='${activityId}'`);
            const companionPath = `/api/v1/learner/companion?surface=activity&activity_id=${activityId}&play_run_id=${runId}`;
            const companion = await owner.request.get(companionPath);
            expect(companion.status()).toBe(kind === 'recall' ? 404 : 200);
            if (kind !== 'recall') {
                expect((await companion.json()).context).toMatchObject({ activity: { id: activityId }, play_run_id: runId, route: ['route', 'message'].includes(kind) ? { id: startId, title: 'Current route' } : null });
            }
            if (avatarId) {
                const avatar = (await companion.json()).avatar_url;
                expect(new URL(avatar, baseURL).searchParams.get('play_run_id')).toBe(runId);
                const delivered = await owner.request.get(avatar); expect(delivered.status()).toBe(200); expect(await delivered.body()).toEqual(avatarBytes);
                expect((await peer.request.get(avatar)).status()).toBe(404);
                expect((await anonymous.request.get(avatar)).status()).toBe(401);
                expect((await owner.request.get(avatar.replace(runId, randomUUID()))).status()).toBe(404);
                expect((await owner.request.get(avatar.replace(avatarId, randomUUID()))).status()).toBe(404);
            }
            expect((await peer.request.get(companionPath)).status()).toBe(404);
            expect((await owner.request.get(companionPath.replace(activityId, randomUUID()))).status()).toBe(404);
            expect((await owner.request.get(companionPath.replace(runId, randomUUID()))).status()).toBe(404);
            expect((await owner.request.get(companionPath.replace(runId, 'invalid'))).status()).toBe(400);
            expect((await owner.request.get(`/api/v1/learner/companion?surface=world&play_run_id=${runId}`)).status()).toBe(400);
            const turn = { surface: 'activity', activity_id: activityId, play_run_id: runId, dialogue_node_id: 'ai', assistance_level: 'off' };
            const turnHeaders = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await owner.request.get('/api/v1/security/csrf')).json()).token };
            const off = await owner.request.post('/api/v1/learner/companion/turn', { headers: turnHeaders, data: turn });
            expect(off.status()).toBe(kind === 'recall' ? 422 : 200);
            if (kind !== 'recall') expect(await off.json()).toEqual({ node_id: 'ai', text: '', assistance_level: 'untracked', disclosure: null });
            expect((await peer.request.post('/api/v1/learner/companion/turn', { headers: { ...turnHeaders, 'X-CSRF-Token': (await (await peer.request.get('/api/v1/security/csrf')).json()).token }, data: turn })).status()).toBe(422);
            const props = verifyPlaybackProjection(playback);
            expect(props.recallQuestionId).toBe(kind === 'recall' ? activityId : null);
            expect(props.revisitActivityId).toBe(kind === 'revisit' ? activityId : null);
            expect(playback.node).toMatchObject({ id: nodeId, map_id: mapId, slug: 'same-playback-place', title: 'Same playback place', description: 'A disposable playback identity fixture.', q: 0, r: 0, state: 'available', is_bookmarked: false, topic: null, outgoing_portal_links: [] });
            info.annotations.push({ type: 'native-playback-read', description: `${kind}: ${Math.round(performance.now() - readStarted)} ms; ${Buffer.byteLength(JSON.stringify(playback))} bytes` });
            expect(playback).toMatchObject({ run_kind: kind === 'message' ? 'route' : kind, play_run_id: runId, activity: { id: activityId }, context: { node_id: nodeId, map_id: mapId, node_slug: 'same-playback-place', node_title: 'Same playback place' } });
            expect.soft(playback.graph).toMatchObject({ node_id: nodeId, activities: [expect.objectContaining({ id: activityId, slug: 'same-activity', activity_type: type, transitions: [] })] });
            await verifyPlaybackReach(owner, peer, runId, activityId, principal, nodeId, kind === 'recall', info);
            if (kind === 'route' || kind === 'recall') await verifyReachEntryContext(owner, runId, activityId, principal, kind === 'recall');
            if (kind === 'route') await verifyPlaybackNode(owner, peer, path, nodeId, mapId);
            const authored = await (await admin.request.get(`/api/v1/admin/world-builder/nodes/${nodeId}`)).json();
            expect(authored.activity_graph.activities).toEqual(expect.arrayContaining([expect.objectContaining({ id: playback.activity.id })]));
            expect(JSON.stringify(playback.activity.config)).not.toContain('isCorrect');
            expect(JSON.stringify(playback.graph)).not.toContain('isCorrect');
            if (kind === 'portal') expect(playback.graph.starts).toEqual([]);
            else expect(playback.graph.starts).toEqual([expect.objectContaining({ id: startId, activity_id: activityId })]);
            if (kind === 'route') {
                await verifyPlaybackReviews(owner, peer, path, nodeId, activityId, info);
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
            expect((await anonymous.request.post(`${path}/activities/${encodeURIComponent(`id:${activityId}`)}/reach`)).status()).toBe(401);
            localSql(`UPDATE learning_nodes SET state = 'locked' WHERE id = '${nodeId}'`);
            expect((await owner.request.get(path)).status()).toBe(404);
            expect((await owner.request.post(`${path}/activities/${encodeURIComponent(`id:${activityId}`)}/reach`, {
                headers: { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await owner.request.get('/api/v1/security/csrf')).json()).token },
            })).status()).toBe(404);
            localSql(`UPDATE learning_nodes SET state = 'available', visual_config = '{"schedule":{"lockAt":"2000-01-01T00:00:00Z"}}' WHERE id = '${nodeId}'`);
            expect((await owner.request.get(path)).status()).toBe(404);
            localSql(`UPDATE learning_nodes SET state = 'hidden', visual_config = '{}' WHERE id = '${nodeId}'`);
            expect((await owner.request.get(path)).status()).toBe(404);
            localSql(`UPDATE learning_nodes SET state = 'available' WHERE id = '${nodeId}'`);
            localSql(`UPDATE learning_maps SET published_at = NULL WHERE id = '${mapId}'`);
            expect((await owner.request.get(path)).status()).toBe(404);
            localSql(`UPDATE learning_maps SET published_at = NOW() WHERE id = '${mapId}'`);
            expect((await owner.request.get(path)).status()).toBe(200);
            if (kind === 'route' || kind === 'message') {
                const ownerCsrf = await (await owner.request.get('/api/v1/security/csrf')).json();
                const ownerHeaders = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': ownerCsrf.token };
                const completePath = `${path}/activities/${encodeURIComponent(`id:${activityId}`)}/complete`;
                if (kind === 'message') {
                    expect((await owner.request.post(`${path}/activities/${encodeURIComponent(`id:${activityId}`)}/support-request`, { headers: ownerHeaders, data: { body: 'Disposable completion regression request.' } })).status()).toBe(200);
                }
                const destinationId = randomUUID(); const destinationRouteId = randomUUID(); const transitionId = randomUUID();
                const originalRouteId = uuid(localSql(`SELECT route_id FROM learner_route_progress WHERE principal_id = '${principal}' AND current_play_run_id = '${runId}'`).trim());
                const foreignNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${mapId}/nodes`, { headers, data: { title: 'Other place', description: null, position_q: 2, position_r: 0, state: 'available', visual_config: {} } });
                expect(foreignNode.status()).toBe(201);
                const foreignAssetId = uuid((await foreignNode.json()).asset_id);
                const foreignActivityId = randomUUID();
                localSql(`
                    INSERT INTO learning_routes (id,map_asset_id,slug,title,description,position,published_at) VALUES ('${destinationRouteId}','${assetId}','completion-destination','Destination','',2,NOW());
                    INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) VALUES ('${destinationId}','${destinationRouteId}','same-activity','Finish next group','',0,NOW(),'open_practice','{}');
                    INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${foreignActivityId}',id,'foreign-destination','Foreign destination','',0,NOW(),'open_practice','{}' FROM learning_routes WHERE map_asset_id = '${foreignAssetId}';
                    UPDATE learning_routes SET published_at = NOW() WHERE map_asset_id = '${foreignAssetId}';
                    DELETE FROM learning_activity_transitions WHERE from_activity_id = '${activityId}';
                    INSERT INTO learning_activity_transitions (id,from_activity_id,to_activity_id,from_connector,trigger,created_at) VALUES ('${transitionId}','${activityId}','${destinationId}','completed','completed',NOW() - INTERVAL '1 second');
                    INSERT INTO learning_activity_transitions (from_activity_id,to_activity_id,from_connector,trigger,created_at) VALUES
                        ('${activityId}','${activityId}','completed','completed',NOW()),
                        ('${destinationId}',NULL,'completed','completed',NOW() - INTERVAL '1 second'),
                        ('${destinationId}','${activityId}','completed','completed',NOW());
                `);
                const progress = () => JSON.parse(localSql(`SELECT row_to_json(p) FROM (SELECT route_id,current_activity_id,status,completion_count FROM learner_route_progress WHERE principal_id = '${principal}' AND current_play_run_id = '${runId}') p`).trim());
                const initialProgress = progress();
                const peerCsrf = await (await peer.request.get('/api/v1/security/csrf')).json();
                expect((await peer.request.post(completePath, { headers: { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': peerCsrf.token }, data: {} })).status()).toBe(404);
                expect((await owner.request.post(completePath, { data: {} })).status()).toBe(403);
                expect((await anonymous.request.post(completePath, { data: {} })).status()).toBe(401);
                const invalidDestinations = [
                    [`UPDATE learning_activity_transitions SET to_activity_id = '${foreignActivityId}' WHERE id = '${transitionId}'`, `UPDATE learning_activity_transitions SET to_activity_id = '${destinationId}' WHERE id = '${transitionId}'`],
                    [`UPDATE learning_activities SET published_at = NULL WHERE id = '${destinationId}'`, `UPDATE learning_activities SET published_at = NOW() WHERE id = '${destinationId}'`],
                    [`UPDATE learning_routes SET published_at = NULL WHERE id = '${destinationRouteId}'`, `UPDATE learning_routes SET published_at = NOW() WHERE id = '${destinationRouteId}'`],
                    [`UPDATE learning_activities SET activity_type = 'question' WHERE id = '${destinationId}'`, `UPDATE learning_activities SET activity_type = 'open_practice' WHERE id = '${destinationId}'`],
                ];
                for (const [invalidate, restore] of invalidDestinations) {
                    localSql(invalidate);
                    expect.soft((await owner.request.post(completePath, { headers: ownerHeaders, data: {} })).status()).toBe(404);
                    expect.soft(progress()).toEqual(initialProgress);
                    localSql(restore);
                }
                const startedCompletion = performance.now();
                const advanced = await owner.request.post(completePath, { headers: ownerHeaders, data: {} });
                expect(advanced.status()).toBe(200);
                expect(await advanced.json()).toMatchObject({ play_run_id: runId, status: 'in_progress' });
                expect((await advanced.json()).activity_state).toMatchObject({ activity_id: activityId, progress: { activity_id: activityId, status: 'completed', completed_at: expect.any(String) } });
                expect((await advanced.json()).next_activity_id).toBe(destinationId);
                info.annotations.push({ type: 'native-cross-group-completion', description: `${kind}: ${Math.round(performance.now() - startedCompletion)} ms` });
                expect(progress()).toEqual({ route_id: originalRouteId, current_activity_id: destinationId, status: 'in_progress', completion_count: 0 });
                expect((await (await owner.request.get(path)).json()).activity.id).toBe(destinationId);
                expect((await owner.request.post(completePath, { headers: ownerHeaders, data: {} })).status()).toBe(404);
                const terminalPath = `${path}/activities/${encodeURIComponent(`id:${destinationId}`)}/complete`;
                const checkInPath = `${path}/activities/${encodeURIComponent(`id:${destinationId}`)}/check-ins`;
                const observation = { note: 'I followed the connection to another activity group.', next_direction: 'revisit' };
                expect((await owner.request.post(checkInPath, { headers: ownerHeaders, data: observation })).status()).toBe(404);
                const completed = await owner.request.post(terminalPath, { headers: ownerHeaders, data: {} });
                expect(completed.status()).toBe(200);
                expect(await completed.json()).toMatchObject({ play_run_id: runId, status: 'completed' });
                expect((await completed.json()).activity_state).toMatchObject({ activity_id: destinationId, progress: { activity_id: destinationId, status: 'completed', completed_at: expect.any(String) } });
                expect((await completed.json()).next_activity_id).toBeNull();
                const retriedTerminal = await owner.request.post(terminalPath, { headers: ownerHeaders, data: {} });
                expect(retriedTerminal.status()).toBe(200);
                await expect(retriedTerminal.json()).resolves.toEqual(await completed.json());
                const completedRead = await owner.request.get(path); expect(completedRead.status()).toBe(200);
                expect((await completedRead.json()).activity.id).toBe(destinationId);
                expect(progress()).toEqual({ route_id: originalRouteId, current_activity_id: destinationId, status: 'completed', completion_count: 1 });
                expect((await peer.request.post(checkInPath, { headers: { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': peerCsrf.token }, data: observation })).status()).toBe(404);
                expect((await owner.request.post(checkInPath, { data: observation })).status()).toBe(403);
                expect((await anonymous.request.post(checkInPath, { data: observation })).status()).toBe(401);
                localSql(`INSERT INTO learner_activity_progress (principal_id,activity_id,status,attempt_count) VALUES ('${principal}','${foreignActivityId}','completed',1)`);
                expect((await owner.request.post(`${path}/activities/${encodeURIComponent(`id:${foreignActivityId}`)}/check-ins`, { headers: ownerHeaders, data: observation })).status()).toBe(404);
                localSql(`UPDATE learning_activities SET published_at = NULL WHERE id = '${destinationId}'`);
                expect((await owner.request.post(checkInPath, { headers: ownerHeaders, data: observation })).status()).toBe(404);
                localSql(`UPDATE learning_activities SET published_at = NOW() WHERE id = '${destinationId}'`);
                const observed = await owner.request.post(checkInPath, { headers: ownerHeaders, data: observation });
                expect(observed.status()).toBe(200);
                expect(await observed.json()).toMatchObject({ activity_slug: 'same-activity', ...observation });
                expect((await observed.json()).activity_state).toEqual((await completed.json()).activity_state);
                expect(localSql(`SELECT count(*) FROM learner_activity_check_ins WHERE principal_id = '${principal}' AND activity_id = '${destinationId}' AND play_run_id = '${runId}'`).trim()).toBe('1');
                expect(localSql(`SELECT revisit_status FROM learner_activity_progress WHERE principal_id = '${principal}' AND activity_id = '${destinationId}'`).trim()).toBe('pending');
                // Legacy slugs still name the original route group; repeated
                // slugs must not silently select a different completed activity.
                const legacyObservation = await owner.request.post(`${path}/activities/same-activity/check-ins`, { headers: ownerHeaders, data: { note: 'Original group observation.' } });
                expect(legacyObservation.status()).toBe(200);
                expect(localSql(`SELECT count(*) FROM learner_activity_check_ins WHERE principal_id = '${principal}' AND activity_id = '${activityId}' AND play_run_id = '${runId}'`).trim()).toBe('1');
                const resetResponse = await owner.request.post(`/api/v1/learner/activity-starts/${startId}/reset`, { headers: ownerHeaders });
                expect(resetResponse.status()).toBe(200);
                const reset = await resetResponse.json();
                expect(reset).toMatchObject({ start_id: startId, activity_slug: 'same-activity', status: 'in_progress', completion_count: 1 });
                expect(reset.play_run_id).not.toBe(runId);
                expect((await owner.request.post(checkInPath, { headers: ownerHeaders, data: observation })).status()).toBe(404);
                expect((await owner.request.get(path)).status()).toBe(404);
                const resetPath = `/api/v1/learner/play-runs/${uuid(reset.play_run_id)}`;
                expect((await (await owner.request.get(resetPath)).json()).activity.id).toBe(activityId);
                // A null first edge must remain terminal even when a later
                // non-null edge exists, including in the message writer.
                localSql(`UPDATE learning_activity_transitions SET to_activity_id = NULL WHERE id = '${transitionId}'`);
                const resetCompletion = await owner.request.post(`${resetPath}/activities/same-activity/complete`, { headers: ownerHeaders, data: {} });
                expect(resetCompletion.status()).toBe(200);
                expect(await resetCompletion.json()).toMatchObject({ status: 'completed' });
                expect((await resetCompletion.json()).activity_state).toEqual((await advanced.json()).activity_state);
                expect(localSql(`SELECT completion_count FROM learner_route_progress WHERE principal_id = '${principal}' AND activity_start_id = '${startId}'`).trim()).toBe('2');
            } else {
                const ownerCsrf = await (await owner.request.get('/api/v1/security/csrf')).json();
                const ownerHeaders = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': ownerCsrf.token };
                const activityPath = `${path}/activities/${encodeURIComponent(`id:${activityId}`)}`;
                if (kind === 'recall') {
                    const answer = await owner.request.post(`${activityPath}/answer`, { headers: ownerHeaders, data: { option_keys: ['answer-1'] } });
                    expect(answer.status()).toBe(200);
                    expect((await answer.json()).activity_slug).toBe('same-activity');
                }
                if (kind === 'revisit') {
                    // An owned run alone cannot consume a revisit. It must
                    // still belong to the current due invitation.
                    expect((await owner.request.post(`${activityPath}/complete`, { headers: ownerHeaders, data: {} })).status()).toBe(404);
                    localSql(`INSERT INTO learner_activity_progress (principal_id,activity_id,status,attempt_count,revisit_status,revisit_available_at,revisit_check_in_id) SELECT '${principal}','${activityId}','completed',1,'pending',NOW() - INTERVAL '1 day',check_in_id FROM learner_revisit_runs WHERE id = '${runId}'`);
                }
                expect((await owner.request.post(`${activityPath}/check-ins`, { headers: ownerHeaders, data: { note: 'This run is not completed yet.' } })).status()).toBe(404);
                const completed = await owner.request.post(`${activityPath}/complete`, { headers: ownerHeaders, data: {} });
                expect(completed.status()).toBe(200);
                const receipt = await completed.json();
                expect(receipt.next_activity_id).toBeNull();
                expect(receipt.activity_state.activity_id).toBe(activityId);
                const persistedProgress = JSON.parse(localSql(`SELECT COALESCE(json_agg(p)->0,'null'::json) FROM (SELECT activity_id,status,to_char(completed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS completed_at FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activityId}') p`).trim());
                expect(receipt.activity_state.progress).toEqual(persistedProgress);
                if (kind === 'recall') expect(receipt.activity_state.progress).toBeNull();
                if (kind === 'portal') {
                    expect(localSql(`SELECT count(*) FROM learner_portal_arrival_runs WHERE id='${runId}' AND principal_id='${principal}' AND target_activity_id='${activityId}' AND status='completed' AND completed_at IS NOT NULL`).trim()).toBe('1');
                }
                const repeated = await owner.request.post(`${activityPath}/complete`, { headers: ownerHeaders, data: {} });
                expect(repeated.status()).toBe(kind === 'portal' ? 200 : 404);
                if (kind === 'portal') await expect(repeated.json()).resolves.toEqual(receipt);
                await verifyCompletedRunCheckIn(owner, peer, runId, activityId, principal, nodeId, kind === 'recall');
            }
            expect((await owner.request.get(path)).status()).toBe(404);
            expect((await owner.request.post(`${path}/activities/${encodeURIComponent(`id:${activityId}`)}/reach`, {
                headers: { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await owner.request.get('/api/v1/security/csrf')).json()).token },
            })).status()).toBe(404);
        } finally {
            if (mapId) {
                // Fixture cleanup only: the separate map-delete cascade can
                // collide when multiple destinations become null before their
                // source is deleted. This is recorded in the migration register.
                localSql(`DELETE FROM learning_activity_transitions WHERE from_activity_id IN (SELECT a.id FROM learning_activities a JOIN learning_routes r ON r.id=a.route_id JOIN learning_map_assets m ON m.id=r.map_asset_id WHERE m.map_id='${mapId}')`);
                expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${mapId}`, { headers })).status()).toBe(204);
            }
            if (avatarId) expect((await admin.request.delete(`/api/v1/admin/media-assets/${avatarId}`, { headers })).status()).toBe(204);
            await admin.close(); await owner.close(); await peer.close(); await anonymous.close();
        }
    });
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function localSql(sql: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
