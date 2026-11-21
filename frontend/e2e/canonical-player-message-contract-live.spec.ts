import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

for (const scenario of ['reply-order', 'responded-hidden', 'disabled', 'invalid-target', 'helpful-serial', 'pagination'] as const) {
    test(`native message wall preserves source ${scenario}`, async ({ browser, baseURL }) => {
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        for (const path of ['app/Http/Controllers/LearnerMessageController.php', 'app/Learning/Queries/LoadLearnerMessages.php', 'app/Learning/Actions/CreateLearnerMessageResponse.php', 'app/Learning/Actions/MarkLearnerMessageResponseHelpful.php']) {
            expect(readFileSync(`../${path}`)).toEqual(execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:${path}`]));
        }
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owner = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('first') });
        const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
        const headersFor = async (context: typeof admin) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
        const adminHeaders = await headersFor(admin); const headers = await headersFor(owner);
        const principalFor = async (context: typeof admin) => {
            const me = await context.request.get('/api/v1/me'); expect(me.status()).toBe(200);
            return uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim());
        };
        const principal = await principalFor(owner); const other = await principalFor(peer);
        const activity = randomUUID(); const start = randomUUID(); const run = randomUUID(); const topic = randomUUID();
        const message = randomUUID(); const ownMessage = randomUUID(); const responses = Array.from({ length: 5 }, () => randomUUID());
        const extraPrincipals = Array.from({ length: 12 }, () => randomUUID()); let map: string | undefined;
        const path = `/api/v1/learner/play-runs/${run}/activities/id:${activity}/peer-wall`;
        const wall = async (query = '') => { const response = await owner.request.get(path + query); expect(response.status()).toBe(200); return response.json(); };
        const respond = (id: string, body = 'A response to the question') => owner.request.post(`${path}/messages/${id}/responses`, { headers, data: { body, response_type: 'example' } });
        const helpful = (id: string, value = true) => owner.request.patch(`${path}/messages/${ownMessage}/responses/${id}/helpfulness`, { headers, data: { helpful: value } });
        try {
            const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Message contract ${randomUUID()}`, description: null, slug: null } });
            expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
            const createdNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Message contract place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
            expect(createdNode.status()).toBe(201); const node = await createdNode.json(); uuid(node.node_id); uuid(node.asset_id);
            sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}';
                UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}';
                UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_message_topics (id,map_asset_id,slug,title) VALUES ('${topic}','${node.asset_id}','message-contract','Source message topic');
                INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config)
                    SELECT '${activity}',id,'wall','Message wall','',0,NOW(),'message_wall','{"messageTopicId":"${topic}","messageAudience":"peers","messageAllowResponses":true}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}');
                INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id)
                    SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${run}' FROM learning_activities WHERE id='${activity}';
                INSERT INTO learner_messages (id,topic_id,principal_id,audience,body) VALUES ('${message}','${topic}','${other}','peers','Peer question'), ('${ownMessage}','${topic}','${principal}','peers','Own question');
                ${extraPrincipals.map((id) => `INSERT INTO application_principals (id,identity_subject_id) VALUES ('${id}','${randomUUID()}');`).join('\n')}
                ${responses.map((id, i) => `INSERT INTO learner_message_responses (id,message_id,responder_principal_id,body,response_type,created_at,helpful_at) VALUES ('${id}','${ownMessage}','${extraPrincipals[i]}','Reply ${i}','example','2024-01-0${i + 1}T12:00:00Z',${i === 0 ? 'NOW()' : 'NULL'});`).join('\n')}`);
            if (scenario === 'reply-order') {
                const document = await wall();
                expect(document.messages.find((entry: any) => entry.id === ownMessage).responses.map((reply: any) => reply.id)).toEqual([responses[0], responses[2], responses[3], responses[4]]);
                for (const id of [principal, other, ...extraPrincipals]) expect(JSON.stringify(document)).not.toContain(id);
            } else if (scenario === 'responded-hidden') {
                const hidden = randomUUID();
                sql(`INSERT INTO learner_message_responses (id,message_id,responder_principal_id,body,hidden_at,created_at) VALUES ('${hidden}','${message}','${principal}','Hidden earlier reply',NOW(),'2020-01-01T12:00:00Z')`);
                const document = await wall(); const entry = document.messages.find((entry: any) => entry.id === message);
                expect(entry.has_responded).toBe(true); expect(JSON.stringify(document)).not.toContain('Hidden earlier reply');
                expect((await respond(message, 'A retry must not replace the old reply')).status()).toBe(200);
                expect(sql(`SELECT body FROM learner_message_responses WHERE id='${hidden}'`).trim()).toBe('Hidden earlier reply');
                sql(`UPDATE learner_message_responses SET hidden_at=NULL WHERE id='${hidden}'; ${responses.slice(0, 3).map((_, i) => `INSERT INTO learner_message_responses (message_id,responder_principal_id,body) VALUES ('${message}','${extraPrincipals[i]}','Newer visible reply ${i}');`).join('')}`);
                const older = (await wall()).messages.find((entry: any) => entry.id === message);
                expect(older.has_responded).toBe(true); expect(older.responses.map((reply: any) => reply.id)).not.toContain(hidden);
            } else if (scenario === 'disabled') {
                sql(`UPDATE learning_activities SET activity_config=jsonb_set(activity_config,'{messageAllowResponses}','false') WHERE id='${activity}'`);
                const document = await wall();
                for (const entry of document.messages) expect(entry).toMatchObject({ can_respond: false, has_responded: false, responses: [] });
                expect((await respond(message)).status()).toBe(404);
                expect((await helpful(responses[4])).status()).toBe(404);
                expect(sql(`SELECT id FROM learner_message_responses WHERE message_id='${ownMessage}' AND helpful_at IS NOT NULL`).trim()).toBe(responses[0]);
            } else if (scenario === 'invalid-target') {
                for (const id of [randomUUID(), ownMessage]) expect((await respond(id)).status()).toBe(404);
                sql(`UPDATE learner_messages SET hidden_at=NOW() WHERE id='${message}'`);
                expect((await respond(message)).status()).toBe(404);
                sql(`UPDATE learner_messages SET hidden_at=NULL,audience='support' WHERE id='${message}'`);
                expect((await respond(message)).status()).toBe(404);
                const otherTopic = randomUUID();
                sql(`UPDATE learner_messages SET audience='peers' WHERE id='${message}'; INSERT INTO learning_message_topics (id,map_asset_id,slug,title) VALUES ('${otherTopic}','${node.asset_id}','other-topic','Other topic'); UPDATE learner_messages SET topic_id='${otherTopic}' WHERE id='${message}'`);
                expect((await respond(message)).status()).toBe(404);
                sql(`UPDATE learner_messages SET topic_id='${topic}' WHERE id='${message}'`);
                expect(sql(`SELECT COUNT(*) FROM learner_message_responses WHERE message_id='${message}'`).trim()).toBe('0');
                expect((await respond(message)).status()).toBe(200);
                expect((await respond(message, 'Retry body')).status()).toBe(200);
                expect(sql(`SELECT body FROM learner_message_responses WHERE message_id='${message}'`).trim()).toBe('A response to the question');
                expect((await peer.request.post(`${path}/messages/${ownMessage}/responses`, { headers: await headersFor(peer), data: { body: 'Wrong run owner' } })).status()).toBe(404);
                expect((await owner.request.post(`${path}/messages/${message}/responses`, { data: { body: 'Missing CSRF' } })).status()).toBe(403);
            } else if (scenario === 'helpful-serial') {
                for (let i = 0; i < 3; i++) {
                    const results = await Promise.all([helpful(responses[3]), helpful(responses[4])]);
                    expect(results.map((result) => result.status())).toEqual([200, 200]);
                    const selected = sql(`SELECT id FROM learner_message_responses WHERE message_id='${ownMessage}' AND helpful_at IS NOT NULL`).trim();
                    expect([responses[3], responses[4]]).toContain(selected);
                    expect((await helpful(selected, false)).status()).toBe(200);
                    expect(sql(`SELECT COUNT(*) FROM learner_message_responses WHERE message_id='${ownMessage}' AND helpful_at IS NOT NULL`).trim()).toBe('0');
                }
                expect((await helpful(randomUUID())).status()).toBe(404);
            } else {
                sql(extraPrincipals.map((id, i) => `INSERT INTO learner_messages (topic_id,principal_id,audience,body) VALUES ('${topic}','${id}','peers','Page message ${i}');`).join('\n'));
                const desktop = await wall('?page=1&per_page=10'); expect(desktop.messages).toHaveLength(10); expect(desktop.pagination).toMatchObject({ total: 14, last_page: 2 });
                const narrow = await wall('?page=1&per_page=3'); expect(narrow.messages).toHaveLength(3); expect(narrow.pagination.last_page).toBe(5);
                const maximum = await wall('?page=1&per_page=12'); expect(maximum.messages).toHaveLength(12);
                const absent = await wall('?page=6&per_page=3'); expect(absent.messages).toEqual([]); expect(absent.pagination).toEqual({ current_page: 6, last_page: 5, per_page: 3, total: 14 });
            }
        } finally {
            if (map) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
            sql(`DELETE FROM application_principals WHERE id IN (${extraPrincipals.map((id) => `'${id}'`).join(',')})`);
            await Promise.all([admin.close(), owner.close(), peer.close()]);
        }
    });
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
