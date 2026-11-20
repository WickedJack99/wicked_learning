import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, type BrowserContext, type TestInfo } from '@playwright/test';

export async function verifyPlaybackReach(owner: BrowserContext, peer: BrowserContext, run: string, activity: string, principal: string, node: string, recall: boolean, info: TestInfo) {
    for (const value of [run, activity, principal, node]) expect(value).toMatch(/^[a-f0-9-]{36}$/);
    const csrf = await (await owner.request.get('/api/v1/security/csrf')).json();
    const origin = new URL((await owner.request.get('/api/v1/me')).url()).origin;
    const headers = { Origin: origin, 'X-CSRF-Token': csrf.token };
    const base = `/api/v1/learner/play-runs/${run}/activities/`;
    const path = `${base}${encodeURIComponent(`id:${activity}`)}/reach`;
    const count = () => sql(`SELECT count(*) FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim();
    expect(count()).toBe('0');
    expect((await owner.request.post(path)).status()).toBe(403);
    const peerCsrf = await (await peer.request.get('/api/v1/security/csrf')).json();
    expect((await peer.request.post(path, { headers: { ...headers, 'X-CSRF-Token': peerCsrf.token } })).status()).toBe(404);
    expect((await owner.request.post(`${base}${encodeURIComponent(`id:${randomUUID()}`)}/reach`, { headers })).status()).toBe(404);
    expect((await owner.request.post(`${base}id%3Anot-a-uuid/reach`, { headers })).status()).toBe(404);
    for (const [hide, restore] of [
        [`UPDATE learning_activities SET published_at=NULL WHERE id='${activity}'`, `UPDATE learning_activities SET published_at=NOW() WHERE id='${activity}'`],
        [`UPDATE learning_nodes SET state='locked' WHERE id='${node}'`, `UPDATE learning_nodes SET state='available' WHERE id='${node}'`],
        [`UPDATE learning_nodes SET state='hidden' WHERE id='${node}'`, `UPDATE learning_nodes SET state='available' WHERE id='${node}'`],
        [`UPDATE learning_maps SET access_roles='[]' WHERE id=(SELECT map_id FROM learning_nodes WHERE id='${node}')`, `UPDATE learning_maps SET access_roles='["public"]' WHERE id=(SELECT map_id FROM learning_nodes WHERE id='${node}')`],
    ]) {
        sql(hide);
        try { expect((await owner.request.post(path, { headers })).status()).toBe(404); }
        finally { sql(restore); }
    }
    expect(count()).toBe('0');
    const started = performance.now();
    const response = await owner.request.post(path, { headers });
    expect(response.status()).toBe(200);
    const state = await response.json();
    expect(state).toEqual({
        activity_id: activity, item_obstacle: null, obstacle_resolved_at: null,
        progress: recall ? null : { activity_id: activity, status: 'reached', completed_at: null },
    });
    info.annotations.push({ type: 'native-player-reach', description: `${recall ? 'recall' : 'ordinary'}: ${Math.round(performance.now() - started)} ms` });
    const repeated = await owner.request.post(`${base}same-activity/reach`, { headers });
    expect(repeated.status()).toBe(200);
    expect(await repeated.json()).toEqual(state);
    expect(count()).toBe(recall ? '0' : '1');
    sql(`INSERT INTO learner_activity_progress (principal_id,activity_id,status,completed_at) VALUES ('${principal}','${activity}','completed','2026-01-01T00:00:00Z') ON CONFLICT (principal_id,activity_id) DO UPDATE SET status='completed',completed_at='2026-01-01T00:00:00Z'`);
    try {
        const preserved = await owner.request.post(path, { headers });
        expect(preserved.status()).toBe(200);
        expect((await preserved.json()).progress).toEqual({ activity_id: activity, status: 'completed', completed_at: '2026-01-01T00:00:00.000000Z' });
        expect((await (await owner.request.get(`/api/v1/learner/play-runs/${run}`)).json()).activity.id).toBe(activity);
        expect(sql(`SELECT count(*) FROM learner_activity_check_ins WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`).trim()).toBe('0');
        expect(sql(`SELECT count(*) FROM learner_evidence_events WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`).trim()).toBe('0');
    } finally {
        sql(`DELETE FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`);
    }
}

export async function verifyReachEntryContext(owner: BrowserContext, run: string, activity: string, principal: string, recall: boolean) {
    for (const value of [run, activity, principal]) expect(value).toMatch(/^[a-f0-9-]{36}$/);
    const config = sql(`SELECT activity_config FROM learning_activities WHERE id='${activity}'`).trim();
    const previousTopics = sql(`SELECT last_competence_topics FROM application_principals WHERE id='${principal}'`).trim();
    const topic = `reach-${randomUUID()}`;
    const path = `/api/v1/learner/play-runs/${run}/activities/${encodeURIComponent(`id:${activity}`)}/reach`;
    const headers = { Origin: new URL((await owner.request.get('/api/v1/me')).url()).origin, 'X-CSRF-Token': (await (await owner.request.get('/api/v1/security/csrf')).json()).token };
    try {
        sql(`UPDATE learning_activities SET activity_config=activity_config || '{"competenceTopics":[{"slug":"${topic}","topic":"Entry topic","weight":1}]}' WHERE id='${activity}'; UPDATE learner_route_progress SET last_entered_at='2026-01-01T00:00:00Z' WHERE principal_id='${principal}' AND current_play_run_id='${run}'`);
        expect((await owner.request.post(path, { headers })).status()).toBe(200);
        const topics = sql(`SELECT last_competence_topics FROM application_principals WHERE id='${principal}'`).trim();
        expect(JSON.parse(topics)).toEqual(recall ? JSON.parse(previousTopics) : [{ slug: topic, topic: 'Entry topic' }]);
        if (!recall) expect(sql(`SELECT last_entered_at>'2026-01-01T00:00:00Z' FROM learner_route_progress WHERE principal_id='${principal}' AND current_play_run_id='${run}'`).trim()).toBe('t');
        const transitions = () => sql(`SELECT COALESCE(sum(transition_count),0) FROM learner_competence_topic_transitions WHERE principal_id='${principal}' AND to_topic_slug='${topic}'`).trim();
        const entered = transitions();
        expect((await owner.request.post(path, { headers })).status()).toBe(200);
        expect(transitions()).toBe(entered);
        if (recall) expect(entered).toBe('0');
    } finally {
        sql(`UPDATE learning_activities SET activity_config='${config.replaceAll("'", "''")}' WHERE id='${activity}'; UPDATE application_principals SET last_competence_topics='${previousTopics.replaceAll("'", "''")}' WHERE id='${principal}'; DELETE FROM learner_competence_topic_transitions WHERE principal_id='${principal}' AND (to_topic_slug='${topic}' OR from_topic_slug='${topic}'); DELETE FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`);
    }
}

function sql(query: string) {
    return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}
