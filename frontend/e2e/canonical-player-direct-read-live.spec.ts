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
        const completePath = reachPath.replace(/reach$/, 'complete');
        const checkInPath = reachPath.replace(/reach$/, 'check-ins');
        expect((await owner.request.post(checkInPath, { headers: reachHeaders, data: { note: 'Before completion' } })).status()).toBe(404);
        sql(`DELETE FROM learner_activity_progress WHERE activity_id='${activity}'`);
        const completed = await owner.request.post(completePath, { headers: reachHeaders }); expect(completed.status()).toBe(200);
        const completedState = await completed.json(); expect(completedState.progress.status).toBe('completed');
        expect((await read()).private_state.activities).toEqual([completedState.progress]);
        for (const endpoint of [completePath, checkInPath]) {
            const data = endpoint === checkInPath ? { note: 'Denied' } : undefined;
            expect((await anonymous.request.post(endpoint, { data })).status()).toBe(401);
            expect((await owner.request.post(endpoint, { data })).status()).toBe(403);
            expect((await owner.request.post(endpoint.replace(activity, randomUUID()), { headers: reachHeaders, data })).status()).toBe(404);
            sql(`UPDATE learning_nodes SET state='locked' WHERE id='${node.node_id}'`);
            try { expect((await owner.request.post(endpoint, { headers: reachHeaders, data })).status()).toBe(404); }
            finally { sql(`UPDATE learning_nodes SET state='available' WHERE id='${node.node_id}'`); }
        }
        for (const data of [{}, { note: ' ' }, { note: 'x'.repeat(501) }, { feeling: 'excellent' }, { next_direction: 'invalid' }]) {
            expect((await owner.request.post(checkInPath, { headers: reachHeaders, data })).status()).toBe(400);
        }
        for (let index = 0; index < 32; index++) {
            const saved = await owner.request.post(checkInPath, { headers: reachHeaders, data: { note: ` Observation ${index} `, feeling: ' forming ', next_direction: 'revisit' } });
            expect(saved.status()).toBe(200); const receipt = await saved.json();
            expect(receipt.note).toBe(`Observation ${index}`); expect(receipt.feeling).toBe('forming');
            expect(receipt.activity_state.progress).toEqual(completedState.progress);
        }
        expect(sql(`SELECT count(*) FROM learner_activity_check_ins WHERE activity_id='${activity}' AND play_run_id IS NULL`).trim()).toBe('30');
        expect(sql(`SELECT note FROM learner_activity_check_ins WHERE activity_id='${activity}' ORDER BY recorded_at LIMIT 1`).trim()).toBe('Observation 2');
        expect(sql(`SELECT revisit_status='pending' AND revisit_available_at BETWEEN NOW()+INTERVAL '71 hours' AND NOW()+INTERVAL '73 hours' AND revisit_check_in_id IS NOT NULL FROM learner_activity_progress WHERE activity_id='${activity}'`).trim()).toBe('t');
        const journal = await owner.request.get('/api/v1/learner/journal'); expect(journal.status()).toBe(200);
        const latest = (await journal.json()).check_ins.find((entry: any) => entry.activity_id === activity);
        expect(latest.note).toBe('Observation 31'); uuid(latest.id);
        // Due-return readers and commands must accept an observation whose
        // originating run is null; only this explicit open creates a revisit.
        sql(`UPDATE learner_activity_progress SET revisit_available_at=NOW()-INTERVAL '1 day' WHERE activity_id='${activity}'`);
        const dueJournal = await owner.request.get('/api/v1/learner/journal'); expect(dueJournal.status()).toBe(200);
        expect((await dueJournal.json()).revisit_invitations.some((entry: any) => entry.check_in_id === latest.id)).toBe(true);
        const reopened = await owner.request.post(`/api/v1/learner/revisit-invitations/${latest.id}/open`, { headers: reachHeaders }); expect(reopened.status()).toBe(200);
        const revisitRun = uuid((await reopened.json()).play_run_id);
        const revisitRead = await owner.request.get(`/api/v1/learner/play-runs/${revisitRun}`); expect(revisitRead.status()).toBe(200);
        expect((await revisitRead.json()).activity.id).toBe(activity);
        sql(`DELETE FROM learner_revisit_runs WHERE id='${revisitRun}'`);
        const settled = await owner.request.post(checkInPath, { headers: reachHeaders, data: { next_direction: 'settle' } }); expect(settled.status()).toBe(200);
        expect(sql(`SELECT revisit_status='none' AND revisit_available_at IS NULL AND revisit_check_in_id IS NULL FROM learner_activity_progress WHERE activity_id='${activity}'`).trim()).toBe('t');
        expect((await owner.request.post(checkInPath, { headers: reachHeaders, data: { next_direction: 'revisit' } })).status()).toBe(200);
        const repeated = await owner.request.post(completePath, { headers: reachHeaders }); expect(repeated.status()).toBe(200);
        expect(await repeated.json()).toEqual(completedState);
        expect(sql(`SELECT revisit_status='none' AND revisit_available_at IS NULL AND revisit_check_in_id IS NULL FROM learner_activity_progress WHERE activity_id='${activity}'`).trim()).toBe('t');
        expect(sql(`SELECT count(*) FROM learner_route_progress WHERE node_id='${node.node_id}'`).trim()).toBe('0');
        expect(sql(`SELECT count(*) FROM learning_activity_starts WHERE node_id='${node.node_id}'`).trim()).toBe('0');
        expect(sql(`SELECT count(*) FROM learner_evidence_events WHERE activity_id='${activity}'`).trim()).toBe('0');
        sql(`DELETE FROM learner_activity_check_ins WHERE activity_id='${activity}'`);
        sql(`DELETE FROM learner_activity_progress WHERE activity_id='${activity}'`);
        noWrites();
        sql(`UPDATE learning_activities SET activity_type='question',activity_config='{"prompt":"Choose","allowMultiple":false,"feedbackIncorrect":"Try another direction","options":[{"key":"right","label":"A","body":"Right","isCorrect":true},{"key":"wrong","label":"B","body":"Wrong","isCorrect":false}]}' WHERE id='${activity}'`);
        const answerPath = reachPath.replace(/reach$/, 'answer');
        expect((await anonymous.request.post(answerPath, { data: { option_keys: ['right'] } })).status()).toBe(401);
        for (const [keys, correct, calibration] of [[['wrong'], false, 'higher_than_result'], [['right'], true, 'aligned']] as const) {
            const answered = await owner.request.post(answerPath, { headers: reachHeaders, data: { option_keys: keys, confidence: 'settled' } }); expect(answered.status()).toBe(200);
            expect(await answered.json()).toMatchObject({ play_run_id: null, is_correct: correct, calibration, recall: null, next_activity_id: null, status: 'in_progress' });
        }
        expect((await owner.request.post(answerPath, { headers: reachHeaders, data: { option_keys: ['right', 'wrong'] } })).status()).toBe(404);
        sql(`UPDATE learning_activities SET activity_config=jsonb_set(activity_config,'{allowMultiple}','true') WHERE id='${activity}'`);
        for (const [keys, correct] of [[['right', 'wrong'], false], [['right'], true]] as const) {
            const answered = await owner.request.post(answerPath, { headers: reachHeaders, data: { option_keys: keys } }); expect(answered.status()).toBe(200);
            expect((await answered.json()).is_correct).toBe(correct);
        }
        expect(toDirectPlaybackPageProps(await read()).progress.answers[activity].earlierAttempts).toHaveLength(3);
        expect(sql(`SELECT count(*) FROM learner_question_answers WHERE activity_id='${activity}' AND play_run_id IS NULL`).trim()).toBe('4');
        noWrites();
        sql(`DELETE FROM learner_question_answers WHERE activity_id='${activity}'; UPDATE learning_activities SET activity_type='open_practice',activity_config='{}' WHERE id='${activity}'`);
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
