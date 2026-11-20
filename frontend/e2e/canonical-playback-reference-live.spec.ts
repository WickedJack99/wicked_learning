import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
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
                sql(`UPDATE learning_npc_dialogue_nodes SET node_config = '{"typingSoundEnabled":true,"typingSoundSetId":"${soundSet}"}' WHERE id = '${first}'`);
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
            const result = await send(ref);
            expect(result.status()).toBe(200);
            info.annotations.push({ type: 'native-activity-reference-command', description: `${type}: ${Math.round(performance.now() - started)} ms` });
            const resultBody = await result.json();
            if (type === 'portal') {
                const retry = await send(ref);
                expect(retry.status()).toBe(200);
                expect(await retry.json()).toEqual(resultBody);
                const arrival = await owner.request.get(`/api/v1/learner/play-runs/${uuid(resultBody.play_run_id)}`);
                expect(arrival.status()).toBe(200);
                expect((await arrival.json()).activity.id).toBe(portalTargetId);
            }
            if (type === 'question' || type === 'reflection' || type === 'review') expect((await result.json()).activity_slug).toBe('same-activity');
            if (type === 'question') expect((await owner.request.post(`${base}/${ref}/recall`, { headers })).status()).toBe(200);
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
