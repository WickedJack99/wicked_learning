import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

const evidenceOrigin = 'http://localhost:8084';
const pin = '32c3113a5bc688c9944c20942cdf40a6a5d57d7f';
const scenarios = ['single', 'multiple', 'recall', 'transfer', 'review'] as const;
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const scenario of scenarios) {
        test(`copied ${scenario} response commands persist through Rust at ${viewport.width}`, async ({ browser, baseURL }, info) => {
            test.setTimeout(90_000);
            for (const path of ['features/world/standard-activities.tsx', 'features/world/activity-utils.tsx', 'features/world/portal-scene.tsx', 'features/world/api.ts', 'features/learning/recall-items.ts', 'features/learning/review-outcomes.ts', 'components/ui/button.tsx', 'hooks/use-appearance.tsx', 'hooks/use-platform-translation.ts', 'lib/utils.ts', 'types/learning.ts']) {
                expect(readFileSync(`../resources/js/${path}`)).toEqual(execFileSync('git', ['show', `${pin}:resources/js/${path}`]));
            }
            const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
            const owner = await browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath('first') });
            owner.setDefaultTimeout(8_000);
            const headersFor = async (context: typeof owner) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
            const adminHeaders = await headersFor(admin);
            const me = await owner.request.get('/api/v1/me'); expect(me.status()).toBe(200);
            const principal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim());
            const activity = randomUUID(); const next = randomUUID(); const start = randomUUID(); const run = randomUUID();
            const question = ['single', 'multiple', 'recall'].includes(scenario);
            const type = question ? 'question' : scenario === 'review' ? 'review' : 'reflection';
            const topic = `Response ${activity}`;
            let map: string | undefined;
            try {
                const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Response ${randomUUID()}`, description: null, slug: null } });
                expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
                const createdNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Response place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
                expect(createdNode.status()).toBe(201); const node = await createdNode.json(); uuid(node.node_id); uuid(node.asset_id);
                const config = question ? {
                    prompt: 'Choose a useful direction.', allowMultiple: scenario === 'multiple', feedbackCorrect: 'Useful direction.', feedbackIncorrect: 'Try another direction.', explanation: 'Compare each option with the evidence.',
                    options: [{ key: 'first', label: 'A', body: 'First direction', isCorrect: true }, { key: 'second', label: 'B', body: 'Second direction', isCorrect: scenario === 'multiple' }, { key: 'wrong', label: 'C', body: 'Unsupported direction', isCorrect: false }],
                } : {
                    prompt: 'Describe the connection you noticed.', topic, subtopic: 'Browser evidence', learningIntent: scenario,
                    competenceTopics: [{ topic: 'Response evidence', slug: `response-${activity}`, weight: 1 }],
                    feedbackGuidance: { purpose: 'Connect the examples.', evidence: 'Describe a useful relationship.', responseFeedback: 'Compare your explanation with the examples.', nextAction: 'Try a different context.', rubric: ['Names a connection', 'Uses an example'], independentCheckPrompt: 'Explain the idea in a fresh setting.', independentCheckFeedback: 'Notice which connection stayed useful.' },
                };
                sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}';
                    UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}';
                    UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                    INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'response','Response activity','',0,NOW(),'${type}','${JSON.stringify(config)}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                    INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${next}',route_id,'next','Next activity','',1,NOW(),'open_practice','{}' FROM learning_activities WHERE id='${activity}';
                    INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}');
                    INSERT INTO learning_activity_transitions (from_activity_id,to_activity_id,from_connector,trigger,label) VALUES ('${activity}','${next}','${question ? 'correct' : 'completed'}','${question ? 'correct' : 'completed'}','Continue route');`);
                if (scenario === 'recall') sql(`INSERT INTO learner_recall_runs (id,principal_id,activity_id) VALUES ('${run}','${principal}','${activity}')`);
                else sql(`INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${run}' FROM learning_activities WHERE id='${activity}'`);
                if (scenario === 'recall') {
                    const queued = await owner.request.post(`/api/v1/learner/play-runs/${run}/activities/${encodeURIComponent(`id:${activity}`)}/recall`, { headers: await headersFor(owner) });
                    expect(queued.status()).toBe(200);
                }

                const page = await owner.newPage(); const original = await owner.newPage();
                const legacyRequests: string[] = []; const errors: string[] = [];
                page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/learning/')) legacyRequests.push(request.url()); });
                page.on('pageerror', (error) => errors.push(error.message));
                const url = `${evidenceOrigin}/e2e/canonical-player-response.html?run=${run}`;
                await page.goto(url); await original.goto(`${url}&original`);
                await expect(page.getByText(config.prompt, { exact: true })).toBeVisible();
                await compare(page, original, 'initial', info);
                if (question) {
                    await bounded(page.getByRole('button', { name: /Unsupported direction/ }), viewport);
                    await page.getByRole('button', { name: 'Settled', exact: true }).click();
                    await page.getByRole('button', { name: /Unsupported direction/ }).click();
                    if (scenario === 'multiple') await page.getByRole('button', { name: 'Check answers', exact: true }).click();
                    await expect(page.getByText('Try another direction.', { exact: true })).toBeVisible();
                    expect((await snapshot()).private_state.answers[0]).toMatchObject({ selected_option_keys: ['wrong'], is_correct: false, attempt_number: 1, confidence: 'settled' });
                    await page.getByRole('button', { name: 'Try again independently', exact: true }).click();
                    await expect(page.getByRole('button', { name: 'Exploring', exact: true })).toBeFocused();
                    await page.getByRole('button', { name: 'Exploring', exact: true }).click();
                    await page.getByRole('button', { name: /First direction/ }).click();
                    if (scenario === 'multiple') {
                        await page.getByRole('button', { name: /Second direction/ }).click();
                        await page.getByRole('button', { name: 'Check answers', exact: true }).click();
                    }
                    await expect(page.getByText('Useful direction.', { exact: true })).toBeVisible();
                    const saved = (await snapshot()).private_state.answers[0];
                    expect(saved).toMatchObject({ selected_option_keys: scenario === 'multiple' ? ['first', 'second'] : ['first'], is_correct: true, attempt_number: 2, confidence: 'exploring', next_activity_id: next });
                    expect(saved.earlier_attempts).toHaveLength(1);
                    expect(sql(`SELECT COUNT(*) FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}' AND status='completed'`).trim()).toBe('0');
                    if (scenario === 'recall') {
                        const days = sql(`SELECT last_interval_days FROM learner_recall_items WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim();
                        await expect(page.getByText(`Next recall in ${days} days.`, { exact: true })).toBeVisible();
                        await page.getByRole('button', { name: 'Remove from recall queue', exact: true }).click();
                    }
                    await page.getByRole('button', { name: 'Keep for later recall', exact: true }).click();
                    await expect(page.getByRole('button', { name: 'Remove from recall queue', exact: true })).toBeVisible();
                    expect((await snapshot()).private_state.recall_activity_ids).toContain(activity);
                    stale(true);
                    await page.getByRole('button', { name: 'Remove from recall queue', exact: true }).click();
                    await expect(page.getByText('This recall choice could not be saved. Try again.', { exact: true })).toBeVisible();
                    await expect(page.getByRole('button', { name: 'Remove from recall queue', exact: true })).toBeVisible();
                    expect(sql(`SELECT COUNT(*) FROM learner_recall_items WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('1');
                    await info.attach('stale-run-error', { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
                    stale(false);
                    await page.getByRole('button', { name: 'Remove from recall queue', exact: true }).click();
                    await expect(page.getByRole('button', { name: 'Keep for later recall', exact: true })).toBeVisible();
                    expect((await snapshot()).private_state.recall_activity_ids).not.toContain(activity);
                    await page.getByRole('button', { name: 'Keep for later recall', exact: true }).click();
                    await expect(page.getByRole('button', { name: 'Remove from recall queue', exact: true })).toBeVisible();
                    await page.reload(); await original.reload();
                    await expect(page.getByText('Useful direction.', { exact: true })).toBeVisible();
                    await compare(page, original, 'saved-answer', info);
                    if (scenario === 'recall') await page.getByRole('button', { name: 'Settled', exact: true }).click();
                    await guardChecks(page, run, activity, scenario);
                    const continueButton = page.getByRole('button', { name: 'Continue route', exact: true });
                    await bounded(continueButton, viewport); await continueButton.click();
                    await expect.poll(() => page.evaluate(() => (window as any).__responseCompletion?.receipt.status)).toBe(scenario === 'recall' ? 'completed' : 'in_progress');
                    const completion = await page.evaluate(() => (window as any).__responseCompletion);
                    expect(completion.receipt.next_activity_id).toBe(scenario === 'recall' ? null : next);
                    if (scenario === 'recall') {
                        expect(completion.progress).toBeNull();
                        expect(sql(`SELECT last_confidence_after_feedback FROM learner_recall_items WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('settled');
                        expect(sql(`SELECT COUNT(*) FROM learner_activity_progress WHERE principal_id='${principal}' AND activity_id='${activity}'`).trim()).toBe('0');
                        // The component emits the source answer destination; the
                        // eventual page adapter must use the isolated-run receipt.
                    } else expect((await snapshot()).activity.id).toBe(next);
                } else {
                    const body = page.locator('#activity-reflection-response');
                    await body.fill('The examples connect through a shared pattern.');
                    if (scenario === 'transfer') await page.locator('#activity-reflection-context').fill('Applying the pattern to a new task.');
                    await page.getByRole('checkbox', { name: 'Names a connection', exact: true }).check();
                    await page.getByRole('button', { name: 'Exploring', exact: true }).click();
                    if (scenario === 'review') await page.getByRole('button', { name: 'More connected', exact: true }).click();
                    const save = page.getByRole('button', { name: scenario === 'review' ? 'Save review note' : 'Keep reflection', exact: true });
                    await bounded(save, viewport);
                    stale(true); await save.click();
                    await expect.poll(() => errors.length).toBe(1);
                    await expect(body).toHaveValue('The examples connect through a shared pattern.');
                    await expect(save).toBeEnabled();
                    expect(sql(`SELECT COUNT(*) FROM learner_reflections WHERE play_run_id='${run}'`).trim()).toBe('0');
                    // Pinned source has try/finally but no inline error catch.
                    // Preserve and record this limitation, never fake saved UI.
                    info.annotations.push({ type: 'source-defect', description: 'Reflection save rejection retains the draft but has no inline error feedback in pinned source.' });
                    errors.length = 0; stale(false); await save.click();
                    await expect(page.getByText('Compare your explanation with the examples.', { exact: true })).toBeVisible();
                    expect((await snapshot()).activity.id).toBe(activity);
                    const reflections = () => JSON.parse(sql(`SELECT COALESCE(jsonb_agg(jsonb_build_object('body',reflection,'context',response_context,'independent',is_independent_check,'cues',observed_cues) ORDER BY created_at),'[]') FROM learner_reflections WHERE play_run_id='${run}'`).trim());
                    expect(reflections()).toEqual([{ body: 'The examples connect through a shared pattern.', context: scenario === 'transfer' ? 'Applying the pattern to a new task.' : null, independent: false, cues: ['Names a connection'] }]);
                    expect(sql(`SELECT COUNT(*) FROM learner_journal_pages WHERE principal_id='${principal}' AND topic='${topic}' AND markdown LIKE '%shared pattern%'`).trim()).toBe('1');
                    if (scenario === 'transfer') {
                        await page.locator('#activity-independent-response').fill('The fresh example uses the same relationship.');
                        await page.locator('#activity-independent-context').fill('A different task without the original example.');
                        const independent = page.getByRole('button', { name: 'Save independent response', exact: true });
                        await bounded(independent, viewport); await independent.click();
                        await expect(page.getByRole('heading', { name: 'Compare your responses', exact: true })).toBeFocused();
                        expect(reflections()).toHaveLength(2);
                        expect(reflections()[1]).toMatchObject({ body: 'The fresh example uses the same relationship.', context: 'A different task without the original example.', independent: true });
                    }
                    await page.getByRole('button', { name: 'Settled', exact: true }).click();
                    await info.attach('saved-response', { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
                    await guardChecks(page, run, activity, scenario);
                    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
                    await bounded(continueButton, viewport); await continueButton.click();
                    await expect.poll(() => page.evaluate(() => (window as any).__responseCompletion?.receipt.status)).toBe('in_progress');
                    expect((await snapshot()).activity.id).toBe(next);
                    expect(sql(`SELECT confidence_after_feedback FROM learner_evidence_events WHERE principal_id='${principal}' AND play_run_id='${run}'`).trim()).toBe('settled');
                    expect(sql(`SELECT outcome FROM learner_evidence_events WHERE principal_id='${principal}' AND play_run_id='${run}'`).trim()).toBe(scenario === 'review' ? 'connected' : 'completed');
                }
                expect(legacyRequests).toEqual([]); expect(errors).toEqual([]);
                async function snapshot() {
                    const result = await owner.request.get(`/api/v1/learner/play-runs/${run}`); expect(result.status()).toBe(200); return result.json();
                }
                function stale(value: boolean) {
                    if (scenario === 'recall') sql(`UPDATE learner_recall_runs SET status='${value ? 'completed' : 'in_progress'}',completed_at=${value ? 'NOW()' : 'NULL'} WHERE id='${run}'`);
                    else sql(`UPDATE learner_route_progress SET status='${value ? 'completed' : 'in_progress'}' WHERE principal_id='${principal}' AND current_play_run_id='${run}'`);
                }
            } finally {
                sql(`DELETE FROM learning_activity_transitions WHERE from_activity_id='${activity}'`);
                if (map) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
                sql(`DELETE FROM learner_journal_pages WHERE principal_id='${principal}' AND topic='${topic}'`);
                await admin.close(); await owner.close();
            }
        });
    }
}

async function guardChecks(page: Page, run: string, activity: string, scenario: string) {
    const actual = await page.evaluate(async ({ run, activity, scenario }) => {
        const api = await import('/src/platform/playback-response-api.ts');
        const question = ['single', 'multiple', 'recall'].includes(scenario);
        const path = question ? `/learning/questions/${activity}/answer` : `/learning/activities/${activity}/reflection`;
        const payload = question ? { play_run_id: run, option_id: 'first', option_ids: ['first', 'second'], defer_completion: true, is_recall: scenario === 'recall', is_revisit: false } : { play_run_id: run, reflection: 'Guarded response' };
        const status = async (url: string, data: Record<string, unknown>) => {
            try { await api.playbackResponsePost(url, data); return 200; } catch (error) { return (error as { status: number }).status; }
        };
        let invalidCompletion: number;
        try {
            await api.completeResponseActivity(activity, run, question ? { confidence: [] } : { outcome: { toString: () => 'connected' } });
            invalidCompletion = 200;
        } catch (error) { invalidCompletion = (error as { status: number }).status; }
        return {
            invalidCompletion,
            foreign: await status(`https://example.invalid${path}`, payload),
            unbound: await status(path, { ...payload, play_run_id: crypto.randomUUID() }),
            malformed: await status(path, question ? { ...payload, option_id: 'missing', option_ids: ['missing'] } : { ...payload, reflection: 1 }),
            wrongShape: await status(path, question ? { ...payload, is_recall: scenario !== 'recall' } : { ...payload, observed_cues: [1] }),
        };
    }, { run, activity, scenario });
    expect(actual).toEqual({ invalidCompletion: 400, foreign: 501, unbound: 409, malformed: 400, wrongShape: ['single', 'multiple', 'recall'].includes(scenario) ? 409 : 400 });
}
async function compare(page: Page, original: Page, label: string, info: TestInfo) {
    const copied = page.getByTestId('response-evidence'); const source = original.getByTestId('response-evidence');
    await expect(source).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0)); await original.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(0, 0); await original.mouse.move(0, 0);
    expect(await copied.innerText()).toBe(await source.innerText()); expect(await copied.boundingBox()).toEqual(await source.boundingBox());
    await info.attach(`${label}-canonical`, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
    await info.attach(`${label}-main`, { body: await original.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
}
async function bounded(control: Locator, viewport: { width: number; height: number }) {
    await control.scrollIntoViewIfNeeded(); await expect(control).toBeVisible(); const box = await control.boundingBox();
    expect(box).not.toBeNull(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
