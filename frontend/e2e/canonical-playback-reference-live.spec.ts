import { verifyPlaybackReach } from './canonical-playback-reach-evidence';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext } from '@playwright/test';
import { verifyPlaybackProjection } from './canonical-playback-projection-evidence';
import { toDirectPlaybackPageProps, toSourceActivityReceipt } from '../src/platform/playback-projection';
import { verifyPlaybackPortals } from './canonical-playback-node-evidence';
import { verifyPlaybackSharedState } from './canonical-playback-shared-evidence';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

const types = ['open_practice', 'question', 'reflection', 'review', 'markdown', 'tool_grant', 'item_grant', 'item_obstacle', 'obstacle', 'message_prompt', 'message_wall', 'npc_dialogue', 'shared_task', 'portal'] as const;

// Native command prerequisites for the whole copied player. This deliberately
// does not mount a partial player or use a reconstructed frontend as evidence.
for (const type of types) {
    test(`native ${type} player resolves exact activity references`, async ({ browser, baseURL }, info) => {
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
        const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
        const headersFor = async (context: typeof owner) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
        const adminHeaders = await headersFor(admin); const headers = await headersFor(owner); const peerHeaders = await headersFor(peer);
        const me = await owner.request.get('/api/v1/me'); expect(me.status()).toBe(200);
        const subject = uuid((await me.json()).subject_id);
        const principal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id = '${subject}'`).trim());
        const activity = randomUUID(); const other = randomUUID(); const start = randomUUID(); const run = randomUUID();
        const tool = randomUUID(); const item = randomUUID(); const topic = randomUUID();
        const toolSlug = `tool-${tool}`; const itemSlug = `item-${item}`; const sound = randomUUID(); const soundSet = randomUUID();
        let map: string | undefined;
        let portalTargetId: string | undefined;
        try {
            const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Reference ${randomUUID()}`, description: null, slug: null } });
            expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
            const createdNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Reference place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
            expect(createdNode.status()).toBe(201);
            const node = await createdNode.json(); uuid(node.node_id); uuid(node.asset_id);
            const config = type === 'question' ? { prompt: 'Choose a useful direction.', allowMultiple: false, options: [{ key: 'choice', label: 'A', body: 'Explore', isCorrect: true, feedback: 'Private answer feedback', outcomeKey: 'explore', weights: { orientation: 1 } }] }
                : type === 'reflection' || type === 'review' ? { prompt: 'What did you notice?' }
                : type === 'tool_grant' ? { toolId: toolSlug }
                : type === 'item_grant' ? { items: [{ itemId: itemSlug, quantity: 1 }], probabilityPercent: 100 }
                : type === 'item_obstacle' ? { slots: [{ itemId: itemSlug, x: 50, y: 50, width: 10 }] }
                : type === 'obstacle' ? { allowedToolIds: [toolSlug] }
                : type === 'markdown' ? { markdownPages: [{ id: 'page', title: 'Read', body: 'A source-defined page.' }], markdownTransitions: [{ id: 'start', from: 'start', to: 'page' }, { id: 'end', from: 'page', to: 'end' }] }
                : type === 'message_prompt' || type === 'message_wall' ? { messageAudience: 'peers', messageTopicId: topic, messagePrompt: 'Share a useful observation.', messageInputLabel: 'Your observation' }
                : type === 'portal' ? { portalMode: 'output' } : {};
            Object.assign(config, {
                sourceReferences: [{ title: ' Source title ', url: 'https://example.test/source', publisher: 'Publisher', publishedAt: '2026', rights: 'CC BY', anchor: 'section-1', excerpt: 'Quoted context', concepts: ['Pattern', 'pattern', 'Connection'] }],
                feedbackGuidance: { purpose: ' Notice connections ', evidence: 'Describe a pattern', nextAction: 'Try another example', responseFeedback: 'Compare your explanation', independentCheckPrompt: 'Explain without hints', independentCheckFeedback: 'Notice the difference', rubric: ['Name a pattern', 'Explain a connection'] },
                completionChoicePrompt: 'Choose a useful next direction.',
                ambientSound: { enabled: true, soundId: sound },
                extraPublishedSetting: 'Not part of typed presentation',
            });
            sql(`
                UPDATE learning_maps SET published_at = NOW(), access_roles = '["public"]' WHERE id = '${map}';
                UPDATE learning_nodes SET published_at = NOW() WHERE id = '${node.node_id}';
                UPDATE learning_map_assets SET published_at = NOW() WHERE id = '${node.asset_id}';
                UPDATE learning_routes SET published_at = NOW() WHERE map_asset_id = '${node.asset_id}';
                INSERT INTO learning_tools (id,slug,title,published_at) VALUES ('${tool}','${toolSlug}','Tool ${tool}',NOW());
                INSERT INTO learning_items (id,slug,title,published_at) VALUES ('${item}','${itemSlug}','Item ${item}',NOW());
                INSERT INTO learning_sounds (id,slug,name,icon,url,volume,play_seconds,loop,published_at) VALUES ('${sound}','${sound}','Configured sound','music','/sounds/soft-chime.wav',30,2.5,TRUE,NOW());
                INSERT INTO learner_tools (principal_id,tool_id) VALUES ('${principal}','${tool}');
                INSERT INTO learner_item_holdings (principal_id,item_id,quantity) VALUES ('${principal}','${item}',2);
                INSERT INTO learning_message_topics (id,map_asset_id,slug,title) VALUES ('${topic}','${node.asset_id}','reference-topic','Reference topic');
                INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config)
                    SELECT '${activity}',id,'same-activity','Reference activity','',0,NOW(),'${type}','${JSON.stringify(config)}'::jsonb FROM learning_routes WHERE map_asset_id = '${node.asset_id}';
                INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}');
                INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id)
                    SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${run}' FROM learning_activities WHERE id = '${activity}';
                INSERT INTO learning_routes (id,map_asset_id,slug,title,description,position,published_at) VALUES ('${other}','${node.asset_id}','other-group','Other group','',1,NOW());
                INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) VALUES ('${other}','${other}','same-activity','Different activity with same slug','',0,NOW(),'open_practice','{}');
            `);
            if (type === 'npc_dialogue') {
                const first = randomUUID(); const end = randomUUID();
                sql(`INSERT INTO learning_dialogue_typing_sound_sets (id,slug,name) VALUES ('${soundSet}','${soundSet}','Configured typing set'); INSERT INTO learning_dialogue_typing_sounds (sound_set_id,letter,url,volume) VALUES ('${soundSet}','a','/sounds/soft-chime.wav',42);`);
                sql(`INSERT INTO learning_npc_dialogue_nodes (id,activity_id,node_type,title,body,sort_order) VALUES ('${first}','${activity}','npc_monologue','Notice','Look around.',0),('${end}','${activity}','end','Finish','Done.',1); INSERT INTO learning_npc_dialogue_transitions (activity_id,from_node_id,to_node_id,from_connector) VALUES ('${activity}',NULL,'${first}','out'),('${activity}','${first}','${end}','out');`);
                sql(`UPDATE learning_npc_dialogue_nodes SET node_config = '{"toolId":"${toolSlug}","typingSpeed":28,"typingSoundEnabled":true,"typingSoundSetId":"${soundSet}"}' WHERE id = '${first}'`);
            }
            if (type === 'portal') {
                const destination = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Portal destination', description: null, position_q: 1, position_r: 0, state: 'available', visual_config: {} } });
                expect(destination.status()).toBe(201);
                const target = await destination.json(); uuid(target.node_id); uuid(target.asset_id);
                portalTargetId = randomUUID();
                sql(`
                    UPDATE learning_nodes SET published_at = NOW() WHERE id = '${target.node_id}';
                    UPDATE learning_map_assets SET published_at = NOW() WHERE id = '${target.asset_id}';
                    UPDATE learning_routes SET published_at = NOW() WHERE map_asset_id = '${target.asset_id}';
                    INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${portalTargetId}',id,'arrival','Arrival','',0,NOW(),'portal','{"portalMode":"input"}' FROM learning_routes WHERE map_asset_id = '${target.asset_id}';
                    INSERT INTO learning_portal_links (source_activity_id,target_activity_id,source_node_id,target_node_id) VALUES ('${activity}','${portalTargetId}','${node.node_id}','${target.node_id}');
                `);
            }
            const presentationStarted = performance.now();
            const playbackResponse = await owner.request.get(`/api/v1/learner/play-runs/${run}`);
            expect(playbackResponse.status()).toBe(200);
            const playback = await playbackResponse.json();
            await verifyDirectNodeRead(owner, peer, playback, principal, info);
            if (type === 'question') await verifyDirectQuestion(owner, peer, playback, principal);
            if (type !== 'portal') await verifyCompletedOrdinaryRead(owner, peer, headers, run, activity, principal, node.node_id, info);
            await verifyPlaybackReach(owner, peer, run, activity, principal, node.node_id, false, info);
            const sourceProps = verifyPlaybackProjection(playback);
            expect(sourceProps.progress).toEqual({ activities: {}, answers: {}, recallQuestionIds: [] });
            const sourceActivity = sourceProps.node.activities.find((entry) => entry.id === activity)!;
            if (type === 'question') expect(sourceActivity.question).toMatchObject({ id: activity, options: [{ id: 'choice', outcomeKey: 'explore' }] });
            if (type === 'tool_grant') expect(sourceActivity.config.toolId).toBe(tool);
            if (type === 'item_obstacle') expect(sourceActivity.config.slots).toEqual([expect.objectContaining({ itemId: item })]);
            if (type === 'item_grant') expect(sourceActivity.config.items).toEqual([expect.objectContaining({ itemId: item })]);
            expect(playback.private_state).toEqual({ activities: [], answers: [], recall_activity_ids: [], npc_dialogues: [], shared_task_checklists: [], item_obstacles: [], obstacle_resolutions: [] });
            info.annotations.push({ type: 'native-player-presentation-read', description: `${type}: ${Math.round(performance.now() - presentationStarted)} ms; ${Buffer.byteLength(JSON.stringify(playback))} bytes` });
            const presentation = playback.graph.activities.find((entry) => entry.id === activity).presentation;
            expect(presentation).toMatchObject({
                completion_choice_prompt: 'Choose a useful next direction.',
                sources: [{ title: 'Source title', url: 'https://example.test/source', publisher: 'Publisher', published_at: '2026', rights: 'CC BY', anchor: 'section-1', excerpt: 'Quoted context', concepts: ['Pattern', 'Connection'] }],
                feedback_guidance: { purpose: 'Notice connections', evidence: 'Describe a pattern', next_action: 'Try another example', response_feedback: 'Compare your explanation', independent_check_prompt: 'Explain without hints', independent_check_feedback: 'Notice the difference', rubric: ['Name a pattern', 'Explain a connection'] },
                configured_sounds: [{ id: sound, name: 'Configured sound', icon: 'music', url: '/sounds/soft-chime.wav', volume: 30, play_seconds: 2.5, looped: true }],
            });
            expect(JSON.stringify(presentation)).not.toContain('Not part of typed presentation');
            expect(JSON.stringify(playback.graph)).not.toContain('Private answer feedback');
            expect(JSON.stringify(playback.graph)).not.toContain('isCorrect');
            expect(presentation.configured_tool).toEqual(type === 'tool_grant' ? expect.objectContaining({ id: tool, slug: toolSlug }) : null);
            expect(presentation.configured_items).toEqual(type === 'item_grant' || type === 'item_obstacle' ? [expect.objectContaining({ id: item, slug: itemSlug, quantity: 0 })] : []);
            expect(presentation.question).toEqual(type === 'question' ? { activity_id: activity, prompt: 'Choose a useful direction.', allow_multiple: false, options: [{ key: 'choice', label: 'A', body: 'Explore', outcome_key: 'explore', weights: { orientation: 1 } }] } : null);
            if (type === 'open_practice') {
                sql(`UPDATE learning_sounds SET published_at = NULL WHERE id = '${sound}'`);
                const unpublishedSound = await owner.request.get(`/api/v1/learner/play-runs/${run}`);
                expect(unpublishedSound.status()).toBe(200);
                expect((await unpublishedSound.json()).graph.activities.find((entry) => entry.id === activity).presentation.configured_sounds).toEqual([]);
                sql(`UPDATE learning_sounds SET published_at = NOW() WHERE id = '${sound}'`);
            }
            if (type === 'npc_dialogue') {
                expect(presentation.npc_dialogue_nodes).toHaveLength(2);
                expect(presentation.npc_dialogue_nodes.find((node: any) => node.node_type === 'npc_monologue').config).toMatchObject({ toolId: tool, typingSpeed: 28, typingSoundSetId: soundSet });
                expect(playback.activity.npc_dialogue.nodes.find((node: any) => node.node_type === 'npc_monologue').config).toMatchObject({ toolId: tool, typingSpeed: 28 });
                expect(sql(`SELECT node_config->>'toolId' FROM learning_npc_dialogue_nodes WHERE activity_id='${activity}' AND node_type='npc_monologue'`).trim()).toBe(toolSlug);
                const missingTool = `missing-${randomUUID()}`;
                sql(`UPDATE learning_npc_dialogue_nodes SET node_config=jsonb_set(node_config,'{toolId}','"${missingTool}"') WHERE activity_id='${activity}' AND node_type='npc_monologue'`);
                const missingRead = await owner.request.get(`/api/v1/learner/play-runs/${run}`); expect(missingRead.status()).toBe(200);
                const missingDocument = await missingRead.json();
                expect(missingDocument.graph.activities.find((entry: any) => entry.id === activity).presentation.npc_dialogue_nodes.find((node: any) => node.node_type === 'npc_monologue').config.toolId).toBe(missingTool);
                expect(missingDocument.activity.npc_dialogue.nodes.find((node: any) => node.node_type === 'npc_monologue').config.toolId).toBe(missingTool);
                const grantNode = uuid(missingDocument.activity.npc_dialogue.current_node_id);
                expect((await owner.request.post(`/api/v1/learner/play-runs/${run}/activities/id:${activity}/npc-dialogue/nodes/${grantNode}/grant-tool`, { headers, data: {} })).status()).toBe(404);
                expect(sql(`SELECT count(*) FROM learner_npc_dialogue_states WHERE principal_id='${principal}' AND play_run_id='${run}'`).trim()).toBe('0');
                sql(`UPDATE learning_npc_dialogue_nodes SET node_config=jsonb_set(node_config,'{toolId}','"${toolSlug}"') WHERE activity_id='${activity}' AND node_type='npc_monologue'`);


                expect(presentation.npc_dialogue_transitions).toHaveLength(2);
                expect(presentation.npc_dialogue_transitions).toEqual(expect.arrayContaining([expect.objectContaining({ from_node_id: null, from_connector: 'out', to_connector: 'in' })]));
                expect(presentation.dialogue_typing_sound_sets).toEqual([expect.objectContaining({ id: soundSet, is_default: false, sounds: { a: expect.objectContaining({ letter: 'a', volume: 42, url: '/sounds/soft-chime.wav' }) } })]);
                sql(`UPDATE learning_npc_dialogue_nodes SET node_config = '{"typingSoundEnabled":true}' WHERE activity_id = '${activity}' AND node_type = 'npc_monologue'`);
                const defaultRead = await owner.request.get(`/api/v1/learner/play-runs/${run}`);
                expect(defaultRead.status()).toBe(200);
                expect((await defaultRead.json()).graph.activities.find((entry) => entry.id === activity).presentation.dialogue_typing_sound_sets).toEqual([expect.objectContaining({ is_default: true })]);
                sql(`UPDATE learning_npc_dialogue_nodes SET node_config = '{"typingSoundEnabled":false}' WHERE activity_id = '${activity}' AND node_type = 'npc_monologue'`);
                const disabledRead = await owner.request.get(`/api/v1/learner/play-runs/${run}`);
                expect(disabledRead.status()).toBe(200);
                expect((await disabledRead.json()).graph.activities.find((entry) => entry.id === activity).presentation.dialogue_typing_sound_sets).toEqual([]);
                sql(`INSERT INTO learning_npc_dialogue_nodes (activity_id,node_type,title,sort_order) SELECT '${activity}','npc_monologue','Overflow fixture',n FROM generate_series(2,4096) AS n`);
                expect((await owner.request.get(`/api/v1/learner/play-runs/${run}`)).status()).toBe(503);
                sql(`DELETE FROM learning_npc_dialogue_nodes WHERE activity_id = '${activity}' AND title = 'Overflow fixture'`);
                expect((await owner.request.get(`/api/v1/learner/play-runs/${run}`)).status()).toBe(200);
            } else {
                expect(presentation.npc_dialogue_nodes).toEqual([]);
                expect(presentation.npc_dialogue_transitions).toEqual([]);
                expect(presentation.dialogue_typing_sound_sets).toEqual([]);
            }
            if (type === 'portal') await verifyPlaybackPortals(admin, owner, adminHeaders, `/api/v1/learner/play-runs/${run}`, activity, portalTargetId!);
            if (type === 'shared_task') {
                const state = playback.graph.activities.find((entry) => entry.id === activity).shared_task_state;
                expect(state).toMatchObject({ accepted_count: 0, has_submitted: false, submission: null, contributions: [], peer_review: null });
                expect(playback.graph.activities.find((entry) => entry.id === other).shared_task_state).toBeNull();
                await verifyPlaybackSharedState(owner, peer, principal, run, activity, other, headers, info);
            }
            await verifyPrivateState(type, owner, peer, principal, run, activity, other, item, itemSlug, tool);
            const base = `/api/v1/learner/play-runs/${run}/activities`;
            const ref = encodeURIComponent(`id:${activity}`); const otherRef = encodeURIComponent(`id:${other}`);
            expect((await owner.request.get(`${base}/same-activity/translation`)).status()).toBe(200);
            expect((await owner.request.get(`${base}/${ref}/translation`)).status()).toBe(200);
            expect((await owner.request.get(`${base}/${otherRef}/translation`)).status()).toBe(404);
            const suffix = type === 'question' ? 'answer' : type === 'reflection' || type === 'review' ? 'reflection'
                : type === 'tool_grant' ? 'grant-tool' : type === 'item_grant' ? 'grant-items'
                : type === 'item_obstacle' ? 'item-obstacle-slots/0' : type === 'obstacle' ? 'use-obstacle-tool'
                : type === 'message_prompt' ? 'peer-message' : type === 'message_wall' ? 'peer-wall'
                : type === 'npc_dialogue' ? 'npc-dialogue/continue' : type === 'shared_task' ? 'shared-task/submissions' : type === 'portal' ? 'portal/travel' : 'complete';
            const body = type === 'question' ? { option_keys: ['choice'] }
                : type === 'reflection' || type === 'review' ? { reflection: 'I noticed a useful connection.' }
                : type === 'item_obstacle' ? { item_slug: itemSlug } : type === 'obstacle' ? { tool_slug: toolSlug }
                : type === 'message_prompt' || type === 'shared_task' ? { body: 'A useful observation for a future visit.', share_with_peers: false } : {};
            const send = (reference: string, context = owner, requestHeaders = headers) => type === 'message_wall'
                ? context.request.get(`${base}/${reference}/${suffix}`)
                : context.request.post(`${base}/${reference}/${suffix}`, { headers: requestHeaders, data: body });
            expect((await send(otherRef)).status()).toBe(404);
            expect((await send(ref, peer, peerHeaders)).status()).toBe(404);
            if (type !== 'message_wall') expect((await send(ref, owner, { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': 'invalid' })).status()).toBe(403);
            if (type === 'open_practice') {
                // An ordinary slug can itself be UUID-shaped; explicit IDs
                // still select identities rather than falling back to that slug.
                sql(`UPDATE learning_activities SET slug = '${other}' WHERE id = '${activity}'`);
                expect((await owner.request.get(`${base}/${other}/translation`)).status()).toBe(200);
                expect((await owner.request.get(`${base}/${otherRef}/translation`)).status()).toBe(404);
                expect((await owner.request.get(`${base}/id%3Anot-a-uuid/translation`)).status()).toBe(404);
                sql(`UPDATE learning_activities SET slug = 'same-activity' WHERE id = '${activity}'`);
            }
            const started = performance.now();
            if (type === 'portal') {
                const before = sql(`SELECT row_to_json(p)::text FROM learner_route_progress p WHERE principal_id='${principal}' AND current_play_run_id='${run}'`).trim();
                for (const state of ['locked', 'hidden']) {
                    sql(`UPDATE learning_nodes SET state='${state}' WHERE id='${node.node_id}'`);
                    expect((await send(ref)).status(), 'A portal departure must still be playable when traversal is submitted.').toBe(404);
                    expect(sql(`SELECT row_to_json(p)::text FROM learner_route_progress p WHERE principal_id='${principal}' AND current_play_run_id='${run}'`).trim()).toBe(before);
                    expect(sql(`SELECT count(*) FROM learner_portal_arrival_runs WHERE source_play_run_id='${run}'`).trim()).toBe('0');
                }
                sql(`UPDATE learning_nodes SET state='available' WHERE id='${node.node_id}'`);
            }
            const result = await send(ref);
            expect(result.status()).toBe(200);
            info.annotations.push({ type: 'native-activity-reference-command', description: `${type}: ${Math.round(performance.now() - started)} ms` });
            const resultBody = await result.json();
            if (type === 'portal') {
                expect(resultBody.departure_state).toMatchObject({ activity_id: activity, progress: { activity_id: activity, status: 'completed', completed_at: expect.any(String) } });
                expect(toSourceActivityReceipt(resultBody.departure_state, playback.activity)?.status).toBe('completed');
                const retry = await send(ref);
                expect(retry.status()).toBe(200);
                expect(await retry.json()).toEqual(resultBody);
                const arrival = await owner.request.get(`/api/v1/learner/play-runs/${uuid(resultBody.play_run_id)}`);
                expect(arrival.status()).toBe(200);
                const arrived = await arrival.json();
                expect(arrived.activity.id).toBe(portalTargetId);
                expect(arrived.node.outgoing_portal_links).toEqual([]);
                const pendingDeparture = await owner.request.get(`/api/v1/learner/play-runs/${run}`);
                expect(pendingDeparture.status()).toBe(200);
                expect((await pendingDeparture.json()).activity.id).toBe(activity);
                expect((await peer.request.get(`/api/v1/learner/play-runs/${run}`)).status()).toBe(404);
                for (const state of ['locked', 'hidden']) {
                    sql(`UPDATE learning_nodes SET state='${state}' WHERE id='${node.node_id}'`);
                    expect((await send(ref)).status(), 'An idempotent travel retry must recheck departure access.').toBe(404);
                    expect((await owner.request.get(`/api/v1/learner/play-runs/${run}`)).status()).toBe(404);
                }
                sql(`UPDATE learning_nodes SET state='available',published_at=NULL WHERE id='${node.node_id}'`);
                expect((await send(ref)).status()).toBe(404);
                sql(`UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_activities SET published_at=NULL WHERE id='${activity}'`);
                expect((await send(ref)).status()).toBe(404);
                sql(`UPDATE learning_activities SET published_at=NOW() WHERE id='${activity}'`);
                sql(`UPDATE learning_map_assets SET published_at=NULL WHERE id='${node.asset_id}'`);
                expect((await send(ref)).status()).toBe(404);
                sql(`UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NULL WHERE id=(SELECT route_id FROM learning_activities WHERE id='${activity}')`);
                expect((await send(ref)).status()).toBe(404);
                sql(`UPDATE learning_routes SET published_at=NOW() WHERE id=(SELECT route_id FROM learning_activities WHERE id='${activity}')`);
                expect(await (await send(ref)).json()).toEqual(resultBody);
                const checkIn = await owner.request.post(`${base}/${ref}/check-ins`, { headers, data: { feeling: 'forming', note: 'A private departure observation.', next_direction: null } });
                expect(checkIn.status()).toBe(200);
                expect((await checkIn.json()).activity_state.progress.completed_at).toBe(resultBody.departure_state.progress.completed_at);
                expect(sql(`SELECT note FROM learner_activity_check_ins WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`).trim()).toBe('A private departure observation.');
                expect(sql(`SELECT count(*) FROM learner_portal_arrival_runs WHERE source_play_run_id='${run}'`).trim()).toBe('1');
                expect(sql(`SELECT completion_count FROM learner_route_progress WHERE principal_id='${principal}' AND current_play_run_id='${run}'`).trim()).toBe('1');
            }
            if (type === 'question' || type === 'reflection' || type === 'review') expect((await result.json()).activity_slug).toBe('same-activity');
            if (type === 'question') expect((await owner.request.post(`${base}/${ref}/recall`, { headers })).status()).toBe(200);
            if (type === 'reflection' || type === 'review') {
                expect(resultBody.status).toBe('saved');
                const afterSaving = await owner.request.get(`/api/v1/learner/play-runs/${run}`);
                expect(afterSaving.status()).toBe(200);
                expect((await afterSaving.json()).activity.id).toBe(activity);
            }
            if (type === 'item_obstacle' || type === 'obstacle') {
                if (type === 'item_obstacle') {
                    const continued = await owner.request.post(`${base}/${ref}/item-obstacle/continue`, { headers });
                    expect(continued.status()).toBe(200);
                    expect((await continued.json()).state.can_continue).toBe(true);
                }
                const beforeCompletion = await (await owner.request.get(`/api/v1/learner/play-runs/${run}`)).json();
                const completed = await owner.request.post(`${base}/${ref}/complete`, { headers, data: {} });
                expect(completed.status()).toBe(200);
                const receipt = await completed.json();
                const sourceReceipt = toSourceActivityReceipt(receipt.activity_state, beforeCompletion.graph.activities.find((entry) => entry.id === activity));
                expect(sourceReceipt).toMatchObject({ activityId: activity, status: 'completed', completedAt: receipt.activity_state.progress.completed_at });
                if (type === 'item_obstacle') expect(sourceReceipt?.metadata.itemObstacle?.filledSlots).toEqual({ '0': { itemId: item } });
                if (type === 'obstacle') expect(sourceReceipt?.metadata.obstacle?.destroyedAt).toBe(receipt.activity_state.obstacle_resolved_at);
                expect(receipt).toMatchObject({ next_activity_id: null, activity_state: { activity_id: activity, progress: { activity_id: activity, status: 'completed', completed_at: expect.any(String) } } });
                expect(receipt.activity_state.item_obstacle).toEqual(beforeCompletion.private_state.item_obstacles.find((entry) => entry.activity_id === activity)?.state ?? null);
                expect(receipt.activity_state.obstacle_resolved_at).toBe(beforeCompletion.private_state.obstacle_resolutions.find((entry) => entry.activity_id === activity)?.resolved_at ?? null);
                expect((await owner.request.get(`/api/v1/learner/play-runs/${run}`)).status()).toBe(200);
                const observation = await owner.request.post(`${base}/${ref}/check-ins`, { headers, data: { note: 'The completed obstacle state stays intact.' } });
                expect(observation.status()).toBe(200);
                expect((await observation.json()).activity_state).toEqual(receipt.activity_state);
            }
            if (type === 'open_practice') {
                const observation = await owner.request.post(`${base}/${ref}/check-ins`, { headers, data: { note: 'A private observation after completion.' } });
                expect(observation.status()).toBe(200);
                expect((await observation.json()).activity_slug).toBe('same-activity');
                const replay = await owner.request.post(`/api/v1/learner/activities/${ref}/replay`, { headers });
                expect(replay.status()).toBe(200);
                const replayRun = await replay.json();
                const replayDocument = await owner.request.get(`/api/v1/learner/play-runs/${uuid(replayRun.play_run_id)}`);
                expect(replayDocument.status()).toBe(200);
                expect((await replayDocument.json()).activity.id).toBe(activity);
            }
            // Simulate an independently advanced run: a stale request must not
            // target the new activity even though its human-readable slug matches.
            sql(`UPDATE learner_route_progress SET current_activity_id = '${other}',status = 'in_progress' WHERE principal_id = '${principal}' AND activity_start_id = '${start}'`);
            expect((await owner.request.get(`${base}/${ref}/translation`)).status()).toBe(404);
            const stale = await send(ref);
            if (type === 'portal') {
                // Existing arrivals are intentionally idempotent; a retry
                // returns that same arrival without advancing the changed run.
                expect(stale.status()).toBe(200);
                expect(await stale.json()).toEqual(resultBody);
            } else expect(stale.status()).toBe(404);
            expect((await owner.request.get(`${base}/${otherRef}/translation`)).status()).toBe(200);
            expect(sql(`SELECT current_activity_id FROM learner_route_progress WHERE principal_id = '${principal}' AND activity_start_id = '${start}'`).trim()).toBe(other);
        } finally {
            if (map) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
            sql(`DELETE FROM learning_tools WHERE id = '${tool}'; DELETE FROM learning_items WHERE id = '${item}'; DELETE FROM learning_sounds WHERE id = '${sound}'; DELETE FROM learning_dialogue_typing_sound_sets WHERE id = '${soundSet}'`);
            await admin.close(); await owner.close(); await peer.close();
        }
    });
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }

