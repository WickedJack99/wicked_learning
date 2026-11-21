import { prepareNpcAnswerEvidence } from './canonical-player-npc-answer-evidence';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

for (const kind of ['route', 'replay'] as const) for (const action of ['continue', 'answer', 'back', 'reflection', 'cursor', 'grant-tool'] as const) {
    test(`native NPC ${kind} ${action} rechecks source node access`, async ({ browser, baseURL }, info) => {
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        for (const path of ['app/Http/Controllers/LearningWorldController.php', 'app/Learning/Services/LearnerActivityAccessService.php', 'app/Learning/Services/LearningNodeStateResolver.php', 'app/Http/Controllers/LearnerJournalController.php', 'app/Learning/Services/NpcDialogueAnswerService.php', 'app/Learning/Services/LearnerNodeAnswerEventService.php', 'app/Learning/Services/LearnerActivityPlayStateService.php', 'app/Learning/Services/LearningToolGrantService.php']) {
            expect(readFileSync(`../${path}`)).toEqual(execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:${path}`]));
        }
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
        const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
        const headersFor = async (context: typeof admin) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
        const adminHeaders = await headersFor(admin); const headers = await headersFor(owner); const peerHeaders = await headersFor(peer);
        const me = await owner.request.get('/api/v1/me'); expect(me.status()).toBe(200);
        const principal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim());
        const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `NPC access ${randomUUID()}`, description: null, slug: null } });
        expect(created.status()).toBe(201); const map = uuid((await created.json()).map_id);
        const activity = randomUUID(), run = randomUUID(), start = randomUUID(), tool = randomUUID();
        const first = randomUUID(), question = randomUUID(), answer = randomUUID(), reflection = randomUUID(), end = randomUUID();
        const topic = `NPC access ${activity}`;
        let answerEvidence: Awaited<ReturnType<typeof prepareNpcAnswerEvidence>> | undefined;
        try {
            const result = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: topic, description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
            expect(result.status()).toBe(201); const node = await result.json(); uuid(node.node_id); uuid(node.asset_id);
            sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_tools (id,slug,title,published_at) VALUES ('${tool}','${tool}','NPC test tool',NOW());
                INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'dialogue','Dialogue','',0,NOW(),'npc_dialogue','{}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}');
                INSERT INTO learning_npc_dialogue_nodes (id,activity_id,node_type,title,body,node_config,sort_order) VALUES
                ('${first}','${activity}','npc_monologue','First','Notice this.','{}',0),
                ('${question}','${activity}','npc_question','Question','Which clue?','{"toolId":"${tool}"}',1),
                ('${answer}','${activity}','answer','Answer','A clue.','{}',2),
                ('${reflection}','${activity}','reflection','Reflection','What did you notice?','{}',3),
                ('${end}','${activity}','end','End','Finished.','{}',4);
                INSERT INTO learning_npc_dialogue_transitions (activity_id,from_node_id,to_node_id,from_connector) VALUES
                ('${activity}',NULL,'${first}','out'),('${activity}','${first}','${question}','out'),('${activity}','${question}','${answer}','answer-0'),('${activity}','${answer}','${reflection}','out'),('${activity}','${reflection}','${end}','out');`);
            if (kind === 'route') sql(`INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${run}' FROM learning_activities WHERE id='${activity}'`);
            else sql(`INSERT INTO learner_activity_replay_runs (id,principal_id,activity_id) VALUES ('${run}','${principal}','${activity}')`);
            const current = action === 'continue' || action === 'cursor' ? first : action === 'reflection' ? reflection : question;
            const history = action === 'back' ? [first] : [];
            sql(`INSERT INTO learner_npc_dialogue_states (principal_id,activity_id,play_run_id,current_node_id,history) VALUES ('${principal}','${activity}','${run}','${current}','${JSON.stringify(history)}')`);
            const path = `/api/v1/learner/play-runs/${run}/activities/id:${activity}/npc-dialogue/${action === 'grant-tool' ? `nodes/${question}/grant-tool` : action}`;
            const data = action === 'cursor' ? { current_node_id: question, history: [first] } : action === 'answer' ? { answer_node_id: answer, expected_node_id: current } : action === 'reflection' ? { reflection: 'I noticed two different clues.', expected_node_id: current } : {};
            const write = () => owner.request.post(path, { headers, data });
            if (action === 'cursor') expect((await owner.request.post(path, { headers, data: { current_node_id: first, history: [] } })).status()).toBe(200);
            if (action === 'answer') answerEvidence = await prepareNpcAnswerEvidence({ admin, owner, peer, adminHeaders, headers, map, activity, run, principal, question, answer, sql, info });
            const facts = () => sql(`SELECT jsonb_build_object(
                'answers',(SELECT jsonb_agg(to_jsonb(a)) FROM learner_npc_dialogue_answers a WHERE principal_id='${principal}' AND activity_id='${activity}'),
                'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY node_id,event_kind) FROM learner_node_answer_events e WHERE principal_id='${principal}' AND source_activity_id='${activity}'),
                'state',(SELECT to_jsonb(s) FROM learner_npc_dialogue_states s WHERE principal_id='${principal}' AND play_run_id='${run}' AND activity_id='${activity}'),
                'tools',(SELECT jsonb_agg(to_jsonb(t)) FROM learner_tools t WHERE principal_id='${principal}' AND tool_id='${tool}'),
                'reflections',(SELECT jsonb_agg(to_jsonb(r)) FROM learner_reflections r WHERE principal_id='${principal}' AND activity_id='${activity}'),
                'journal',(SELECT jsonb_agg(to_jsonb(j)) FROM learner_journal_pages j WHERE principal_id='${principal}' AND topic='${topic}'))`);
            if (action === 'reflection' && kind === 'replay') sql(`INSERT INTO learner_journal_pages (principal_id,title,topic,subtopic,markdown) VALUES ('${principal}','Existing private page','${topic}','Dialogue','Keep my earlier note.')`);
            const before = facts();
            const denied = async () => { expect((await write()).status()).toBe(404); expect(facts()).toBe(before); };
            for (const state of ['locked', 'hidden']) {
                sql(`UPDATE learning_nodes SET state='${state}' WHERE id='${node.node_id}'`); await denied();
            }
            sql(`UPDATE learning_nodes SET state='available',visual_config='{"schedule":{"lockAt":"2020-01-01T00:00:00Z"}}' WHERE id='${node.node_id}'`); await denied();
            sql(`UPDATE learning_nodes SET visual_config='{}' WHERE id='${node.node_id}'`);
            for (const [table, predicate] of [['learning_maps', `id='${map}'`], ['learning_nodes', `id='${node.node_id}'`], ['learning_map_assets', `id='${node.asset_id}'`], ['learning_routes', `map_asset_id='${node.asset_id}'`], ['learning_activities', `id='${activity}'`]]) {
                sql(`UPDATE ${table} SET published_at=NULL WHERE ${predicate}`); await denied(); sql(`UPDATE ${table} SET published_at=NOW() WHERE ${predicate}`);
            }
            sql(`UPDATE learning_maps SET access_roles='[]' WHERE id='${map}'`); await denied(); sql(`UPDATE learning_maps SET access_roles='["public"]' WHERE id='${map}'`);
            sql(`UPDATE learning_nodes SET state='locked' WHERE id='${node.node_id}'; INSERT INTO learner_node_manual_unlocks (principal_id,node_id,revoked_at) VALUES ('${principal}','${node.node_id}',NOW())`); await denied();
            sql(`UPDATE learning_nodes SET state='available' WHERE id='${node.node_id}'`);
            if (kind === 'route') sql(`UPDATE learner_route_progress SET status='completed' WHERE current_play_run_id='${run}'`);
            else sql(`UPDATE learner_activity_replay_runs SET status='completed',completed_at=NOW() WHERE id='${run}'`);
            await denied();
            if (kind === 'route') sql(`UPDATE learner_route_progress SET status='in_progress' WHERE current_play_run_id='${run}'`);
            else sql(`UPDATE learner_activity_replay_runs SET status='in_progress',completed_at=NULL WHERE id='${run}'`);
            if (kind === 'route') {
                const different = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Different place', description: null, position_q: 1, position_r: 0, state: 'available', visual_config: {} } });
                expect(different.status()).toBe(201); const otherNode = uuid((await different.json()).node_id);
                sql(`UPDATE learner_route_progress SET node_id='${otherNode}' WHERE current_play_run_id='${run}'`); await denied();
                sql(`UPDATE learner_route_progress SET node_id='${node.node_id}' WHERE current_play_run_id='${run}'`);
            }
            expect((await peer.request.post(path, { headers: peerHeaders, data })).status()).toBe(404);
            expect((await owner.request.post(path.replace(run, randomUUID()), { headers, data })).status()).toBe(404);
            expect((await owner.request.post(path, { headers: { Origin: new URL(baseURL!).origin }, data })).status()).toBe(403);
            expect(facts()).toBe(before);
            if (action === 'answer' || action === 'reflection') {
                expect((await owner.request.post(path, { headers, data: { ...data, expected_node_id: first } })).status()).toBe(404);
                expect(facts()).toBe(before);
                expect((await owner.request.post(path, { headers, data: { ...data, expected_node_id: 'invalid-node' } })).status()).toBe(422);
                expect(facts()).toBe(before);
            }
            sql(`UPDATE learning_nodes SET state='locked' WHERE id='${node.node_id}'; UPDATE learner_node_manual_unlocks SET revoked_at=NULL WHERE principal_id='${principal}' AND node_id='${node.node_id}'`);
            if (action === 'reflection') {
                for (const body of [' ', 'x'.repeat(2001)]) {
                    sql(`UPDATE learning_npc_dialogue_nodes SET body='${body}' WHERE id='${reflection}'`); await denied();
                }
                sql(`UPDATE learning_npc_dialogue_nodes SET body='What did you notice?' WHERE id='${reflection}'; DELETE FROM learner_npc_dialogue_states WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`);
                const withoutState = facts();
                // The authored initial node is a monologue, so reflection is invalid.
                expect((await write()).status()).toBe(404); expect(facts()).toBe(withoutState);
                sql(`INSERT INTO learner_npc_dialogue_states (principal_id,activity_id,play_run_id,current_node_id,history) VALUES ('${principal}','${activity}','${run}','${reflection}','[]')`);
            }
            await answerEvidence?.rejectInvalidConfiguration();
            const accepted = await write(); expect(accepted.status()).toBe(200);
            if (action === 'answer') expect(await accepted.json()).toMatchObject({ answer: { answer_key: answer, answer_node_id: answer, is_correct: true, feedback: null } });
            const target = action === 'continue' || action === 'cursor' ? question : action === 'answer' ? answer : action === 'back' ? first : action === 'grant-tool' ? question : end;
            expect(await accepted.json()).toMatchObject({ current_node_id: target, history: action === 'continue' || action === 'cursor' ? [first] : action === 'reflection' ? [reflection] : [] });
            expect(facts()).not.toBe(before);
            expect(sql(`SELECT COUNT(*) FROM learner_tools WHERE principal_id='${principal}' AND tool_id='${tool}'`).trim()).toBe(action === 'continue' || action === 'grant-tool' ? '1' : '0');
            expect(sql(`SELECT COUNT(*) FROM learner_reflections WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe(action === 'reflection' ? '1' : '0');
            if (action === 'reflection' && kind === 'replay') expect(sql(`SELECT markdown FROM learner_journal_pages WHERE principal_id='${principal}' AND topic='${topic}'`)).toContain('Keep my earlier note.');
            if (action === 'cursor') {
                const cursor = (id: string, history: string[]) => owner.request.post(path, { headers, data: { current_node_id: id, history } });
                const stored = () => sql(`SELECT current_node_id::text || history::text FROM learner_npc_dialogue_states WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`);
                const onQuestion = stored();
                for (const [id, history, status] of [[answer, [], 404], [reflection, [], 404], [first, [randomUUID()], 404], [randomUUID(), [], 404], [question, Array(41).fill(first), 400]] as const) {
                    expect((await cursor(id, [...history])).status()).toBe(status); expect(stored()).toBe(onQuestion);
                }
                expect((await cursor(question, [first])).status()).toBe(200);
                expect((await cursor(first, [])).status()).toBe(200);
                expect((await cursor(question, [first])).status()).toBe(200);
                expect((await cursor('invalid', [])).status()).toBe(400);
                expect((await cursor(question, ['invalid'])).status()).toBe(400);
                sql(`UPDATE learning_npc_dialogue_nodes SET node_config='{"toolId":"${tool}"}' WHERE id='${first}'; UPDATE learner_npc_dialogue_states SET current_node_id='${first}',history='[]' WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`);
                expect((await cursor(question, [])).status()).toBe(404);
                sql(`INSERT INTO learner_tools (principal_id,tool_id) VALUES ('${principal}','${tool}')`);
                expect(await (await cursor(question, [])).json()).toMatchObject({ current_node_id: question, history: [], granted_tool: null });
                sql(`DELETE FROM learner_tools WHERE principal_id='${principal}' AND tool_id='${tool}'`);
                const answered = await owner.request.post(path.replace('/cursor', '/answer'), { headers, data: { answer_node_id: answer } }); expect(answered.status()).toBe(200);
                expect((await cursor(reflection, [])).status()).toBe(200);
                const onReflection = stored(); expect((await cursor(end, [reflection])).status()).toBe(404); expect(stored()).toBe(onReflection);
                const reflected = await owner.request.post(path.replace('/cursor', '/reflection'), { headers, data: { reflection: 'A source cursor reflection.' } }); expect(reflected.status()).toBe(200);
                expect((await cursor(end, [reflection])).status()).toBe(200);
                expect(sql(`SELECT COUNT(*) FROM learner_tools WHERE principal_id='${principal}' AND tool_id='${tool}'`).trim()).toBe('0');
                sql(`UPDATE learning_npc_dialogue_transitions SET to_node_id='${first}' WHERE activity_id='${activity}' AND from_node_id='${first}'; UPDATE learner_npc_dialogue_states SET current_node_id='${first}',history='${JSON.stringify(Array(39).fill(first))}' WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`);
                expect((await cursor(first, Array(40).fill(first))).status()).toBe(200);
                const atLimit = stored(); expect((await cursor(first, Array(41).fill(first))).status()).toBe(400); expect(stored()).toBe(atLimit);
                expect((await cursor(first, Array(39).fill(first))).status()).toBe(200);
                sql(`DELETE FROM learner_npc_dialogue_states WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`);
                expect((await cursor(randomUUID(), [])).status()).toBe(404);
                expect(sql(`SELECT COUNT(*) FROM learner_npc_dialogue_states WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`).trim()).toBe('0');
                expect((await cursor(first, [])).status()).toBe(200);
            }
            if (action === 'grant-tool') {
                expect(await accepted.json()).toMatchObject({ granted_tool: { id: tool, slug: tool, title: 'NPC test tool' }, current_node_id: question, history: [] });
                const granted = facts();
                expect((await write()).status()).toBe(200); expect(facts()).toBe(granted);
                for (const id of [first, answer, randomUUID()]) {
                    expect((await owner.request.post(path.replace(question, id), { headers, data: {} })).status()).toBe(404);
                    expect(facts()).toBe(granted);
                }
                sql(`DELETE FROM learner_tools WHERE principal_id='${principal}' AND tool_id='${tool}'; DELETE FROM learner_npc_dialogue_states WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`);
                const absent = facts();
                // A non-current request must not initialize the cursor or grant the requested node's tool.
                expect((await write()).status()).toBe(404); expect(facts()).toBe(absent);
                const initialPath = path.replace(question, first);
                expect((await owner.request.post(initialPath, { headers, data: {} })).status()).toBe(404); expect(facts()).toBe(absent);
                for (const configuration of [{ toolId: randomUUID() }, { toolId: 123 }, { toolId: '' }]) {
                    sql(`UPDATE learning_npc_dialogue_nodes SET node_config='${JSON.stringify(configuration)}' WHERE id='${first}'`);
                    expect((await owner.request.post(initialPath, { headers, data: {} })).status()).toBe(404); expect(facts()).toBe(absent);
                }
                sql(`UPDATE learning_npc_dialogue_nodes SET node_config='{"toolId":"${tool}"}' WHERE id='${first}'; UPDATE learning_tools SET published_at=NULL WHERE id='${tool}'`);
                expect((await owner.request.post(initialPath, { headers, data: {} })).status()).toBe(404); expect(facts()).toBe(absent);
                sql(`UPDATE learning_tools SET published_at=NOW() WHERE id='${tool}'`);
                const initialGrant = await owner.request.post(initialPath, { headers, data: {} }); expect(initialGrant.status()).toBe(200);
                expect(await initialGrant.json()).toMatchObject({ granted_tool: { id: tool }, current_node_id: first, history: [] });
                const initialFacts = facts();
                const retries = await Promise.all([owner.request.post(initialPath, { headers, data: {} }), owner.request.post(initialPath, { headers, data: {} })]);
                expect(retries.map(response => response.status())).toEqual([200, 200]); expect(facts()).toBe(initialFacts);
                expect(sql(`SELECT COUNT(*) FROM learner_tools WHERE principal_id='${principal}' AND tool_id='${tool}'`).trim()).toBe('1');
                for (const type of ['answer', 'reflection', 'end']) {
                    sql(`UPDATE learning_npc_dialogue_nodes SET node_type='${type}' WHERE id='${first}'`);
                    expect((await owner.request.post(initialPath, { headers, data: {} })).status()).toBe(404); expect(facts()).toBe(initialFacts);
                }
                sql(`UPDATE learning_npc_dialogue_nodes SET node_type='npc_monologue' WHERE id='${first}'`);
                const advanced = await owner.request.post(path.replace(`nodes/${question}/grant-tool`, 'cursor'), { headers, data: { current_node_id: question, history: [first] } }); expect(advanced.status()).toBe(200);
                const afterAdvance = facts(); expect((await owner.request.post(initialPath, { headers, data: {} })).status()).toBe(404); expect(facts()).toBe(afterAdvance);
            }
            await answerEvidence?.verify();
        } finally {
            await answerEvidence?.dispose();
            sql(`DELETE FROM learner_journal_pages WHERE principal_id='${principal}' AND topic='${topic}'; DELETE FROM learning_tools WHERE id='${tool}'`);
            expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
            await Promise.all([admin.close(), owner.close(), peer.close()]);
        }
    });
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
