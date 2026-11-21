import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

for (const kind of ['route', 'replay'] as const) test(`native NPC ${kind} completes source end and null exits`, async ({ browser, baseURL }) => {
    expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
    const source = 'resources/js/features/world/npc-dialogue-player.tsx';
    expect(readFileSync(`../${source}`)).toEqual(execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:${source}`]));
    const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
    const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
    const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
    const csrf = async (context: typeof owner) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
    const headers = await csrf(owner), adminHeaders = await csrf(admin), peerHeaders = await csrf(peer);
    const me = await owner.request.get('/api/v1/me'); expect(me.status()).toBe(200);
    const principal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim());
    const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `NPC completion ${randomUUID()}`, description: null, slug: null } });
    expect(created.status()).toBe(201); const map = uuid((await created.json()).map_id);
    const activity = randomUUID(), target = randomUUID(), fallback = randomUUID(), start = randomUUID(), tool = randomUUID();
    const first = randomUUID(), question = randomUUID(), answer = randomUUID(), reflection = randomUUID(), end = randomUUID();
    const topic = `NPC completion ${activity}`;
    try {
        const createdNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: topic, description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
        expect(createdNode.status()).toBe(201); const node = await createdNode.json(); uuid(node.node_id); uuid(node.asset_id);
        sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
            INSERT INTO learning_tools (id,slug,title,published_at) VALUES ('${tool}','${tool}','NPC completion tool',NOW());
            INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'dialogue','Dialogue','',0,NOW(),'npc_dialogue','{}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
            INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${target}',route_id,'specific-exit','Specific exit','',1,NOW(),'open_practice','{}' FROM learning_activities WHERE id='${activity}';
            INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${fallback}',route_id,'fallback-exit','Fallback exit','',2,NOW(),'open_practice','{}' FROM learning_activities WHERE id='${activity}';
            INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}');
            INSERT INTO learning_npc_dialogue_nodes (id,activity_id,node_type,title,body,node_config,sort_order) VALUES
            ('${first}','${activity}','npc_monologue','First','Notice this.','{}',0),('${question}','${activity}','npc_question','Question','Which clue?','{"toolId":"${tool}"}',1),('${answer}','${activity}','answer','Answer','A clue.','{}',2),('${reflection}','${activity}','reflection','Reflection','What did you notice?','{}',3),('${end}','${activity}','end','End','Finished.','{}',4);
            INSERT INTO learning_activity_transitions (from_activity_id,to_activity_id,from_connector,trigger,label) VALUES ('${activity}','${fallback}','completed','completed','Default'),('${activity}','${target}','dialogue-end-${end}','completed','Specific');`);
        for (const scenario of ['end', 'null', 'fallback-start', 'question-end', 'question-null', 'answer-end', 'reflection-null', 'reflection-end', 'stored-end', 'specific-terminal', 'terminal'] as const) {
            const run = randomUUID();
            const current = scenario.startsWith('question') ? question : scenario.startsWith('reflection') ? reflection : scenario === 'answer-end' ? answer : scenario === 'stored-end' ? end : first;
            const hasEdge = !['null', 'question-null', 'reflection-null', 'terminal'].includes(scenario);
            sql(`DELETE FROM learning_npc_dialogue_transitions WHERE activity_id='${activity}'; DELETE FROM learner_tools WHERE principal_id='${principal}' AND tool_id='${tool}'; UPDATE learning_nodes SET state='available',visual_config='{}' WHERE id='${node.node_id}'; UPDATE learning_activities SET published_at=NOW() WHERE id IN ('${target}','${fallback}');
                DELETE FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id IN ('${activity}','${target}','${fallback}');`);
            if (scenario !== 'fallback-start') sql(`INSERT INTO learning_npc_dialogue_transitions (activity_id,from_node_id,to_node_id,from_connector) VALUES ('${activity}',NULL,'${first}','out')`);
            if (hasEdge && current !== end) sql(`INSERT INTO learning_npc_dialogue_transitions (activity_id,from_node_id,to_node_id,from_connector) VALUES ('${activity}','${current}','${end}','out')`);
            if (kind === 'route') sql(`INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${run}' FROM learning_activities WHERE id='${activity}' ON CONFLICT (principal_id,activity_start_id) DO UPDATE SET current_activity_id=EXCLUDED.current_activity_id,status='in_progress',current_play_run_id=EXCLUDED.current_play_run_id`);
            else sql(`INSERT INTO learner_activity_replay_runs (id,principal_id,activity_id) VALUES ('${run}','${principal}','${activity}')`);
            if (scenario !== 'fallback-start') sql(`INSERT INTO learner_npc_dialogue_states (principal_id,activity_id,play_run_id,current_node_id,history) VALUES ('${principal}','${activity}','${run}','${current}','[]')`);
            const path = `/api/v1/learner/play-runs/${run}/activities/id:${activity}/complete`;
            const write = () => owner.request.post(path, { headers, data: {} });
            const facts = () => sql(`SELECT jsonb_build_object('state',(SELECT to_jsonb(s) FROM learner_npc_dialogue_states s WHERE principal_id='${principal}' AND play_run_id='${run}' AND activity_id='${activity}'),'activity',(SELECT to_jsonb(p) FROM learner_activity_progress p WHERE principal_id='${principal}' AND activity_id='${activity}'),'evidence',(SELECT count(*) FROM learner_evidence_events WHERE principal_id='${principal}' AND play_run_id='${run}'),'route',(SELECT to_jsonb(r) FROM learner_route_progress r WHERE principal_id='${principal}' AND current_play_run_id='${run}'),'replay',(SELECT to_jsonb(r) FROM learner_activity_replay_runs r WHERE id='${run}'))`);
            if (scenario === 'end' || scenario === 'stored-end') {
                const before = facts();
                for (const state of ['locked', 'hidden']) { sql(`UPDATE learning_nodes SET state='${state}' WHERE id='${node.node_id}'`); expect((await write()).status()).toBe(404); expect(facts()).toBe(before); }
                sql(`UPDATE learning_nodes SET state='available',visual_config='{"schedule":{"lockAt":"2020-01-01T00:00:00Z"}}' WHERE id='${node.node_id}'`); expect((await write()).status()).toBe(404); expect(facts()).toBe(before);
                sql(`UPDATE learning_nodes SET visual_config='{}' WHERE id='${node.node_id}'`);
                for (const [table, predicate] of [['learning_maps', `id='${map}'`], ['learning_nodes', `id='${node.node_id}'`], ['learning_map_assets', `id='${node.asset_id}'`], ['learning_routes', `map_asset_id='${node.asset_id}'`], ['learning_activities', `id='${activity}'`]]) {
                    sql(`UPDATE ${table} SET published_at=NULL WHERE ${predicate}`); expect((await write()).status()).toBe(404); expect(facts()).toBe(before); sql(`UPDATE ${table} SET published_at=NOW() WHERE ${predicate}`);
                }
                sql(`UPDATE learning_maps SET access_roles='[]' WHERE id='${map}'`); expect((await write()).status()).toBe(404); expect(facts()).toBe(before); sql(`UPDATE learning_maps SET access_roles='["public"]' WHERE id='${map}'`);

                expect((await peer.request.post(path, { headers: peerHeaders, data: {} })).status()).toBe(404);
                expect((await owner.request.post(path, { headers: { Origin: new URL(baseURL!).origin }, data: {} })).status()).toBe(403); expect(facts()).toBe(before);
                if (scenario === 'end') {
                sql(`UPDATE learning_npc_dialogue_transitions SET to_node_id='${question}' WHERE from_node_id='${first}'`);
                expect((await write()).status()).toBe(404); expect(facts()).toBe(before);
                sql(`UPDATE learning_npc_dialogue_transitions SET to_node_id='${end}' WHERE from_node_id='${first}'`);
                }
                if (kind === 'route') { sql(`UPDATE learning_activities SET published_at=NULL WHERE id='${target}'`); expect((await write()).status()).toBe(404); expect(facts()).toBe(before); sql(`UPDATE learning_activities SET published_at=NOW() WHERE id='${target}'`); }
            }
            if (scenario.startsWith('question')) {
                const before = facts(); expect((await write()).status()).toBe(404); expect(facts()).toBe(before);
                sql(`INSERT INTO learner_tools (principal_id,tool_id) VALUES ('${principal}','${tool}')`);
            }
            if (scenario.startsWith('reflection')) {
                const before = facts(); expect((await write()).status()).toBe(404); expect(facts()).toBe(before);
                const saved = await owner.request.post(path.replace('/complete','/npc-dialogue/reflection'), { headers, data: { reflection: `Source ${scenario} observation.` } }); expect(saved.status()).toBe(200);
                expect(sql(`SELECT count(*) FROM learner_reflections WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}' AND npc_dialogue_node_id='${reflection}'`).trim()).toBe('1');
                if (scenario === 'reflection-null') {
                    sql(`UPDATE learner_reflections SET npc_dialogue_node_id='${first}' WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`);
                    const otherNodeEvidence = facts(); expect((await write()).status()).toBe(404); expect(facts()).toBe(otherNodeEvidence);
                    sql(`UPDATE learner_reflections SET npc_dialogue_node_id='${reflection}' WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`);
                }
            }
            if (scenario === 'fallback-start') {
                const read = await owner.request.get(`/api/v1/learner/play-runs/${run}`); expect(read.status()).toBe(200);
                expect((await read.json()).activity.npc_dialogue.current_node_id).toBe(first);
                const initialized = await owner.request.post(path.replace('/complete','/npc-dialogue/cursor'), { headers, data: { current_node_id: first, history: [] } }); expect(initialized.status()).toBe(200);
                expect(await initialized.json()).toMatchObject({ current_node_id: first, history: [] });
            }
            if (scenario === 'specific-terminal') sql(`UPDATE learning_activity_transitions SET to_activity_id=NULL WHERE from_activity_id='${activity}' AND from_connector='dialogue-end-${end}'`);
            if (scenario === 'terminal') sql(`DELETE FROM learning_activity_transitions WHERE from_activity_id='${activity}'`);
            const completed = await write(); expect(completed.status(), scenario).toBe(200);
            const next = kind === 'replay' || scenario === 'terminal' || scenario === 'specific-terminal' ? null : hasEdge ? target : fallback;
            expect(await completed.json()).toMatchObject({ next_activity_id: next, status: next ? 'in_progress' : 'completed', activity_state: { activity_id: activity, progress: { status: 'completed' } } });
            const after = facts(); expect((await write()).status()).toBe(404); expect(facts()).toBe(after);
            if (kind === 'replay') expect(sql(`SELECT count(*) FROM learner_evidence_events WHERE principal_id='${principal}' AND play_run_id='${run}'`).trim()).toBe('0');
        }
        const reflectionsBeforeDeletion = sql(`SELECT jsonb_agg(jsonb_build_object('question',question,'reflection',reflection) ORDER BY created_at,id) FROM learner_reflections WHERE principal_id='${principal}' AND activity_id='${activity}'`);
        expect(sql(`SELECT count(*) FROM learner_reflections WHERE principal_id='${principal}' AND activity_id='${activity}' AND npc_dialogue_node_id='${reflection}'`).trim()).toBe('2');
        sql(`DELETE FROM learning_npc_dialogue_nodes WHERE id='${reflection}'`);
        expect(sql(`SELECT count(*) FROM learner_reflections WHERE principal_id='${principal}' AND activity_id='${activity}' AND npc_dialogue_node_id IS NULL`).trim()).toBe('2');
        expect(sql(`SELECT jsonb_agg(jsonb_build_object('question',question,'reflection',reflection) ORDER BY created_at,id) FROM learner_reflections WHERE principal_id='${principal}' AND activity_id='${activity}'`)).toBe(reflectionsBeforeDeletion);
    } finally {
        sql(`DELETE FROM learner_journal_pages WHERE principal_id='${principal}' AND topic='${topic}'; DELETE FROM learning_activity_transitions WHERE from_activity_id='${activity}'; DELETE FROM learning_tools WHERE id='${tool}'`);
        expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
        await Promise.all([admin.close(), owner.close(), peer.close()]);
    }
});
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