// Arrange a stored terminal state for every ordinary activity reader. Whole-page
// tests separately prove the actual completion → refresh → continuation writers.
async function verifyCompletedOrdinaryRead(owner: BrowserContext, peer: BrowserContext, headers: Record<string, string>, run: string, activity: string, principal: string, node: string, info: import('@playwright/test').TestInfo) {
    const path = `/api/v1/learner/play-runs/${run}`;
    const completion = `${path}/activities/id:${activity}/complete`;
    const route = () => sql(`SELECT row_to_json(p)::text FROM learner_route_progress p WHERE principal_id='${principal}' AND current_play_run_id='${run}'`).trim();
    const before = route();
    expect(JSON.parse(before)).toMatchObject({ status: 'in_progress', completion_count: 0, last_completed_at: null });
    expect(sql(`SELECT count(*) FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('0');
    sql(`UPDATE learner_route_progress SET status='completed',completion_count=1,last_completed_at=NOW() WHERE principal_id='${principal}' AND current_play_run_id='${run}'; INSERT INTO learner_activity_progress(principal_id,activity_id,status,completed_at) VALUES ('${principal}','${activity}','completed',NOW())`);
    try {
        const saved = route();
        const started = performance.now();
        const response = await owner.request.get(path); expect(response.status()).toBe(200);
        const document = await response.json(); verifyPlaybackProjection(document);
        expect(document).toMatchObject({ play_run_id: run, run_kind: 'route', activity: { id: activity } });
        expect(document.private_state.activities).toContainEqual({ activity_id: activity, status: 'completed', completed_at: expect.any(String) });
        const receipt = await owner.request.post(completion, { headers, data: {} }); expect(receipt.status()).toBe(200);
        expect(await receipt.json()).toMatchObject({ play_run_id: run, status: 'completed', next_activity_id: null, activity_state: { activity_id: activity, progress: document.private_state.activities.find((entry: { activity_id: string }) => entry.activity_id === activity) } });
        info.annotations.push({ type: 'completed-read-and-receipt', description: `${document.activity.activity_type}: ${Math.round(performance.now() - started)} ms` });
        const reached = await owner.request.post(`${path}/activities/id:${activity}/reach`, { headers, data: {} });
        expect(reached.status()).toBe(200);
        expect(await reached.json()).toEqual((await receipt.json()).activity_state);
        expect((await owner.request.get(`${path}/activities/id:${activity}/translation`)).status()).toBe(200);
        expect((await peer.request.get(path)).status()).toBe(404);
        expect((await owner.request.post(completion, { data: {} })).status()).toBe(403);
        sql(`UPDATE learning_nodes SET state='locked' WHERE id='${node}'`);
        expect((await owner.request.get(path)).status()).toBe(404);
        expect((await owner.request.post(completion, { headers, data: {} })).status()).toBe(404);
        sql(`UPDATE learning_nodes SET state='available' WHERE id='${node}'`);
        expect(route()).toBe(saved);
        sql(`UPDATE learner_route_progress SET current_play_run_id='${randomUUID()}' WHERE principal_id='${principal}' AND current_play_run_id='${run}'`);
        expect((await owner.request.get(path)).status()).toBe(404);
        expect((await owner.request.post(completion, { headers, data: {} })).status()).toBe(404);
    } finally {
        sql(`UPDATE learning_nodes SET state='available' WHERE id='${node}'; UPDATE learner_route_progress SET current_play_run_id='${run}',status='in_progress',completion_count=0,last_completed_at=NULL WHERE principal_id='${principal}' AND node_id='${node}'; DELETE FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`);
    }
    expect(route()).toBe(before);
}

// Saved facts are intentionally different from the authored presentation and
// from another principal or run. Remove only these fixture facts before the
// existing command matrix exercises the actual writers.
async function verifyPrivateState(type: string, owner: BrowserContext, peer: BrowserContext, principal: string, run: string, activity: string, other: string, item: string, itemSlug: string, tool: string) {
    if (!['open_practice', 'question', 'npc_dialogue', 'shared_task', 'item_obstacle', 'obstacle'].includes(type)) return;
    const peerSubject = uuid((await (await peer.request.get('/api/v1/me')).json()).subject_id);
    const peerPrincipal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id = '${peerSubject}'`).trim());
    const oldRun = randomUUID();
    const path = `/api/v1/learner/play-runs/${run}`;
    const read = async () => {
        const response = await owner.request.get(path);
        expect(response.status()).toBe(200);
        const document = await response.json();
        const source = verifyPlaybackProjection(document);
        const directResponse = await owner.request.get(`/api/v1/learner/nodes/${document.node.id}/playback?activity_id=${activity}`);
        expect(directResponse.status()).toBe(200);
        const direct = await directResponse.json();
        expect(direct.private_state).toEqual({ ...document.private_state, npc_dialogues: [], shared_task_checklists: [] });
        const directProps = toDirectPlaybackPageProps(direct);
        expect(directProps.progress).toEqual(source.progress);
        expect(directProps.playState).toEqual({});
        expect(directProps.playRunId).toBeNull();
        return document;
    };
    if (type === 'open_practice') {
        sql(`INSERT INTO learner_activity_progress (principal_id,activity_id,status,completed_at) VALUES ('${principal}','${activity}','reached',NULL),('${principal}','${other}','completed','2026-01-02T00:00:00Z'),('${peerPrincipal}','${activity}','completed','2026-01-03T00:00:00Z')`);
        const result = (await read()).private_state;
        expect(result.activities).toHaveLength(2);
        expect(result.activities).toContainEqual({ activity_id: activity, status: 'reached', completed_at: null });
        expect(result.activities).toContainEqual({ activity_id: other, status: 'completed', completed_at: '2026-01-02T00:00:00.000000Z' });
        sql(`UPDATE learning_activities SET published_at = NULL WHERE id = '${other}'`);
        expect((await read()).private_state.activities).toEqual([{ activity_id: activity, status: 'reached', completed_at: null }]);
        sql(`UPDATE learning_activities SET published_at = NOW() WHERE id = '${other}'; DELETE FROM learner_activity_progress WHERE activity_id IN ('${activity}','${other}')`);
    }
    if (type === 'question') {
        sql(`INSERT INTO learner_question_answers (principal_id,activity_id,play_run_id,selected_option_keys,is_correct,confidence,attempt_number,created_at,feedback,feedback_recorded) SELECT '${principal}','${activity}',gen_random_uuid(),'["choice"]',n % 2 = 0,'exploring',n,'2026-01-01T00:00:00Z'::timestamptz + n * INTERVAL '1 day','Private answer feedback',TRUE FROM generate_series(1,6) n;
        INSERT INTO learner_question_answers (principal_id,activity_id,play_run_id,selected_option_keys,is_correct,confidence,attempt_number,created_at) VALUES ('${peerPrincipal}','${activity}','${run}','["choice"]',FALSE,'settled',99,'2027-01-01T00:00:00Z');
        INSERT INTO learner_recall_items (principal_id,activity_id) VALUES ('${principal}','${activity}');
        INSERT INTO learning_activity_transitions (from_activity_id,to_activity_id,from_connector,trigger,trigger_value,label) VALUES ('${activity}','${other}','choice','outcome','explore','Continue exploring');`);
        sql(`UPDATE learner_question_answers SET feedback_recorded = FALSE WHERE principal_id = '${principal}' AND activity_id = '${activity}' AND attempt_number = 6`);
        expect((await owner.request.get(path)).status()).toBe(503);
        sql(`UPDATE learner_question_answers SET feedback_recorded = TRUE WHERE principal_id = '${principal}' AND activity_id = '${activity}' AND attempt_number = 6`);
        const result = await read();
        expect(result.private_state.recall_activity_ids).toEqual([activity]);
        expect(result.private_state.answers).toHaveLength(1);
        expect(result.private_state.answers[0]).toMatchObject({ activity_id: activity, selected_option_keys: ['choice'], is_correct: true, attempt_number: 6, confidence: 'exploring', feedback: 'Private answer feedback', next_activity_id: other, next_transition_label: 'Continue exploring' });
        expect(result.private_state.answers[0].earlier_attempts).toEqual([5,4,3].map((n) => ({ answered_at: `2026-01-0${n+1}T00:00:00.000000Z`, calibration: null, confidence: 'exploring', is_correct: n % 2 === 0, option_label: 'A', option_labels: ['A'] })));
        expect(JSON.stringify(result.graph)).not.toContain('Private answer feedback');
        sql(`INSERT INTO learning_activity_transitions (from_activity_id,to_activity_id,from_connector,trigger,label) VALUES ('${activity}',NULL,'correct','correct','Aggregate correct'); UPDATE learning_activities SET activity_config = activity_config || '{"allowMultiple":true,"feedbackCorrect":"Aggregate answer feedback"}' WHERE id = '${activity}'`);
        expect((await read()).private_state.answers[0]).toMatchObject({ next_activity_id: null, next_transition_label: 'Aggregate correct' });
        const csrf = (await (await owner.request.get('/api/v1/security/csrf')).json()).token;
        const multipleAnswer = await owner.request.post(`${path}/activities/${encodeURIComponent(`id:${activity}`)}/answer`, { headers: { Origin: new URL((await owner.request.get('/api/v1/me')).url()).origin, 'X-CSRF-Token': csrf }, data: { option_keys: ['choice'] } });
        expect(multipleAnswer.status()).toBe(200);
        expect(await multipleAnswer.json()).toMatchObject({ next_transition_label: 'Aggregate correct', feedback: 'Aggregate answer feedback' });
        sql(`UPDATE learning_activities SET activity_config = activity_config || '{"feedbackCorrect":"Later authored feedback"}' WHERE id = '${activity}'`);
        const preserved = await read();
        expect(preserved.private_state.answers[0].feedback).toBe('Aggregate answer feedback');
        expect(preserved.activity.question_feedback.feedback).toBe('Aggregate answer feedback');
        sql(`UPDATE learning_activities SET activity_config = activity_config || '{"feedbackCorrect":null}' WHERE id = '${activity}'`);
        const noFeedback = await owner.request.post(`${path}/activities/${encodeURIComponent(`id:${activity}`)}/answer`, { headers: { Origin: new URL(multipleAnswer.url()).origin, 'X-CSRF-Token': csrf }, data: { option_keys: ['choice'] } });
        expect(noFeedback.status()).toBe(200);
        expect((await noFeedback.json()).feedback).toBeNull();
        expect((await read()).private_state.answers[0].feedback).toBeNull();
        sql(`UPDATE learning_activities SET activity_config = activity_config || '{"allowMultiple":false}' WHERE id = '${activity}'; DELETE FROM learner_question_answers WHERE principal_id = '${principal}' AND activity_id = '${activity}' AND play_run_id = '${run}'`);
        sql(`UPDATE learner_question_answers SET selected_option_keys = '["removed-option"]' WHERE principal_id = '${principal}' AND activity_id = '${activity}' AND attempt_number = 6`);
        expect((await owner.request.get(path)).status()).toBe(503);
        sql(`DELETE FROM learner_question_answers WHERE activity_id = '${activity}'; DELETE FROM learner_recall_items WHERE activity_id = '${activity}'; DELETE FROM learning_activity_transitions WHERE from_activity_id = '${activity}' AND trigger IN ('outcome','correct')`);
        expect((await read()).private_state.answers).toEqual([]);
    }
    if (type === 'npc_dialogue') {
        const nodes = JSON.parse(sql(`SELECT json_agg(id ORDER BY sort_order) FROM learning_npc_dialogue_nodes WHERE activity_id = '${activity}'`).trim());
        const first = uuid(nodes[0]); const end = uuid(nodes[1]);
        sql(`INSERT INTO learner_npc_dialogue_states (principal_id,activity_id,play_run_id,current_node_id,history) VALUES ('${principal}','${activity}','${run}','${end}','["${first}"]'),('${principal}','${activity}','${oldRun}','${first}','[]'),('${peerPrincipal}','${activity}','${run}','${first}','[]')`);
        expect((await read()).private_state.npc_dialogues).toEqual([{ activity_id: activity, current_node_id: end, history: [first] }]);
        sql(`UPDATE learner_route_progress SET current_play_run_id = '${oldRun}' WHERE principal_id = '${principal}' AND current_play_run_id = '${run}'`);
        expect((await owner.request.get(path)).status()).toBe(404);
        const otherRun = await owner.request.get(`/api/v1/learner/play-runs/${oldRun}`);
        expect(otherRun.status()).toBe(200);
        expect((await otherRun.json()).private_state.npc_dialogues).toEqual([{ activity_id: activity, current_node_id: first, history: [] }]);
        sql(`UPDATE learner_route_progress SET current_play_run_id = '${run}' WHERE principal_id = '${principal}' AND current_play_run_id = '${oldRun}'`);
        sql(`UPDATE learner_npc_dialogue_states SET history = '["${other}"]' WHERE principal_id = '${principal}' AND play_run_id = '${run}' AND activity_id = '${activity}'`);
        expect((await owner.request.get(path)).status()).toBe(503);
        sql(`UPDATE learner_npc_dialogue_states SET history = '${JSON.stringify(Array(41).fill(first))}' WHERE principal_id = '${principal}' AND play_run_id = '${run}' AND activity_id = '${activity}'`);
        expect((await owner.request.get(path)).status()).toBe(503);
        sql(`UPDATE learner_npc_dialogue_states SET history = '${JSON.stringify(Array(40).fill(first))}' WHERE principal_id = '${principal}' AND play_run_id = '${run}' AND activity_id = '${activity}'`);
        expect((await read()).private_state.npc_dialogues[0].history).toHaveLength(40);
        sql(`DELETE FROM learner_npc_dialogue_states WHERE principal_id = '${principal}' AND play_run_id = '${run}' AND activity_id = '${activity}'`);
        expect((await read()).private_state.npc_dialogues).toEqual([]);
    }
    if (type === 'shared_task') {
        sql(`UPDATE learning_activities SET activity_config = activity_config || '{"projectSteps":["Notice","Explain"]}' WHERE id = '${activity}';
        INSERT INTO learner_shared_task_checklists (principal_id,activity_id,play_run_id,completed_step_indexes) VALUES ('${principal}','${activity}','${run}',ARRAY[1,0,1]::smallint[]),('${principal}','${activity}','${oldRun}',ARRAY[0]::smallint[]),('${peerPrincipal}','${activity}','${run}',ARRAY[0]::smallint[])`);
        expect((await read()).private_state.shared_task_checklists).toEqual([{ activity_id: activity, completed_step_indexes: [0,1] }]);
        sql(`UPDATE learner_shared_task_checklists SET completed_step_indexes = ARRAY[5]::smallint[] WHERE principal_id = '${principal}' AND play_run_id = '${run}' AND activity_id = '${activity}'`);
        expect((await owner.request.get(path)).status()).toBe(503);
        sql(`DELETE FROM learner_shared_task_checklists WHERE principal_id = '${principal}' AND play_run_id = '${run}' AND activity_id = '${activity}'`);
        expect((await read()).private_state.shared_task_checklists).toEqual([]);
    }
    if (type === 'item_obstacle') {
        sql(`INSERT INTO learner_item_obstacle_states (principal_id,activity_id,locked_until) VALUES ('${principal}','${activity}','2027-01-01T00:00:00Z'),('${peerPrincipal}','${activity}',NULL);
        INSERT INTO learner_item_obstacle_slots (principal_id,activity_id,slot_index,item_id) VALUES ('${principal}','${activity}',0,'${item}')`);
        expect((await read()).private_state.item_obstacles).toEqual([{ activity_id: activity, state: { can_continue: null, conditions_met: true, filled_slots: [{ item_slug: itemSlug, slot_index: 0 }], locked_until: '2027-01-01T00:00:00.000000Z' } }]);
        sql(`DELETE FROM learner_item_obstacle_states WHERE principal_id = '${principal}' AND activity_id = '${activity}'`);
        expect((await read()).private_state.item_obstacles).toEqual([]);
    }
    if (type === 'obstacle') {
        sql(`INSERT INTO learner_obstacle_run_passes (principal_id,activity_id,play_run_id,used_tool_id) VALUES ('${principal}','${activity}','${run}','${tool}');
        INSERT INTO learner_obstacle_resolutions (principal_id,activity_id,resolved_at) VALUES ('${peerPrincipal}','${activity}','2026-01-01T00:00:00Z')`);
        expect((await read()).private_state.obstacle_resolutions).toEqual([]);
        sql(`INSERT INTO learner_obstacle_resolutions (principal_id,activity_id,resolved_at) VALUES ('${principal}','${activity}','2026-01-02T00:00:00Z')`);
        expect((await read()).private_state.obstacle_resolutions).toEqual([{ activity_id: activity, resolved_at: '2026-01-02T00:00:00.000000Z' }]);
        sql(`DELETE FROM learner_obstacle_resolutions WHERE principal_id = '${principal}' AND activity_id = '${activity}'; DELETE FROM learner_obstacle_run_passes WHERE principal_id = '${principal}' AND activity_id = '${activity}'`);
    }
}

