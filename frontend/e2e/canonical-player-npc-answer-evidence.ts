import { randomUUID } from 'node:crypto';
import { expect, type BrowserContext, type TestInfo } from '@playwright/test';

type Context = {
    admin: BrowserContext; owner: BrowserContext; peer: BrowserContext;
    adminHeaders: Record<string, string>; headers: Record<string, string>;
    map: string; activity: string; run: string; principal: string; question: string; answer: string;
    sql: (text: string) => string; info: TestInfo;
};

export async function prepareNpcAnswerEvidence(c: Context) {
    const { admin, owner, peer, adminHeaders, headers, activity, run, principal, question, answer, sql } = c;
    const worldResponse = await owner.request.get('/api/v1/learner/world'); expect(worldResponse.status()).toBe(200);
    const world = uuid((await worldResponse.json()).graph.id);
    const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `NPC effects ${randomUUID()}`, description: null, slug: null } });
    expect(created.status()).toBe(201); const map = uuid((await created.json()).map_id);
    const foreignWorld = randomUUID(); const nodes: string[] = []; const slugs: string[] = [];
    const dispose = async () => {
        expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
        sql(`DELETE FROM learning_worlds WHERE id='${foreignWorld}'`);
    };
    try {
        for (let i = 0; i < 4; i++) {
            const created = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: `Effect target ${i}`, description: 'Private authored detail', position_q: i, position_r: 0, state: i === 0 ? 'available' : 'locked', visual_config: i === 3 ? { schedule: { lockAt: '2020-01-01T00:00:00Z' } } : {} } });
            expect(created.status()).toBe(201); nodes.push(uuid((await created.json()).node_id));
        }
        sql(`UPDATE learning_maps SET world_id='${world}',published_at=NOW(),access_roles='["public"]' WHERE id IN ('${map}','${c.map}'); UPDATE learning_nodes SET published_at=NOW() WHERE map_id='${map}'; UPDATE learning_map_assets SET published_at=NOW() WHERE map_id='${map}'; INSERT INTO learning_worlds (id,slug,title,description) VALUES ('${foreignWorld}','${foreignWorld}','Other fixture World','')`);
        for (const node of nodes) slugs.push(sql(`SELECT slug FROM learning_nodes WHERE id='${node}'`).trim());
        const config = { answerLabel: 'A source answer', isCorrect: true, events: { hideNodeIds: [nodes[0], nodes[2], nodes[0], randomUUID()], unlockNodeIds: [nodes[1], nodes[2], nodes[3]] } };
        const configure = (value: unknown, id = answer) => sql(`UPDATE learning_npc_dialogue_nodes SET node_config='${JSON.stringify(value)}' WHERE id='${id}'`);
        configure(config);
        const disconnected = randomUUID();
        sql(`INSERT INTO learning_npc_dialogue_nodes (id,activity_id,node_type,title,sort_order) VALUES ('${disconnected}','${activity}','answer','Disconnected answer',6)`);
        const path = `/api/v1/learner/play-runs/${run}/activities/id:${activity}/npc-dialogue/answer`;
        const write = (id = answer) => owner.request.post(path, { headers, data: { answer_node_id: id } });
        const eventFacts = () => sql(`SELECT jsonb_agg(to_jsonb(e) ORDER BY node_id,event_kind) FROM learner_node_answer_events e WHERE principal_id='${principal}' AND node_id IN (SELECT id FROM learning_nodes WHERE map_id='${map}')`);
        const resetQuestion = () => sql(`UPDATE learner_npc_dialogue_states SET current_node_id='${question}',history='[]' WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`);
        const worldStates = async (context: BrowserContext) => {
            const started = performance.now(); const response = await context.request.get('/api/v1/learner/world'); expect(response.status()).toBe(200); const value = await response.json();
            c.info.annotations.push({ type: 'npc-effect-world-read', description: `${Math.round(performance.now() - started)} ms; ${Buffer.byteLength(JSON.stringify(value))} bytes` });
            const graph = value.graph.maps.find((entry: any) => entry.id === map); expect(graph).toBeDefined();
            const projected = value.world.maps.find((entry: any) => entry.slug === graph.slug);
            return slugs.map((slug) => projected.nodes.find((entry: any) => entry.slug === slug));
        };
        expect((await worldStates(owner)).map((node) => node.state)).toEqual(['available', 'locked', 'locked', 'locked']);
        return {
            map, dispose,
            async rejectInvalidConfiguration() {
                const before = eventFacts();
                for (const invalid of [
                    { ...config, events: { hideNodeIds: ['invalid'] } },
                    { ...config, events: { hideNodeIds: Array(101).fill(nodes[0]) } },
                    { ...config, events: [] },
                ]) { configure(invalid); expect((await write()).status()).toBe(404); expect(eventFacts()).toBe(before); }
                configure(config);
                sql(`UPDATE learning_maps SET world_id='${foreignWorld}' WHERE id='${map}'`);
                expect((await write()).status()).toBe(404); expect(eventFacts()).toBe(before);
                sql(`UPDATE learning_maps SET world_id='${world}' WHERE id='${map}'`);
                expect((await write(randomUUID())).status()).toBe(404);
                expect((await write(disconnected)).status()).toBe(404);
                expect(sql(`SELECT COUNT(*) FROM learner_node_discoveries WHERE principal_id='${principal}' AND node_id IN (SELECT id FROM learning_nodes WHERE map_id='${map}')`).trim()).toBe('0');
                expect(sql(`SELECT COUNT(*) FROM learner_npc_dialogue_answers WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('0');
                expect(sql(`SELECT current_node_id FROM learner_npc_dialogue_states WHERE principal_id='${principal}' AND activity_id='${activity}' AND play_run_id='${run}'`).trim()).toBe(question);
            },
            async verify() {
                const snapshot = JSON.parse(sql(`SELECT jsonb_build_object('answer_node_id',answer_node_id,'question_node_id',question_node_id,'play_run_id',play_run_id,'answer_label',answer_label,'is_correct',is_correct,'feedback',feedback) FROM learner_npc_dialogue_answers WHERE principal_id='${principal}' AND activity_id='${activity}'`));
                expect(snapshot).toEqual({ answer_node_id: answer, question_node_id: question, play_run_id: run, answer_label: 'A source answer', is_correct: true, feedback: null });
                const events = JSON.parse(eventFacts()); expect(events).toHaveLength(5);
                expect(events.every((event: any) => event.source_activity_id === activity && event.source_answer_node_id === answer)).toBe(true);
                const discoveries = sql(`SELECT jsonb_agg(to_jsonb(d) ORDER BY node_id) FROM learner_node_discoveries d WHERE principal_id='${principal}' AND node_id IN (SELECT id FROM learning_nodes WHERE map_id='${map}')`);
                expect(JSON.parse(discoveries)).toHaveLength(4);
                const states = await worldStates(owner); expect(states.map((node) => node.state)).toEqual(['hidden', 'available', 'hidden', 'locked']);
                for (const index of [0, 2]) expect(states[index]).toMatchObject({ title: 'Undiscovered place', description: '' });
                expect((await worldStates(peer)).map((node) => node.state)).toEqual(['available', 'locked', 'locked', 'locked']);
                const after = eventFacts(); expect((await write()).status()).toBe(404); expect(eventFacts()).toBe(after);
                const second = randomUUID();
                sql(`INSERT INTO learning_npc_dialogue_nodes (id,activity_id,node_type,title,sort_order) VALUES ('${second}','${activity}','answer','Second answer',5); INSERT INTO learning_npc_dialogue_transitions (activity_id,from_node_id,to_node_id,from_connector) VALUES ('${activity}','${question}','${second}','answer-1')`);
                configure({ ...config, answerLabel: 'A later answer', isCorrect: false }, second); resetQuestion();
                const repeated = await write(second); expect(repeated.status()).toBe(200); expect(await repeated.json()).toMatchObject({ answer: { answer_key: second, answer_node_id: second, is_correct: false, feedback: null } });
                const repeatedEvents = JSON.parse(eventFacts());
                expect(repeatedEvents.map((event: any) => event.occurred_at)).toEqual(events.map((event: any) => event.occurred_at));
                expect(repeatedEvents.every((event: any) => event.source_answer_node_id === second)).toBe(true);
                expect(sql(`SELECT jsonb_agg(to_jsonb(d) ORDER BY node_id) FROM learner_node_discoveries d WHERE principal_id='${principal}' AND node_id IN (SELECT id FROM learning_nodes WHERE map_id='${map}')`)).toBe(discoveries);
                expect(sql(`SELECT COUNT(*) FROM learner_npc_dialogue_answers WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('2');
                sql(`DELETE FROM learning_npc_dialogue_nodes WHERE id='${answer}'`);
                expect(sql(`SELECT answer_label FROM learner_npc_dialogue_answers WHERE principal_id='${principal}' AND activity_id='${activity}' AND answer_node_id='${answer}'`).trim()).toBe('A source answer');
                sql(`DELETE FROM learning_activities WHERE id='${activity}'`);
                expect(sql(`SELECT COUNT(*) FROM learner_npc_dialogue_answers WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('0');
                const retained = JSON.parse(eventFacts()); expect(retained).toHaveLength(5);
                expect(retained.every((event: any) => event.source_activity_id === null && event.source_answer_node_id === null)).toBe(true);
                expect(retained.map((event: any) => event.occurred_at)).toEqual(events.map((event: any) => event.occurred_at));
                expect((await worldStates(owner)).map((node) => node.state)).toEqual(['hidden', 'available', 'hidden', 'locked']);
            },
        };
    } catch (error) { await dispose(); throw error; }
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
