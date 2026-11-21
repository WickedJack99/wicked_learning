import { execFileSync } from 'node:child_process';
import { expect, type BrowserContext } from '@playwright/test';

export async function verifyCompletedRunCheckIn(owner: BrowserContext, peer: BrowserContext, run: string, activity: string, principal: string, node: string, recall: boolean) {
    for (const id of [run, activity, principal, node]) expect(id).toMatch(/^[a-f0-9-]{36}$/);
    const path = `/api/v1/learner/play-runs/${run}/activities/${encodeURIComponent(`id:${activity}`)}/check-ins`;
    const headers = async (context: BrowserContext) => ({ Origin: new URL((await context.request.get('/api/v1/me')).url()).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
    const ownerHeaders = await headers(owner);
    const count = () => sql(`SELECT count(*) FROM learner_activity_check_ins WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim();
    const before = count();
    const data = { feeling: 'clearer', note: 'A private observation after this run.', next_direction: 'revisit' };
    expect((await owner.request.post(path, { data })).status()).toBe(403);
    expect((await peer.request.post(path, { headers: await headers(peer), data })).status()).toBe(404);
    if (recall) {
        sql(`INSERT INTO learner_activity_progress (principal_id,activity_id,status,completed_at) VALUES ('${principal}','${activity}','completed',NOW())`);
        try { expect((await owner.request.post(path, { headers: ownerHeaders, data })).status()).toBe(404); }
        finally { sql(`DELETE FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`); }
        expect(count()).toBe(before);
        return;
    }
    const untouched = () => sql(`SELECT json_build_object('routes',(SELECT json_agg(p ORDER BY p.activity_start_id) FROM learner_route_progress p WHERE principal_id='${principal}' AND node_id='${node}'),'evidence',(SELECT count(*) FROM learner_evidence_events WHERE principal_id='${principal}' AND activity_id='${activity}'))`).trim();
    const baseline = untouched();
    try {
        for (const state of ['locked', 'hidden']) {
            sql(`UPDATE learning_nodes SET state='${state}' WHERE id='${node}'`);
            expect((await owner.request.post(path, { headers: ownerHeaders, data })).status()).toBe(404);
        }
    } finally { sql(`UPDATE learning_nodes SET state='available' WHERE id='${node}'`); }
    expect(count()).toBe(before);
    const saved = await owner.request.post(path, { headers: ownerHeaders, data });
    expect(saved.status()).toBe(200);
    expect(await saved.json()).toMatchObject({ feeling: 'clearer', note: data.note, next_direction: 'revisit', activity_state: { activity_id: activity, progress: { activity_id: activity, status: 'completed' } } });
    expect(count()).toBe(String(Number(before) + 1));
    expect(sql(`SELECT revisit_status='pending' AND revisit_available_at>NOW()+INTERVAL '2 days' FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('t');
    const settled = await owner.request.post(path, { headers: ownerHeaders, data: { next_direction: 'settle' } });
    expect(settled.status()).toBe(200);
    expect(sql(`SELECT revisit_status='none' AND revisit_available_at IS NULL FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('t');
    expect(count()).toBe(String(Number(before) + 2));
    expect(untouched()).toBe(baseline);
}

function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
