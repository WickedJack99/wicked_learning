import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

const scenarios = ['journey', 'initial-grant', 'owned-skip', 'rapid', 'rapid-completion', 'cursor-error', 'grant-error', 'stale-reflection', 'projection-error'] as const;
type Scenario = typeof scenarios[number];
type Fixture = { map: string; node: string; activity: string; run: string; principal: string; first: string; middle: string; question: string; answer: string; reflection: string; other: string; end: string; tool: string; sounds: string; topic: string };
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) for (const scenario of scenarios) {
    test(`whole copied NPC ${scenario} uses Rust at ${viewport.width}`, async ({ browser, baseURL }, info) => {
        test.setTimeout(90_000);
        expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
        for (const path of ['features/world/npc-dialogue-player.tsx', 'features/sounds/dialogue-typing-sound-player.ts', 'features/tools/tool-selection.ts', 'components/ui/button.tsx', 'hooks/use-appearance.tsx', 'hooks/use-platform-translation.ts', 'lib/utils.ts', 'types/index.ts']) expect(readFileSync(`../resources/js/${path}`)).toEqual(execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:resources/js/${path}`]));
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const contexts = await Promise.all(['first', 'second'].map((name) => browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath(name as 'first' | 'second') })));
        const adminHeaders = await headers(admin, baseURL!);
        const fixtures: Fixture[] = [], pages: Page[] = []; const errors: string[] = [], legacy: string[] = [];
        const preferences = await Promise.all(contexts.map(async (context) => (await context.request.get('/api/v1/learner/sound-preferences')).json()));
        const ownerHeaders = await Promise.all(contexts.map((context) => headers(context, baseURL!)));
        try {
            for (const [i, context] of contexts.entries()) {
                expect((await context.request.patch('/api/v1/learner/sound-preferences', { headers: ownerHeaders[i], data: { ambience_volume: 100, effects_volume: 100, muted: false } })).status()).toBe(200);
                fixtures.push(await createFixture(admin, adminHeaders, context, scenario, fixtures[0]));
                const page = await context.newPage(); pages.push(page); context.setDefaultTimeout(8_000);
                page.on('pageerror', (error) => errors.push(error.message));
                page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/learning/')) legacy.push(request.url()); });
                await page.addInitScript(() => {
                    const play = HTMLMediaElement.prototype.play;
                    HTMLMediaElement.prototype.play = function () { const result = play.call(this); void result.then(() => { ((window as any).__npcAudio ??= []).push({ url: this.currentSrc || this.src, volume: this.volume, played: !this.paused }); }, () => undefined); return result; };
                });
            }
            await Promise.all(pages.map((page, i) => page.goto(`http://localhost:8084/e2e/canonical-player-npc.html?run=${fixtures[i].run}${i ? '&original' : ''}`)));
            if (scenario === 'projection-error') {
                for (const page of pages) await expect(page.getByRole('alert')).toHaveText('The dialogue is currently unavailable.');
                for (const [i, page] of pages.entries()) await info.attach(`unavailable-${i ? 'main' : 'canonical'}`, { body: await page.screenshot(), contentType: 'image/png' });
            } else {
                const initial = scenario === 'owned-skip' ? 'Second clue.' : scenario === 'stale-reflection' ? 'What did you notice?' : 'First clue.';
                for (const page of pages) await expect(page.getByText(initial, { exact: true })).toBeVisible();
                if (scenario === 'initial-grant') for (const [i, page] of pages.entries()) {
                    await expect(page.getByText('Added tool: Source dialogue tool', { exact: true })).toBeVisible();
                    await expect.poll(() => page.evaluate(() => (window as any).__npcInventory?.map((tool: any) => tool.title))).toContain('Source dialogue tool'); expect(toolCount(fixtures[i])).toBe('1');
                }
                if (scenario === 'grant-error') for (const [i, page] of pages.entries()) {
                    await expect.poll(() => page.evaluate(() => (window as any).__npcUnavailable)).toBeTruthy();
                    await expect(page.getByText('Added tool: Source dialogue tool', { exact: true })).toHaveCount(0); expect(toolCount(fixtures[i])).toBe('0');
                }
                if (scenario === 'journey') {
                    await guards(pages[0], fixtures[0]);
                    await pages[0].reload(); await expect(pages[0].getByText('First clue.', { exact: true })).toBeVisible();
                    for (const page of pages) { const image = page.getByRole('img', { name: 'Scene clue', exact: true }); await bounded(image, viewport); await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0); }
                }
                await compare(pages, 'initial', info);
                for (const page of pages) { await bounded(back(page), viewport); await bounded(next(page), viewport); }
                if (scenario === 'journey') {
                    for (const page of pages) { await next(page).click(); await expect(page.getByText('Second clue.', { exact: true })).toBeVisible(); }
                    await compare(pages, 'middle', info);
                    for (const [i, page] of pages.entries()) {
                        await expect.poll(() => cursor(fixtures[i])).toBe(fixtures[i].middle);
                        await expect.poll(() => page.evaluate(() => ((window as any).__npcAudio ?? []).some((audio: any) => audio.url.endsWith('/sounds/soft-chime.wav') && audio.played && audio.volume === 0.42))).toBe(true);
                        const audio = await page.request.get('/sounds/soft-chime.wav'); expect(audio.status()).toBe(200); expect(await audio.body()).toEqual(readFileSync('../public/sounds/soft-chime.wav'));
                        await back(page).click(); await expect(page.getByText('First clue.', { exact: true })).toBeVisible(); await expect.poll(() => cursor(fixtures[i])).toBe(fixtures[i].first);
                        await next(page).click(); await expect.poll(() => cursor(fixtures[i])).toBe(fixtures[i].middle);
                    }
                    await Promise.all(pages.map((page) => page.reload()));
                    for (const page of pages) { await expect(page.getByText('Second clue.', { exact: true })).toBeVisible(); await expect(back(page)).toBeEnabled(); }
                    await compare(pages, 'resumed-middle', info);
                    for (const page of pages) { await next(page).click(); await expect(page.getByText('Which clue helps?', { exact: true })).toBeVisible(); }
                    await compare(pages, 'question', info);
                    for (const page of pages) {
                        const choice = page.getByRole('button', { name: 'ALook for a pattern.', exact: true }); await bounded(choice, viewport); await choice.click();
                        const confirm = page.getByRole('button', { name: 'Confirm answer', exact: true }); await bounded(confirm, viewport); await confirm.click();
                        await expect(page.getByText('What did you notice?', { exact: true })).toBeVisible(); await expect(back(page)).toBeDisabled();
                    }
                    await compare(pages, 'reflection', info);
                    for (const [i, page] of pages.entries()) {
                        const draft = page.getByPlaceholder('Write a reflection for your journal.'); await bounded(draft, viewport); await draft.fill('I found a pattern in the clues.');
                        const save = page.getByRole('button', { name: 'Keep reflection', exact: true }); await bounded(save, viewport); await save.click();
                        await expect.poll(() => page.evaluate(() => (window as any).__npcCompletion?.receipt.status)).toBe('completed');
                        expect(await page.evaluate(() => (window as any).__npcDestination)).toEqual({ id: null });
                        const f = fixtures[i]; expect(sql(`SELECT count(*) FROM learner_npc_dialogue_answers WHERE principal_id='${f.principal}' AND activity_id='${f.activity}'`).trim()).toBe('1');
                        expect(sql(`SELECT count(*) FROM learner_reflections WHERE principal_id='${f.principal}' AND activity_id='${f.activity}' AND npc_dialogue_node_id='${f.reflection}'`).trim()).toBe('1');
                    }
                } else if (scenario === 'rapid') {
                    const releases: (() => void)[] = []; const observed = [0, 0];
                    for (const [i, page] of pages.entries()) {
                        let release!: () => void; const wait = new Promise<void>((resolve) => { release = resolve; }); releases.push(release);
                        await page.route('**/npc-dialogue/cursor', async (route) => { observed[i]++; if (observed[i] === 1) await wait; await route.continue(); });
                        await next(page).click(); await expect(page.getByText('Second clue.', { exact: true })).toBeVisible();
                        await next(page).click(); await expect(page.getByText('Which clue helps?', { exact: true })).toBeVisible();
                        await back(page).click(); await expect(page.getByText('Second clue.', { exact: true })).toBeVisible(); expect(observed[i]).toBe(1);
                    }
                    releases.forEach((release) => release());
                    for (const [i, page] of pages.entries()) {
                        await expect.poll(() => observed[i]).toBe(3); await expect.poll(() => cursor(fixtures[i])).toBe(fixtures[i].middle);
                        expect(JSON.parse(sql(`SELECT history FROM learner_npc_dialogue_states WHERE principal_id='${fixtures[i].principal}' AND play_run_id='${fixtures[i].run}'`).trim())).toEqual([fixtures[i].first]);
                        expect(await page.evaluate(() => (window as any).__npcUnavailable)).toBeUndefined();
                    }
                    await compare(pages, 'queued-navigation', info);
                } else if (scenario === 'rapid-completion') {
                    const releases: (() => void)[] = [];
                    for (const [i, page] of pages.entries()) {
                        let release!: () => void; const wait = new Promise<void>((resolve) => { release = resolve; }); releases.push(release);
                        await page.route('**/npc-dialogue/cursor', async (route) => { await wait; await route.continue(); });
                        await next(page).click(); await expect(page.getByText('Second clue.', { exact: true })).toBeVisible(); await next(page).click();
                        expect(await page.evaluate(() => (window as any).__npcCompletion)).toBeUndefined();
                        expect(sql(`SELECT status FROM learner_route_progress WHERE principal_id='${fixtures[i].principal}' AND current_play_run_id='${fixtures[i].run}'`).trim()).toBe('in_progress');
                    }
                    await compare(pages, 'completion-waits-for-cursor', info);
                    releases.forEach((release) => release());
                    for (const page of pages) { await expect.poll(() => page.evaluate(() => (window as any).__npcCompletion?.receipt.status)).toBe('completed'); expect(await page.evaluate(() => (window as any).__npcDestination)).toEqual({ id: null }); }
                } else if (scenario === 'cursor-error') {
                    for (const [i, page] of pages.entries()) {
                        sql(`UPDATE learning_nodes SET state='locked' WHERE id='${fixtures[i].node}'`); await next(page).click(); await expect(page.getByText('Second clue.', { exact: true })).toBeVisible();
                        await expect.poll(() => page.evaluate(() => (window as any).__npcUnavailable)).toContain('position'); expect(cursor(fixtures[i])).toBe(''); expect(await page.evaluate(() => (window as any).__npcCompletion)).toBeUndefined();
                    }
                    await compare(pages, 'cursor-rejected-local-state', info);
                    info.annotations.push({ type: 'source-defect', description: 'Source discards cursor persistence errors and keeps optimistic local navigation without inline error. Adapter reports unavailability and prevents later persistence claims until reload.' });
                    for (const [i, page] of pages.entries()) { sql(`UPDATE learning_nodes SET state='available' WHERE id='${fixtures[i].node}'`); await page.reload(); await expect(page.getByText('First clue.', { exact: true })).toBeVisible(); }
                    await compare(pages, 'authoritative-reload', info);
                } else if (scenario === 'stale-reflection') {
                    for (const [i, page] of pages.entries()) {
                        await page.getByPlaceholder('Write a reflection for your journal.').fill('Keep this unsaved draft.');
                        sql(`UPDATE learner_npc_dialogue_states SET current_node_id='${fixtures[i].other}' WHERE principal_id='${fixtures[i].principal}' AND play_run_id='${fixtures[i].run}'`);
                        await page.getByRole('button', { name: 'Keep reflection', exact: true }).click(); await expect.poll(() => page.evaluate(() => (window as any).__npcUnavailable)).toBeTruthy();
                        await expect(page.getByPlaceholder('Write a reflection for your journal.')).toHaveValue('Keep this unsaved draft.');
                        expect(sql(`SELECT count(*) FROM learner_reflections WHERE principal_id='${fixtures[i].principal}' AND activity_id='${fixtures[i].activity}'`).trim()).toBe('0'); expect(await page.evaluate(() => (window as any).__npcCompletion)).toBeUndefined();
                    }
                    await compare(pages, 'stale-reflection-draft', info);
                    expect(errors.filter((message) => message.includes('dialogue action is currently unavailable'))).toHaveLength(2);
                    info.annotations.push({ type: 'source-defect', description: 'Source reflection submit retains the draft but has finally without catch: rejected writes produce an unhandled rejection and no inline error.' });
                } else {
                    for (const [i, page] of pages.entries()) { await next(page).click(); await expect(page.getByText(scenario === 'owned-skip' ? 'Which clue helps?' : 'Second clue.', { exact: true })).toBeVisible(); await expect.poll(() => cursor(fixtures[i])).toBe(scenario === 'owned-skip' ? fixtures[i].question : fixtures[i].middle); }
                    await compare(pages, 'continued', info);
                    if (scenario === 'grant-error') info.annotations.push({ type: 'source-defect', description: 'Source catches a rejected tool grant and removes its notice without error/retry UI. Normal non-grant navigation remains usable.' });
                }
            }
            expect(legacy).toEqual([]); if (scenario !== 'stale-reflection') expect(errors).toEqual([]);
        } finally {
            for (const f of fixtures) {
                sql(`DELETE FROM learner_journal_pages WHERE principal_id='${f.principal}' AND topic='${f.topic}'; DELETE FROM learning_tools WHERE id='${f.tool}'; DELETE FROM learning_dialogue_typing_sound_sets WHERE id='${f.sounds}'`);
                expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${f.map}`, { headers: adminHeaders })).status()).toBe(204);
            }
            for (const [i, context] of contexts.entries()) expect((await context.request.patch('/api/v1/learner/sound-preferences', { headers: ownerHeaders[i], data: preferences[i] })).status()).toBe(200);
            await Promise.all([admin.close(), ...contexts.map((context) => context.close())]);
        }
    });
}
async function createFixture(admin: BrowserContext, adminHeaders: Record<string, string>, owner: BrowserContext, scenario: Scenario, shared?: Fixture): Promise<Fixture> {
    const me = await owner.request.get('/api/v1/me'); expect(me.status()).toBe(200);
    const principal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim());
    const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `NPC UI ${randomUUID()}`, description: null, slug: null } }); expect(created.status()).toBe(201); const map = uuid((await created.json()).map_id);
    const activity = randomUUID(), run = randomUUID(), start = randomUUID(), tool = shared?.tool ?? randomUUID(), sounds = shared?.sounds ?? randomUUID();
    const first = randomUUID(), middle = randomUUID(), question = randomUUID(), answer = randomUUID(), reflection = randomUUID(), other = randomUUID(), end = randomUUID(); const topic = `NPC UI ${activity}`;
    try {
    const result = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: topic, description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } }); expect(result.status()).toBe(201); const node = await result.json(); uuid(node.node_id); uuid(node.asset_id);
    const firstConfig = { typingSpeed: 1, ...(scenario === 'journey' ? { sceneAssets: [{ id: 'clue', label: 'Scene clue', imageDark: '/images/tools/pattern-lens-light.svg', imageLight: '/images/tools/pattern-lens-light.svg', layer: 'behind_npc', x: 25, y: 20, width: 12 }] } : {}), ...(['initial-grant', 'owned-skip', 'grant-error'].includes(scenario) ? { toolId: `npc-tool-${tool}` } : {}) };
    sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
        ${shared ? '' : `INSERT INTO learning_tools (id,slug,title,published_at) VALUES ('${tool}','npc-tool-${tool}','Source dialogue tool',${scenario === 'grant-error' ? 'NULL' : 'NOW()'});`}
        ${shared ? '' : `INSERT INTO learning_dialogue_typing_sound_sets (id,slug,name) VALUES ('${sounds}','${sounds}','Source typing set'); INSERT INTO learning_dialogue_typing_sounds (sound_set_id,letter,url,volume) VALUES ('${sounds}','s','/sounds/soft-chime.wav',42);`}
        INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'dialogue','Source dialogue','',0,NOW(),'npc_dialogue','{}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
        INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}'); INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${run}' FROM learning_activities WHERE id='${activity}';
        INSERT INTO learning_npc_dialogue_nodes (id,activity_id,node_type,title,body,node_config,sort_order) VALUES
        ('${first}','${activity}','npc_monologue','First','First clue.','${JSON.stringify(firstConfig)}',0),('${middle}','${activity}','npc_monologue','Second','Second clue.','{"typingSpeed":1,"typingSoundEnabled":true,"typingSoundSetId":"${sounds}"}',1),('${question}','${activity}','npc_question','Question','Which clue helps?','{"typingSpeed":1}',2),('${answer}','${activity}','answer','Answer','Look for a pattern.','{"answerLabel":"A","isCorrect":true}',3),('${reflection}','${activity}','reflection','Reflection','What did you notice?','{"typingSpeed":1}',4),('${other}','${activity}','reflection','Different reflection','A different question.','{"typingSpeed":1}',5),('${end}','${activity}','end','End','Finished.','{}',6);
        INSERT INTO learning_npc_dialogue_transitions (activity_id,from_node_id,to_node_id,from_connector) VALUES ('${activity}',NULL,'${first}','out'),('${activity}','${first}','${middle}','out'),('${activity}','${middle}','${question}','out'),('${activity}','${question}','${answer}','answer-0'),('${activity}','${answer}','${reflection}','out'),('${activity}','${reflection}','${end}','out'),('${activity}','${other}','${end}','out');`);
    if (scenario === 'rapid-completion') sql(`UPDATE learning_npc_dialogue_transitions SET to_node_id='${end}' WHERE activity_id='${activity}' AND from_node_id='${middle}'`);
    if (scenario === 'owned-skip') sql(`INSERT INTO learner_tools (principal_id,tool_id) VALUES ('${principal}','${tool}')`);
    if (scenario === 'stale-reflection') sql(`INSERT INTO learner_npc_dialogue_states (principal_id,activity_id,play_run_id,current_node_id,history) VALUES ('${principal}','${activity}','${run}','${reflection}','[]')`);
    if (scenario === 'projection-error') sql(`UPDATE learning_nodes SET state='locked' WHERE id='${node.node_id}'`);
    return { map, node: node.node_id, activity, run, principal, first, middle, question, answer, reflection, other, end, tool, sounds, topic };
    } catch (error) {
        if (!shared) sql(`DELETE FROM learning_tools WHERE id='${tool}'; DELETE FROM learning_dialogue_typing_sound_sets WHERE id='${sounds}'`);
        await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders });
        throw error;
    }
}
async function guards(page: Page, f: Fixture) {
    const statuses = await page.evaluate(async ({ activity, run, first, unknown }) => {
        const api = await import('/src/platform/playback-npc-api.ts');
        const state = `/learning/activities/${activity}/npc-dialogue-state?activity=${activity}&run=${run}`;
        const data = { current_node_id: first, history: [] };
        const operations = [
            () => api.playbackNpcPost(`https://example.invalid${state}`, data),
            () => api.playbackNpcPost(state.replace(`run=${run}`, `run=${unknown}`), data),
            () => api.playbackNpcPost(`/learning/npc-dialogue-nodes/${unknown}/grant-tool?activity=${activity}&run=${run}`, {}),
            () => api.playbackNpcPost(`${state}&run=${run}`, data),
            () => api.playbackNpcPost(`${state}&unexpected=true`, data),
            () => api.playbackNpcPost(state, { ...data, play_run_id: unknown }),
            () => api.completeNpcActivity(activity, run, { transitionLabel: 'forged' }),
            () => api.playbackNpcPost(state, { current_node_id: 'invalid', history: [] }),
        ];
        const result: number[] = [];
        for (const operation of operations) { try { await operation(); result.push(200); } catch (error) { result.push((error as { status: number }).status); } }
        return result;
    }, { activity: f.activity, run: f.run, first: f.first, unknown: randomUUID() });
    expect(statuses).toEqual([501, 409, 404, 400, 400, 409, 409, 400]);
    expect(cursor(f)).toBe('');
}
async function headers(context: BrowserContext, baseURL: string) { return { Origin: new URL(baseURL).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token }; }
function next(page: Page) { return page.getByRole('button', { name: 'Next dialogue', exact: true }); }
function back(page: Page) { return page.getByRole('button', { name: 'Previous dialogue', exact: true }); }
function cursor(f: Fixture) { return sql(`SELECT current_node_id FROM learner_npc_dialogue_states WHERE principal_id='${f.principal}' AND activity_id='${f.activity}' AND play_run_id='${f.run}'`).trim(); }
function toolCount(f: Fixture) { return sql(`SELECT count(*) FROM learner_tools WHERE principal_id='${f.principal}' AND tool_id='${f.tool}'`).trim(); }
async function compare(pages: Page[], label: string, info: TestInfo) {
    for (const page of pages) await page.mouse.move(0, 0);
    expect(await pages[0].getByTestId('npc-evidence').innerText()).toBe(await pages[1].getByTestId('npc-evidence').innerText()); expect(await pages[0].getByTestId('npc-evidence').boundingBox()).toEqual(await pages[1].getByTestId('npc-evidence').boundingBox());
    for (const [i, page] of pages.entries()) await info.attach(`${label}-${i ? 'main' : 'canonical'}`, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
}
async function bounded(control: ReturnType<Page['getByRole']>, viewport: { width: number; height: number }) { await expect(control).toBeVisible(); const box = await control.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1); expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1); }
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