async function verifyDirectNodeRead(owner: BrowserContext, peer: BrowserContext, playback: any, principal: string, info: import('@playwright/test').TestInfo) {
    const node = uuid(playback.node.id), activity = uuid(playback.activity.id);
    const path = `/api/v1/learner/nodes/${node}/playback`;
    const snapshot = () => sql(`SELECT json_build_object(
        'routes',(SELECT json_agg(p ORDER BY p.activity_start_id) FROM learner_route_progress p WHERE p.principal_id='${principal}' AND p.node_id='${node}'),
        'activities',(SELECT json_agg(p ORDER BY p.activity_id) FROM learner_activity_progress p WHERE p.principal_id='${principal}' AND p.activity_id='${activity}'),
        'evidence',(SELECT count(*) FROM learner_evidence_events WHERE principal_id='${principal}' AND activity_id='${activity}'),
        'topics',(SELECT last_competence_topics FROM application_principals WHERE id='${principal}'))::text`).trim();
    const before = snapshot(), started = performance.now();
    const response = await owner.request.get(path); expect(response.status()).toBe(200);
    const document = await response.json();
    info.annotations.push({ type: 'direct-node-read', description: `${playback.activity.activity_type}: ${Math.round(performance.now() - started)} ms; ${Buffer.byteLength(JSON.stringify(document))} bytes` });
    expect(document).toEqual({ selected_activity_id: null, graph: playback.graph, node: playback.node, private_state: playback.private_state });
    const props = toDirectPlaybackPageProps(document);
    expect(props.playRunId).toBeNull(); expect(props.playRouteId).toBeNull(); expect(props.playActivityId).toBeNull();
    const selected = await owner.request.get(`${path}?activity_id=${activity}`); expect(selected.status()).toBe(200);
    expect(toDirectPlaybackPageProps(await selected.json()).playActivityId).toBe(activity);
    const foreign = await owner.request.get(`${path}?activity_id=${randomUUID()}`); expect(foreign.status()).toBe(200);
    expect((await foreign.json()).selected_activity_id).toBeNull();
    for (const query of ['activity_id=invalid', `activity_id=${activity}&activity_id=${activity}`, `principal_id=${principal}`]) expect((await owner.request.get(`${path}?${query}`)).status()).toBe(400);
    const other = await peer.request.get(path); expect(other.status()).toBe(200);
    expect((await other.json()).graph.starts.every((start: any) => start.progress === null)).toBe(true);
    expect(snapshot()).toBe(before);
    const invalid = structuredClone(document); invalid.graph.node_id = randomUUID();
    expect(() => toDirectPlaybackPageProps(invalid)).toThrow('player projection is currently unavailable');
    const reachPath = `/api/v1/learner/nodes/${node}/activities/${activity}/reach`;
    const headers = { Origin: new URL(response.url()).origin, 'X-CSRF-Token': (await (await owner.request.get('/api/v1/security/csrf')).json()).token };
    expect((await owner.request.post(reachPath)).status()).toBe(403);
    expect((await owner.request.post(`/api/v1/learner/nodes/${randomUUID()}/activities/${activity}/reach`, { headers })).status()).toBe(404);
    expect((await owner.request.post(`/api/v1/learner/nodes/${node}/activities/${randomUUID()}/reach`, { headers })).status()).toBe(404);
    if (playback.activity.activity_type === 'open_practice') {
        for (const [hide, restore] of [
            [`UPDATE learning_nodes SET state='locked' WHERE id='${node}'`, `UPDATE learning_nodes SET state='available' WHERE id='${node}'`],
            [`UPDATE learning_nodes SET state='hidden' WHERE id='${node}'`, `UPDATE learning_nodes SET state='available' WHERE id='${node}'`],
            [`UPDATE learning_maps SET access_roles='[]' WHERE id='${uuid(playback.node.map_id)}'`, `UPDATE learning_maps SET access_roles='["public"]' WHERE id='${uuid(playback.node.map_id)}'`],
            [`UPDATE learning_activities SET published_at=NULL WHERE id='${activity}'`, `UPDATE learning_activities SET published_at=NOW() WHERE id='${activity}'`],
        ]) {
            sql(hide);
            try { expect((await owner.request.post(reachPath, { headers })).status()).toBe(404); }
            finally { sql(restore); }
        }
    }
    expect(snapshot()).toBe(before);
    const routeFacts = () => { const { activities, ...facts } = JSON.parse(snapshot()); return facts; };
    const facts = routeFacts();
    try {
        const reached = await owner.request.post(reachPath, { headers }); expect(reached.status()).toBe(200);
        const state = await reached.json();
        expect(state).toEqual({ activity_id: activity, progress: { activity_id: activity, status: 'reached', completed_at: null }, item_obstacle: null, obstacle_resolved_at: null });
        const repeated = await owner.request.post(reachPath, { headers }); expect(repeated.status()).toBe(200); expect(await repeated.json()).toEqual(state);
        expect((await (await owner.request.get(path)).json()).private_state.activities).toEqual([state.progress]);
        const peerHeaders = { ...headers, 'X-CSRF-Token': (await (await peer.request.get('/api/v1/security/csrf')).json()).token };
        const peerReached = await peer.request.post(reachPath, { headers: peerHeaders }); expect(peerReached.status()).toBe(200);
        expect((await peerReached.json()).progress.status).toBe('reached');
        sql(`UPDATE learner_activity_progress SET status='completed',completed_at='2026-01-02T00:00:00Z' WHERE principal_id='${principal}' AND activity_id='${activity}'`);
        const preserved = await owner.request.post(reachPath, { headers }); expect(preserved.status()).toBe(200);
        expect((await preserved.json()).progress).toEqual({ activity_id: activity, status: 'completed', completed_at: '2026-01-02T00:00:00.000000Z' });
        expect((await (await peer.request.get(path)).json()).private_state.activities[0].status).toBe('reached');
        const completePath = reachPath.replace(/reach$/, 'complete');
        const checkInPath = reachPath.replace(/reach$/, 'check-ins');
        expect((await peer.request.post(checkInPath, { headers: peerHeaders, data: { note: 'Not completed by peer' } })).status()).toBe(404);
        const completed = await owner.request.post(completePath, { headers }); expect(completed.status()).toBe(200);
        const completeState = await completed.json(); expect(completeState.progress).toEqual({ activity_id: activity, status: 'completed', completed_at: '2026-01-02T00:00:00.000000Z' });
        const saved = await owner.request.post(checkInPath, { headers, data: { feeling: 'forming', next_direction: 'revisit', note: 'Private direct observation' } });
        expect(saved.status()).toBe(200); const checkIn = await saved.json();
        expect(checkIn.activity_state).toEqual(completeState); expect(checkIn.note).toBe('Private direct observation');
        expect(sql(`SELECT play_run_id IS NULL FROM learner_activity_check_ins WHERE id='${uuid(checkIn.id)}' AND principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('t');
        expect((await peer.request.post(checkInPath, { headers: peerHeaders, data: { note: 'Still incomplete' } })).status()).toBe(404);
        expect((await (await peer.request.get(path)).json()).private_state.activities[0].status).toBe('reached');
        for (const endpoint of [completePath, checkInPath]) {
            const data = endpoint === checkInPath ? { note: 'Denied' } : undefined;
            expect((await owner.request.post(endpoint, { data })).status()).toBe(403);
            expect((await owner.request.post(endpoint.replace(node, randomUUID()), { headers, data })).status()).toBe(404);
        }
        if (playback.activity.activity_type === 'open_practice') {
            for (const [hide, restore] of [
                [`UPDATE learning_nodes SET state='hidden' WHERE id='${node}'`, `UPDATE learning_nodes SET state='available' WHERE id='${node}'`],
                [`UPDATE learning_maps SET access_roles='[]' WHERE id='${uuid(playback.node.map_id)}'`, `UPDATE learning_maps SET access_roles='["public"]' WHERE id='${uuid(playback.node.map_id)}'`],
                [`UPDATE learning_activities SET published_at=NULL WHERE id='${activity}'`, `UPDATE learning_activities SET published_at=NOW() WHERE id='${activity}'`],
            ]) {
                sql(hide);
                try {
                    expect((await owner.request.post(completePath, { headers })).status()).toBe(404);
                    expect((await owner.request.post(checkInPath, { headers, data: { note: 'Denied' } })).status()).toBe(404);
                } finally { sql(restore); }
            }
        }
        expect(routeFacts()).toEqual(facts);
    } finally { sql(`DELETE FROM learner_activity_check_ins WHERE activity_id='${activity}'; DELETE FROM learner_activity_progress WHERE activity_id='${activity}'`); }
}

async function verifyDirectQuestion(owner: BrowserContext, peer: BrowserContext, playback: any, principal: string) {
    const node = uuid(playback.node.id), activity = uuid(playback.activity.id);
    const path = `/api/v1/learner/nodes/${node}/activities/${activity}/answer`;
    const headers = { Origin: new URL((await owner.request.get('/api/v1/me')).url()).origin, 'X-CSRF-Token': (await (await owner.request.get('/api/v1/security/csrf')).json()).token };
    const snapshot = () => sql(`SELECT json_build_object('routes',(SELECT json_agg(p ORDER BY p.activity_start_id) FROM learner_route_progress p WHERE p.principal_id='${principal}' AND p.node_id='${node}'),'progress',(SELECT json_agg(p) FROM learner_activity_progress p WHERE p.principal_id='${principal}' AND p.activity_id='${activity}'),'evidence',(SELECT count(*) FROM learner_evidence_events WHERE principal_id='${principal}' AND activity_id='${activity}'),'recall',(SELECT count(*) FROM learner_recall_items WHERE principal_id='${principal}' AND activity_id='${activity}'))::text`).trim();
    const before = snapshot();
    try {
        const answer = await owner.request.post(path, { headers, data: { option_keys: ['choice'], confidence: 'settled' } }); expect(answer.status()).toBe(200);
        const result = await answer.json();
        expect(result).toMatchObject({ play_run_id: null, is_correct: true, confidence: 'settled', calibration: 'aligned', attempt_number: 1, selected_option_keys: ['choice'], earlier_attempts: [], recall: null, status: 'in_progress' });
        expect(result.feedback).toBe('Private answer feedback');
        const runRead = await owner.request.get(`/api/v1/learner/play-runs/${uuid(playback.play_run_id)}`); expect(runRead.status()).toBe(200);
        expect((await runRead.json()).activity.question_feedback).toBeNull();
        expect((await owner.request.post(`/api/v1/learner/play-runs/${playback.play_run_id}/activities/id:${activity}/complete`, { headers, data: {} })).status()).toBe(404);
        const read = await owner.request.get(`/api/v1/learner/nodes/${node}/playback`); expect(read.status()).toBe(200);
        expect(toDirectPlaybackPageProps(await read.json()).progress.answers[activity].isCorrect).toBe(true);
        const peerRead = await peer.request.get(`/api/v1/learner/nodes/${node}/playback`); expect(peerRead.status()).toBe(200);
        expect(toDirectPlaybackPageProps(await peerRead.json()).progress.answers[activity]).toBeUndefined();
        const attempts = await Promise.all(Array.from({ length: 4 }, () => owner.request.post(path, { headers, data: { option_keys: ['choice'], confidence: 'exploring' } })));
        const results = [];
        for (const response of attempts) { expect(response.status()).toBe(200); results.push(await response.json()); }
        expect(results.map((entry) => entry.attempt_number).sort()).toEqual([2, 3, 4, 5]);
        expect(results.find((entry) => entry.attempt_number === 5).earlier_attempts).toHaveLength(3);
        expect(sql(`SELECT count(*) FROM learner_question_answers WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id IS NULL`).trim()).toBe('5');
        for (const data of [{ option_keys: [] }, { option_keys: ['unknown'] }, { option_keys: ['choice', 'choice'] }, { option_keys: ['choice'], confidence: 'invalid' }]) {
            expect((await owner.request.post(path, { headers, data })).status()).toBe(404);
        }
        const data = { option_keys: ['choice'] };
        expect((await owner.request.post(path, { data })).status()).toBe(403);
        expect((await owner.request.post(path.replace(node, randomUUID()), { headers, data })).status()).toBe(404);
        sql(`UPDATE learning_nodes SET state='locked' WHERE id='${node}'`);
        try { expect((await owner.request.post(path, { headers, data })).status()).toBe(404); }
        finally { sql(`UPDATE learning_nodes SET state='available' WHERE id='${node}'`); }
        expect(snapshot()).toBe(before);
    } finally { sql(`DELETE FROM learner_question_answers WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id IS NULL`); }
}
