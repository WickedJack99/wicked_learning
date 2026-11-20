import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, type BrowserContext, type TestInfo } from '@playwright/test';

// SharedTaskStateSerializer source rules, exercised against real Rust/PostgreSQL.
export async function verifyPlaybackSharedState(owner: BrowserContext, peer: BrowserContext, principal: string, run: string, active: string, inactive: string, headers: Record<string, string>, info: TestInfo) {
    const path = `/api/v1/learner/play-runs/${run}`;
    const base = `${path}/activities/${encodeURIComponent(`id:${inactive}`)}/shared-task`;
    const peerSubject = uuid((await (await peer.request.get('/api/v1/me')).json()).subject_id);
    const peerPrincipal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${peerSubject}'`).trim());
    const reviewers = Array.from({ length: 7 }, () => randomUUID());
    const reviews = Array.from({ length: 7 }, () => randomUUID()).sort();
    const submissions = Array.from({ length: 6 }, () => randomUUID()).sort();
    const older = randomUUID(); const latest = randomUUID(); const recentReview = randomUUID(); const oldRun = randomUUID();
    const scale = Array.from({ length: 100 }, () => randomUUID());
    const config = { threshold: 3, showContributions: true, peerReviewEnabled: true, peerReviewPrompt: 'What did you notice?', minimumLength: 1, repeatPolicy: 'unlimited', projectSteps: ['Notice', 'Explain'] };
    const read = async () => { const response = await owner.request.get(path); expect(response.status()).toBe(200); return response.json(); };
    const state = (doc) => doc.graph.activities.find((a) => a.id === inactive).shared_task_state;
    const submission = (id: string, who: string, body: string, shared: boolean, time: string) => `INSERT INTO learner_shared_task_submissions (id,activity_id,principal_id,play_run_id,body,share_with_peers,task_kind,validation_mode,project_step_index,accepted_at) VALUES ('${id}','${inactive}','${who}','${randomUUID()}','${body}',${shared},'reflection','none',1,'${time}');`;
    try {
        sql(`UPDATE learning_activities SET activity_type='shared_task',activity_config='${JSON.stringify(config)}' WHERE id='${inactive}';`);
        const empty = state(await read());
        expect(empty).toMatchObject({ accepted_count: 0, remaining: 3, is_complete: false, latest_submission_at: null, has_submitted: false, submission: null, contributions: [], peer_review: { enabled: true, prompt: config.peerReviewPrompt, has_reviewed: false, submitted_review: null, reviewable_contributions: [], received_reviews: [] } });
        expect((await owner.request.post(`${base}/submissions`, { headers, data: { body: 'Inactive activity must not accept writes.', share_with_peers: true } })).status()).toBe(404);
        sql(submissions.map((id, index) => submission(id, peerPrincipal, index === 5 ? '🙂'.repeat(501) : `Shared peer ${index}`, true, '2026-01-01T00:00:00Z')).join('\n')
            + submission(randomUUID(), peerPrincipal, 'Private peer submission must stay private', false, '2026-01-03T00:00:00Z')
            + `UPDATE learner_shared_task_submissions SET revised_body='${'é'.repeat(501)}',revised_at='2026-01-02T00:00:00Z' WHERE id='${submissions[5]}';`);
        const beforeParticipation = state(await read());
        expect(beforeParticipation).toMatchObject({ accepted_count: 7, remaining: 0, is_complete: true, latest_submission_at: '2026-01-03T00:00:00.000000Z', has_submitted: false, peer_review: { reviewable_contributions: [], received_reviews: [] } });
        expect(beforeParticipation.contributions).toHaveLength(5);
        expect(beforeParticipation.contributions[0]).toMatchObject({ body: 'é'.repeat(500), truncated: true, project_step: 'Explain', task_kind: 'reflection' });
        expect(beforeParticipation.contributions[4].body).toBe('Shared peer 1');
        sql(submission(older, principal, 'Older own submission', true, '2026-01-02T00:00:00Z')
            + submission(latest, principal, 'Latest own submission', true, '2026-01-04T00:00:00Z')
            + reviewers.map((id, index) => `INSERT INTO application_principals (id,identity_subject_id) VALUES ('${id}','${randomUUID()}');
              INSERT INTO learner_shared_task_reviews (id,activity_id,submission_id,reviewer_principal_id,body,response_type,project_step_index,created_at) VALUES ('${reviews[index]}','${inactive}','${older}','${id}','Review ${index}','question',0,'2026-01-05T00:00:00Z');`).join('\n')
            + `INSERT INTO learner_shared_task_review_follow_ups (activity_id,review_id,contributor_principal_id,body) VALUES ('${inactive}','${reviews[6]}','${principal}','Own follow-up'),('${inactive}','${reviews[6]}','${peerPrincipal}','Private peer follow-up');
              INSERT INTO learner_shared_task_checklists (principal_id,activity_id,play_run_id,completed_step_indexes) VALUES ('${principal}','${inactive}','${run}',ARRAY[1,0,1]::smallint[]),('${principal}','${inactive}','${oldRun}',ARRAY[1]::smallint[]),('${peerPrincipal}','${inactive}','${run}',ARRAY[1]::smallint[]);`);
        const started = performance.now(); const populated = state(await read());
        info.annotations.push({ type: 'native-playback-shared', description: `${Math.round(performance.now() - started)} ms; ${Buffer.byteLength(JSON.stringify(populated))} state bytes` });
        expect(populated).toMatchObject({ accepted_count: 9, submission: { id: latest, body: 'Latest own submission', can_revise: false }, checklist: { completed_step_indexes: [0, 1] } });
        expect(populated.peer_review.reviewable_contributions.map((entry) => entry.id)).toEqual(submissions.slice(1).reverse());
        expect(populated.peer_review.reviewable_contributions[0]).toMatchObject({ body: '🙂'.repeat(500), truncated: true });
        expect(populated.peer_review.received_reviews.map((entry) => entry.id)).toEqual(reviews.slice(2).reverse());
        expect(populated.peer_review.received_reviews[0]).toMatchObject({ follow_up: 'Own follow-up', project_step: 'Notice' });
        for (const privateValue of [peerPrincipal, ...reviewers, 'Private peer submission', 'Private peer follow-up']) expect(JSON.stringify(populated)).not.toContain(privateValue);
        sql(`INSERT INTO learner_shared_task_reviews (id,activity_id,submission_id,reviewer_principal_id,body,created_at) VALUES ('${recentReview}','${inactive}','${latest}','${peerPrincipal}','Latest contribution review','2026-01-06T00:00:00Z')`);
        expect(state(await read()).submission.can_revise).toBe(true);
        sql(`UPDATE learning_activities SET activity_config=activity_config || '{"peerReviewEnabled":false}' WHERE id='${inactive}'`);
        expect(state(await read())).toMatchObject({ submission: { can_revise: true }, peer_review: null });
        sql(`UPDATE learning_activities SET activity_config=activity_config || '{"showContributions":false,"peerReviewEnabled":true}' WHERE id='${inactive}'`);
        expect(state(await read())).toMatchObject({ accepted_count: 9, contributions: [], can_share_contributions: false, peer_review: null, submission: { id: latest } });
        sql(`UPDATE learning_activities SET activity_config='${JSON.stringify(config)}' WHERE id='${inactive}';
            UPDATE learner_route_progress SET current_activity_id='${inactive}' WHERE principal_id='${principal}' AND current_play_run_id='${run}'`);
        const current = await read(); expect(current.activity.shared_task).toEqual(state(current));
        const peerCsrf = (await (await peer.request.get('/api/v1/security/csrf')).json()).token;
        const peerHeaders = { ...headers, 'X-CSRF-Token': peerCsrf };
        expect((await peer.request.patch(`${base}/submissions/${latest}/revision`, { headers: peerHeaders, data: { body: 'Unauthorized revision' } })).status()).toBe(404);
        expect((await owner.request.patch(`${base}/submissions/${latest}/revision`, { data: { body: 'Missing CSRF' } })).status()).toBe(403);
        const postReview = await owner.request.post(`${base}/reviews`, { headers, data: { submission_id: submissions[5], body: 'A specific response to the contribution.', project_step_index: 0, response_type: 'example' } });
        expect(postReview.status()).toBe(200);
        expect(await postReview.json()).toEqual(state(await read()));
        const helpful = await owner.request.patch(`${base}/reviews/${recentReview}/helpfulness`, { headers, data: { helpful: true } });
        expect(helpful.status()).toBe(200); expect(await helpful.json()).toEqual(state(await read()));
        const followUp = await owner.request.patch(`${base}/reviews/${recentReview}/follow-up`, { headers, data: { body: 'I will use this suggestion.' } });
        expect(followUp.status()).toBe(200); expect(await followUp.json()).toEqual(state(await read()));
        const revision = await owner.request.patch(`${base}/submissions/${latest}/revision`, { headers, data: { body: 'Revised from the specific feedback.' } });
        expect(revision.status()).toBe(200); expect(await revision.json()).toEqual(state(await read()));
        expect(state(await read()).submission).toMatchObject({ revised_body: 'Revised from the specific feedback.', can_revise: false });
        expect((await owner.request.patch(`${base}/submissions/${latest}/revision`, { headers, data: { body: 'Second revision' } })).status()).toBe(404);
        const checklist = await owner.request.post(`${base}/checklist`, { headers, data: { completed_step_indexes: [1, 0, 1] } });
        expect(checklist.status()).toBe(200); expect(await checklist.json()).toEqual({ completed_step_indexes: [0, 1] });
        expect(state(await read()).checklist.completed_step_indexes).toEqual([0, 1]);
        for (const indexes of [[-1], [6], Array(7).fill(0)]) expect((await owner.request.post(`${base}/checklist`, { headers, data: { completed_step_indexes: indexes } })).status()).toBe(400);
        expect((await owner.request.post(`${base}/checklist`, { headers, data: { completed_step_indexes: [2] } })).status()).toBe(404);
        expect(state(await read()).checklist.completed_step_indexes).toEqual([0, 1]);
        sql(`UPDATE learner_route_progress SET current_activity_id='${active}' WHERE principal_id='${principal}' AND current_play_run_id='${run}';
            ${scale.map((id, i) => `INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) VALUES ('${id}','${inactive}','${id}','Shared scale fixture','',${i + 5},NOW(),'shared_task','${JSON.stringify(config)}');`).join('\n')}`);
        const scaleStarted = performance.now(); const scaled = await read();
        expect(scaled.graph.activities.filter((a) => scale.includes(a.id))).toHaveLength(100);
        for (const entry of scaled.graph.activities.filter((a) => scale.includes(a.id))) expect(entry.shared_task_state).toEqual(empty);
        info.annotations.push({ type: 'native-playback-shared-scale', description: `${Math.round(performance.now() - scaleStarted)} ms; ${Buffer.byteLength(JSON.stringify(scaled))} bytes; 100 additional empty Shared Tasks` });
        sql(`UPDATE learning_activities SET published_at=NULL WHERE id='${inactive}'`);
        expect((await read()).graph.activities.some((a) => a.id === inactive)).toBe(false);
        sql(`UPDATE learning_activities SET published_at=NOW(),activity_config=activity_config || '{"threshold":0}' WHERE id='${inactive}'`);
        expect((await owner.request.get(path)).status()).toBe(503);
    } finally {
        sql(`UPDATE learner_route_progress SET current_activity_id='${active}' WHERE principal_id='${principal}' AND current_play_run_id='${run}';
            DELETE FROM learner_shared_task_submissions WHERE activity_id='${inactive}';
            DELETE FROM learner_shared_task_checklists WHERE activity_id='${inactive}';
            DELETE FROM learning_activities WHERE id IN (${scale.map((id) => `'${id}'`).join(',')});
            DELETE FROM application_principals WHERE id IN (${reviewers.map((id) => `'${id}'`).join(',')});
            UPDATE learning_activities SET activity_type='open_practice',activity_config='{}',published_at=NOW() WHERE id='${inactive}';`);
    }
}

function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(query: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
