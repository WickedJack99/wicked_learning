import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

// Source: QuestionAnswerService::answer and QuestionTransitionResolver.
// Real native commands, including isolated runs; no browser response mocks.
for (const kind of ['route', 'revisit', 'recall', 'replay'] as const) {
    test(`source question evaluation and deferred routing in ${kind}`, async ({ browser, baseURL }) => {
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
        const headersFor = async (context: typeof owner) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
        const adminHeaders = await headersFor(admin); const headers = await headersFor(owner);
        const me = await owner.request.get('/api/v1/me'); expect(me.status()).toBe(200);
        const principal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim());
        const activity = randomUUID(); const next = randomUUID(); const alternate = randomUUID();
        const start = randomUUID(); const run = randomUUID(); const checkIn = randomUUID();
        const edges = [randomUUID(), randomUUID(), randomUUID()];
        let map: string | undefined;
        try {
            const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Answer ${randomUUID()}`, description: null, slug: null } });
            expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
            const createdNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Answer place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
            expect(createdNode.status()).toBe(201); const node = await createdNode.json(); uuid(node.node_id); uuid(node.asset_id);
            const config = { prompt: 'Choose a direction.', allowMultiple: false, feedbackCorrect: 'Useful direction.', feedbackIncorrect: 'Try another direction.', explanation: 'Several directions can work.', options: [
                { key: 'first', label: 'A', body: 'First direction', isCorrect: true },
                { key: 'second', label: 'B', body: 'Second direction', isCorrect: true, outcomeKey: 'alternate' },
                { key: 'wrong', label: 'C', body: 'Unsupported direction', isCorrect: false },
            ] };
            sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}';
                UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}';
                UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'question','Question','',0,NOW(),'question','${JSON.stringify(config)}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${next}',route_id,'next','Next','',1,NOW(),'open_practice','{}' FROM learning_activities WHERE id='${activity}';
                INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${alternate}',route_id,'alternate','Alternate','',2,NOW(),'open_practice','{}' FROM learning_activities WHERE id='${activity}';
                INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}');
                INSERT INTO learning_activity_transitions (id,from_activity_id,to_activity_id,from_connector,trigger,trigger_value,label) VALUES
                    ('${edges[0]}','${activity}','${next}','correct','correct',NULL,'Keep exploring'),
                    ('${edges[1]}','${activity}',NULL,'incorrect','incorrect',NULL,'Pause here'),
                    ('${edges[2]}','${activity}','${alternate}','alternate','outcome','alternate','Take another path');`);
            if (kind === 'route') sql(`INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${run}' FROM learning_activities WHERE id='${activity}'`);
            else if (kind === 'revisit') sql(`INSERT INTO learner_activity_check_ins (id,principal_id,activity_id,play_run_id,note) VALUES ('${checkIn}','${principal}','${activity}','${randomUUID()}','Fixture'); INSERT INTO learner_revisit_runs (id,principal_id,check_in_id,activity_id,revisit_reason) VALUES ('${run}','${principal}','${checkIn}','${activity}','later'); INSERT INTO learner_activity_progress (principal_id,activity_id,status,completed_at,attempt_count,revisit_status,revisit_available_at,revisit_check_in_id) VALUES ('${principal}','${activity}','completed','2026-01-01T00:00:00Z',1,'pending',NOW() - INTERVAL '1 day','${checkIn}')`);
            else sql(`INSERT INTO ${kind === 'recall' ? 'learner_recall_runs' : 'learner_activity_replay_runs'} (id,principal_id,activity_id) VALUES ('${run}','${principal}','${activity}')`);

            const endpoint = `/api/v1/learner/play-runs/${run}/activities/${encodeURIComponent(`id:${activity}`)}`;
            let attempt = 0;
            const answer = async (keys: string[], correct: boolean, target: string | null, label: string | null, expectedKeys = keys) => {
                const response = await owner.request.post(`${endpoint}/answer`, { headers, data: { option_keys: keys, confidence: 'settled' } });
                expect(response.status()).toBe(200); const result = await response.json(); attempt++;
                expect(result).toMatchObject({ selected_option_keys: expectedKeys, is_correct: correct, calibration: correct ? 'aligned' : 'higher_than_result', next_activity_id: target, next_transition_label: label, status: 'in_progress', attempt_number: attempt });
                expect(result.earlier_attempts).toHaveLength(Math.min(attempt - 1, 3));
                const read = await owner.request.get(`/api/v1/learner/play-runs/${run}`); expect(read.status()).toBe(200); const document = await read.json();
                expect(document.activity.id).toBe(activity);
                expect(document.activity.question_feedback).toEqual(result);
                expect(document.private_state.answers[0]).toMatchObject({ activity_id: activity, selected_option_keys: expectedKeys, next_activity_id: target, next_transition_label: label, is_correct: correct });
                expect(sql(`SELECT COUNT(*) FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}' AND status='completed'`).trim()).toBe(kind === 'revisit' ? '1' : '0');
            };
            await answer(['first'], true, next, 'Keep exploring');
            const emptyOutcome = randomUUID();
            sql(`INSERT INTO learning_activity_transitions (id,from_activity_id,to_activity_id,from_connector,trigger,trigger_value,label) VALUES ('${emptyOutcome}','${activity}','${alternate}','empty-outcome','outcome',NULL,'Unspecified outcome')`);
            await answer(['first'], true, alternate, 'Unspecified outcome');
            sql(`DELETE FROM learning_activity_transitions WHERE id='${emptyOutcome}'`);
            await answer(['second'], true, alternate, 'Take another path');
            await answer(['wrong'], false, null, 'Pause here');
            sql(`UPDATE learning_activities SET activity_config=jsonb_set(activity_config,'{allowMultiple}','true') WHERE id='${activity}'`);
            sql(`INSERT INTO learning_activity_transitions (id,from_activity_id,to_activity_id,from_connector,trigger,trigger_value,label) VALUES ('${emptyOutcome}','${activity}','${alternate}','empty-outcome','outcome',NULL,'Unspecified outcome')`);
            await answer(['second', 'first'], true, next, 'Keep exploring', ['first', 'second']);
            // An author changing the selection mode does not rewrite saved
            // answers or invalidate the learner's earlier multiple-choice history.
            sql(`UPDATE learning_activities SET activity_config=jsonb_set(activity_config,'{allowMultiple}','false') WHERE id='${activity}'`);
            const changedMode = await owner.request.get(`/api/v1/learner/play-runs/${run}`);
            expect(changedMode.status()).toBe(200); const preserved = await changedMode.json();
            expect(preserved.activity.question_feedback).toMatchObject({ selected_option_keys: ['first', 'second'], is_correct: true, next_activity_id: next });
            expect(preserved.private_state.answers[0]).toMatchObject({ selected_option_keys: ['first', 'second'], is_correct: true });
            expect((await owner.request.post(`${endpoint}/answer`, { headers, data: { option_keys: ['first', 'second'] } })).status()).toBe(404);
            sql(`UPDATE learning_activities SET activity_config=jsonb_set(activity_config,'{allowMultiple}','true') WHERE id='${activity}'`);
            await answer(['first'], false, null, 'Pause here');
            sql(`DELETE FROM learning_activity_transitions WHERE id='${edges[1]}'`);
            await answer(['wrong'], false, null, null);
            // Rejected choices cannot create an attempt or change the cursor.
            for (const option_keys of [['missing'], ['first', 'first'], []]) {
                expect((await owner.request.post(`${endpoint}/answer`, { headers, data: { option_keys } })).status()).toBe(404);
            }
            expect(sql(`SELECT COUNT(*) FROM learner_question_answers WHERE play_run_id='${run}'`).trim()).toBe(String(attempt));
            sql(`UPDATE learning_activities SET activity_config=jsonb_set(activity_config,'{allowMultiple}','false') WHERE id='${activity}'`);
            await answer(['first'], true, alternate, 'Unspecified outcome');
            const completed = await owner.request.post(`${endpoint}/complete`, { headers, data: {} });
            expect(completed.status()).toBe(200);
            expect(await completed.json()).toMatchObject({ status: kind === 'route' ? 'in_progress' : 'completed', next_activity_id: kind === 'route' ? alternate : null });
            const afterCompletion = await owner.request.get(`/api/v1/learner/play-runs/${run}`);
            expect(afterCompletion.status()).toBe(kind === 'route' ? 200 : 404);
            if (kind === 'route') expect((await afterCompletion.json()).activity.id).toBe(alternate);
            if (kind === 'recall') expect(sql(`SELECT COUNT(*) FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('0');
        } finally {
            sql(`DELETE FROM learning_activity_transitions WHERE from_activity_id='${activity}'`);
            if (map) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
            await admin.close(); await owner.close();
        }
    });
}

function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
