import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { expect, type BrowserContext, type TestInfo } from '@playwright/test';

// LearningNodeSerializer::reviewContexts and LearningActivitySerializer::reviewContext:
// owner-only, latest three per category, blank subtopic includes all subtopics.
export async function verifyPlaybackReviews(owner: BrowserContext, peer: BrowserContext, path: string, node: string, active: string, info: TestInfo) {
    const principal = await principalId(owner); const other = await principalId(peer);
    const route = uuid(sql(`SELECT route_id FROM learning_activities WHERE id='${active}'`).trim());
    const originalTitle = sql(`SELECT title FROM learning_nodes WHERE id='${node}'`).trim();
    const topic = randomUUID(); const fallback = randomUUID();
    const pages = Array.from({ length: 4 }, () => randomUUID());
    const activities = Array.from({ length: 7 }, () => randomUUID());
    const scaleActivities = Array.from({ length: 100 }, () => randomUUID());
    const reflections = Array.from({ length: 6 }, () => randomUUID()).sort();
    const configs = [
        { topic: ` ${topic} `, subtopic: ' specific ' },
        { topic, learningIntent: 'review' },
        { topic: ' ', subtopic: ' ' },
        { topic: randomUUID() },
        { topic, subtopic: 'specific' },
        { topic },
        { topic, learningIntent: 'review' },
    ];
    try {
        sql(`UPDATE learning_nodes SET title='${fallback}' WHERE id='${node}';
            INSERT INTO learner_journal_pages (id,principal_id,title,topic,subtopic) VALUES
                ('${pages[0]}','${principal}','Fixture','${topic}','specific'),
                ('${pages[1]}','${principal}','Fixture','${topic}','other'),
                ('${pages[2]}','${principal}','Fixture','${fallback}',''),
                ('${pages[3]}','${other}','Fixture','${topic}','specific');
            ${activities.map((id, i) => `INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) VALUES ('${id}','${route}','${id}','Review fixture','',${i + 20},NOW(),'${i === 1 || i === 5 ? 'reflection' : i === 6 ? 'open_practice' : 'review'}','${JSON.stringify(configs[i])}');`).join('\n')}
            ${reflections.slice(0, 4).map((id, i) => `INSERT INTO learner_reflections (id,principal_id,learner_journal_page_id,activity_id,play_run_id,title,question,reflection,created_at) VALUES ('${id}','${principal}','${pages[0]}','${active}','${randomUUID()}','Fixture','Question ${i}','Specific ${i}','2026-01-01T00:00:00Z');`).join('\n')}
            INSERT INTO learner_reflections (id,principal_id,learner_journal_page_id,activity_id,play_run_id,title,question,reflection,created_at) VALUES
                ('${reflections[4]}','${principal}','${pages[1]}','${active}','${randomUUID()}','Fixture','Other question','Other subtopic','2026-01-02T00:00:00Z'),
                ('${reflections[5]}','${principal}','${pages[2]}','${active}','${randomUUID()}','Fixture','Fallback question','Node title fallback','2026-01-03T00:00:00Z'),
                (gen_random_uuid(),'${other}','${pages[3]}','${active}','${randomUUID()}','Fixture','Peer question','Peer private reflection','2026-01-04T00:00:00Z');`);
        const started = performance.now();
        const response = await owner.request.get(path); expect(response.status()).toBe(200);
        const body = await response.json();
        info.annotations.push({ type: 'native-playback-reviews', description: `${Math.round(performance.now() - started)} ms; ${Buffer.byteLength(JSON.stringify(body))} bytes; seven inactive contexts` });
        const contexts = new Map(body.graph.activities.map((a) => [a.id, a.review_context]));
        expect(contexts.get(activities[0])).toBeInstanceOf(Array);
        const ids = (index: number) => (contexts.get(activities[index]) as Array<{ id: string }>).map((r) => r.id);
        expect(ids(0)).toEqual(reflections.slice(1, 4).reverse());
        expect(ids(1)).toEqual([reflections[4], reflections[3], reflections[2]]);
        expect(ids(2)).toEqual([reflections[5]]);
        expect(ids(3)).toEqual([]);
        expect(ids(4)).toEqual(ids(0));
        expect(contexts.get(activities[5])).toBeNull();
        expect(contexts.get(activities[6])).toBeNull();
        expect(contexts.get(active)).toBeNull();
        expect(JSON.stringify(body)).not.toContain('Peer private reflection');
        expect(contexts.get(activities[0])).toEqual(expect.arrayContaining([expect.objectContaining({ question: 'Question 3', reflection: 'Specific 3', created_at: '2026-01-01T00:00:00.000000Z' })]));
        sql(`UPDATE learner_route_progress SET current_activity_id='${activities[0]}' WHERE principal_id='${principal}' AND current_play_run_id='${uuid(path.split('/').at(-1)!)}'`);
        const current = await (await owner.request.get(path)).json();
        expect(current.activity.review_context).toEqual(contexts.get(activities[0]));
        expect((await peer.request.get(path)).status()).toBe(404);
        sql(`UPDATE learning_activities SET published_at=NULL WHERE id='${activities[4]}'`);
        const unpublished = await (await owner.request.get(path)).json();
        expect(unpublished.graph.activities.some((a) => a.id === activities[4])).toBe(false);
        sql(scaleActivities.map((id, i) => `INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) VALUES ('${id}','${route}','${id}','Repeated category','',${i + 40},NOW(),'review','${JSON.stringify(configs[0])}');`).join('\n'));
        const scaleStarted = performance.now();
        const scaleResponse = await owner.request.get(path); expect(scaleResponse.status()).toBe(200);
        const scaled = await scaleResponse.json();
        expect(scaled.graph.activities.filter((a) => scaleActivities.includes(a.id))).toHaveLength(100);
        for (const activity of scaled.graph.activities.filter((a) => scaleActivities.includes(a.id))) expect(activity.review_context).toEqual(contexts.get(activities[0]));
        info.annotations.push({ type: 'native-playback-reviews-scale', description: `${Math.round(performance.now() - scaleStarted)} ms; ${Buffer.byteLength(JSON.stringify(scaled))} bytes; 100 additional reviews sharing a category` });
        sql(`DELETE FROM learner_reflections WHERE principal_id='${principal}' AND learner_journal_page_id IN (${pages.slice(0, 3).map((id) => `'${id}'`).join(',')})`);
        const cleared = await (await owner.request.get(path)).json();
        expect(cleared.activity.review_context).toEqual([]);
        expect(cleared.graph.activities.find((a) => a.id === activities[0]).review_context).toEqual([]);
    } finally {
        sql(`UPDATE learner_route_progress SET current_activity_id='${active}' WHERE principal_id='${principal}' AND current_play_run_id='${uuid(path.split('/').at(-1)!)}';
            UPDATE learning_nodes SET title='${originalTitle.replaceAll("'", "''")}' WHERE id='${node}';
            DELETE FROM learning_activities WHERE id IN (${[...activities, ...scaleActivities].map((id) => `'${id}'`).join(',')});
            DELETE FROM learner_journal_pages WHERE id IN (${pages.map((id) => `'${id}'`).join(',')});`);
    }
}

async function principalId(context: BrowserContext) { const subject = uuid((await (await context.request.get('/api/v1/me')).json()).subject_id); return uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${subject}'`).trim()); }
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(query: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
