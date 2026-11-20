import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, type BrowserContext } from '@playwright/test';
import { collaborationStorageStatePath } from './session-state';

export async function verifyPlayerRecallControls(owner: BrowserContext, fixture: {
    baseURL: string; run: string; activity: string; principal: string;
    node: string; map: string; asset: string; kind: 'route' | 'revisit' | 'recall' | 'replay';
}) {
    const { run, activity, principal, node, map, asset, kind, baseURL } = fixture;
    const peer = await owner.browser()!.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
    const anonymous = await owner.browser()!.newContext({ baseURL });
    const headersFor = async (context: BrowserContext) => ({ Origin: new URL(baseURL).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
    const headers = await headersFor(owner); const peerHeaders = await headersFor(peer); const anonymousHeaders = await headersFor(anonymous);
    const path = `/api/v1/learner/play-runs/${run}/activities/${encodeURIComponent(`id:${activity}`)}/recall`;
    const feedback = (confidence: string | null) => owner.request.post(`${path}/feedback`, { headers, data: { confidence_after_feedback: confidence } });
    const table = kind === 'route' ? 'learner_route_progress' : kind === 'revisit' ? 'learner_revisit_runs' : kind === 'recall' ? 'learner_recall_runs' : 'learner_activity_replay_runs';
    const column = kind === 'route' ? 'current_play_run_id' : 'id';
    const protectedFacts = () => sql(`SELECT json_build_object(
        'progress',(SELECT to_jsonb(p) FROM learner_activity_progress p WHERE principal_id='${principal}' AND activity_id='${activity}'),
        'run',(SELECT to_jsonb(p) FROM ${table} p WHERE principal_id='${principal}' AND ${column}='${run}'),
        'answers',(SELECT COUNT(*) FROM learner_question_answers WHERE principal_id='${principal}' AND activity_id='${activity}'),
        'check_ins',(SELECT COUNT(*) FROM learner_activity_check_ins WHERE principal_id='${principal}' AND activity_id='${activity}'))`).trim();
    const before = protectedFacts();
    try {
        const queueStarted = performance.now();
        const queue = await owner.request.post(path, { headers }); expect(queue.status()).toBe(200);
        const queueMilliseconds = Math.round(performance.now() - queueStarted);
        const item = await queue.json(); expect(item.recall_item_id).toMatch(/^[a-f0-9-]{36}$/);
        expect((await (await owner.request.post(path, { headers })).json()).recall_item_id).toBe(item.recall_item_id);
        const schedule = () => sql(`SELECT json_build_object('next',next_review_at,'count',review_count,'outcome',last_outcome,'reviewed',last_reviewed_at,'confidence',last_confidence) FROM learner_recall_items WHERE id='${item.recall_item_id}'`).trim();
        const originalSchedule = schedule();
        for (const confidence of ['exploring', 'leaning', 'settled', null]) {
            const saved = await feedback(confidence); expect(saved.status()).toBe(200); expect(await saved.json()).toEqual({ updated: true });
            expect(sql(`SELECT COALESCE(last_confidence_after_feedback,'NULL') FROM learner_recall_items WHERE id='${item.recall_item_id}'`).trim()).toBe(confidence ?? 'NULL');
            expect(schedule()).toBe(originalSchedule);
        }
        expect((await feedback('settled')).status()).toBe(200);
        expect((await owner.request.post(`${path}/feedback`, { headers, data: {} })).status()).toBe(200);
        expect(sql(`SELECT COALESCE(last_confidence_after_feedback,'NULL') FROM learner_recall_items WHERE id='${item.recall_item_id}'`).trim()).toBe('NULL');
        expect((await feedback('certain')).status()).toBe(400);
        expect((await owner.request.post(`${path}/feedback`, { headers, data: { confidence_after_feedback: 42 } })).status()).toBe(422);
        expect((await owner.request.post(`${path}/feedback`, { headers, data: { confidence_after_feedback: 'settled', principal_id: randomUUID() } })).status()).toBe(422);
        expect((await owner.request.post(`${path}/feedback`, { data: { confidence_after_feedback: 'settled' } })).status()).toBe(403);
        expect((await peer.request.post(`${path}/feedback`, { headers: peerHeaders, data: { confidence_after_feedback: 'settled' } })).status()).toBe(404);
        expect((await anonymous.request.post(`${path}/feedback`, { headers: anonymousHeaders, data: { confidence_after_feedback: 'settled' } })).status()).toBe(401);
        for (const method of ['post', 'delete'] as const) {
            expect((await owner.request[method](path)).status()).toBe(403);
            expect((await peer.request[method](path, { headers: peerHeaders })).status()).toBe(404);
            expect((await anonymous.request[method](path, { headers: anonymousHeaders })).status()).toBe(401);
        }
        expect((await owner.request.post(path.replace(run, randomUUID()), { headers })).status()).toBe(404);
        expect((await owner.request.post(path.replace(activity, randomUUID()), { headers })).status()).toBe(404);
        const unavailable = async () => {
            expect((await owner.request.post(path, { headers })).status()).toBe(404);
            expect((await feedback('settled')).status()).toBe(404);
            expect((await owner.request.delete(path, { headers })).status()).toBe(404);
        };
        for (const state of ['locked', 'hidden']) {
            sql(`UPDATE learning_nodes SET state='${state}' WHERE id='${node}'`);
            try { await unavailable(); } finally { sql(`UPDATE learning_nodes SET state='available' WHERE id='${node}'`); }
        }
        for (const [table, predicate] of [
            ['learning_maps', `id='${map}'`], ['learning_nodes', `id='${node}'`],
            ['learning_map_assets', `id='${asset}'`], ['learning_routes', `map_asset_id='${asset}'`],
            ['learning_activities', `id='${activity}'`],
        ]) {
            sql(`UPDATE ${table} SET published_at=NULL WHERE ${predicate}`);
            try { await unavailable(); } finally { sql(`UPDATE ${table} SET published_at=NOW() WHERE ${predicate}`); }
        }
        sql(`UPDATE learning_maps SET access_roles='[]' WHERE id='${map}'`);
        try { await unavailable(); } finally { sql(`UPDATE learning_maps SET access_roles='["public"]' WHERE id='${map}'`); }
        sql(`UPDATE ${table} SET status='completed'${kind === 'route' ? '' : ',completed_at=NOW()'} WHERE ${column}='${run}'`);
        try { await unavailable(); } finally { sql(`UPDATE ${table} SET status='in_progress'${kind === 'route' ? '' : ',completed_at=NULL'} WHERE ${column}='${run}'`); }
        expect(schedule()).toBe(originalSchedule);
        expect(sql(`SELECT COALESCE(last_confidence_after_feedback,'NULL') FROM learner_recall_items WHERE id='${item.recall_item_id}'`).trim()).toBe('NULL');
        const removed = await owner.request.delete(path, { headers }); expect(removed.status()).toBe(200); expect(await removed.json()).toEqual({ removed: true });
        const repeated = await owner.request.delete(path, { headers }); expect(repeated.status()).toBe(200); expect(await repeated.json()).toEqual({ removed: false });
        const absent = await feedback('settled'); expect(absent.status()).toBe(200); expect(await absent.json()).toEqual({ updated: false });
        expect(protectedFacts()).toBe(before);
        expect(sql(`SELECT COUNT(*) FROM learner_recall_items WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('0');
        return queueMilliseconds;
    } finally {
        await peer.close(); await anonymous.close();
    }
}

function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
