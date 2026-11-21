import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

const scenarios = ['peer', 'support-submit', 'support-skip', 'support-replies', 'wall-empty', 'wall-pages', 'wall-reply', 'wall-helpful', 'wall-close-denied', 'prompt-error', 'wall-error'] as const;
type Scenario = typeof scenarios[number];
type Fixture = { map: string; node: string; activity: string; next: string; run: string; topic: string; principal: string; extras: string[] };
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const scenario of scenarios) {
        test(`whole copied ${scenario} messages use Rust at ${viewport.width}`, async ({ browser, baseURL }, info) => {
            test.setTimeout(75_000);
            expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
            for (const path of ['features/world/message-activities.tsx', 'features/world/activity-utils.tsx', 'components/input-error.tsx', 'components/pagination-controls.tsx', 'components/ui/button.tsx', 'hooks/use-appearance.tsx', 'hooks/use-platform-translation.ts', 'lib/utils.ts']) {
                expect(readFileSync(`../resources/js/${path}`)).toEqual(execFileSync('git', ['show', `32c3113a5bc688c9944c20942cdf40a6a5d57d7f:resources/js/${path}`]));
            }
            const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
            const contexts = await Promise.all(['first', 'second'].map((name) => browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath(name as 'first' | 'second') })));
            const adminHeaders = { Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await admin.request.get('/api/v1/security/csrf')).json()).token };
            const fixtures: Fixture[] = []; const pages: Page[] = []; const errors: string[] = []; const legacy: string[] = [];
            const wall = scenario.startsWith('wall');
            try {
                for (const [i, context] of contexts.entries()) {
                    const fixture = await createFixture(admin, adminHeaders, context, scenario); fixtures.push(fixture);
                    const page = await context.newPage(); pages.push(page);
                    page.on('pageerror', (error) => errors.push(error.message));
                    page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/learning/')) legacy.push(request.url()); });
                    context.setDefaultTimeout(8_000);
                }
                const releases = await Promise.all(pages.map(barrier));
                await Promise.all(pages.map((page, i) => page.goto(`http://localhost:8084/e2e/canonical-player-message.html?run=${fixtures[i].run}${i ? '&original' : ''}`)));
                for (const page of pages) await expect(page.getByText('Loading messages...', { exact: true })).toBeVisible();
                await compare(pages, 'loading', info);
                if (scenario.endsWith('error')) for (const fixture of fixtures) nodeState(fixture, 'locked');
                releases.forEach((release) => release());
                for (const page of pages) await expect(page.getByText('Loading messages...', { exact: true })).not.toBeVisible();
                if (scenario.endsWith('error')) {
                    for (const page of pages) await expect(page.getByText(wall ? 'No learner messages are visible for this topic yet.' : 'The message topic could not be loaded.', { exact: true })).toBeVisible();
                    await compare(pages, 'read-unavailable', info);
                    for (const fixture of fixtures) nodeState(fixture, 'available');
                    await Promise.all(pages.map((page) => page.reload()));
                    for (const page of pages) await expect(page.getByText('Source message topic', { exact: true })).toBeVisible();
                }
                await compare(pages, 'initial', info);
                if (scenario === 'peer') await guards(pages[0], fixtures[0]);
                if (scenario === 'peer' || scenario === 'prompt-error' || scenario === 'support-submit') {
                    for (const [i, page] of pages.entries()) {
                        const input = page.getByLabel('Your note', { exact: true }); await bounded(input, viewport); await input.fill('An observation for another learner.');
                        const send = page.getByRole('button', { name: scenario === 'support-submit' ? 'Ask support and continue' : 'Share and continue', exact: true }); await bounded(send, viewport);
                        nodeState(fixtures[i], 'locked'); await send.click();
                        await expect(page.getByText('Your message could not be saved yet.', { exact: true })).toBeVisible();
                        await expect(input).toHaveValue('An observation for another learner.');
                        expect(countMessages(fixtures[i])).toBe('0'); expect(await page.evaluate(() => (window as any).__messageCompletion)).toBeUndefined();
                    }
                    await compare(pages, 'write-unavailable', info);
                    for (const [i, page] of pages.entries()) { nodeState(fixtures[i], 'available'); await page.getByRole('button', { name: scenario === 'support-submit' ? 'Ask support and continue' : 'Share and continue', exact: true }).click(); }
                } else if (scenario === 'support-skip') {
                    for (const page of pages) { const skip = page.getByRole('button', { name: 'Not now', exact: true }); await bounded(skip, viewport); await skip.click(); }
                } else if (scenario === 'support-replies') {
                    for (const page of pages) {
                        await expect(page.getByText('Support reply 2', { exact: true })).toBeVisible();
                        await expect(page.getByText('Support reply 0', { exact: true })).toHaveCount(0);
                        const proceed = page.getByRole('button', { name: 'Continue route', exact: true }); await bounded(proceed, viewport); await proceed.click();
                    }
                } else if (scenario === 'wall-pages') {
                    for (const page of pages) {
                        await expect(page.locator('article:visible')).toHaveCount(viewport.width === 390 ? 3 : 10);
                        const next = page.getByRole('button', { name: 'Next message page', exact: true }); await bounded(next, viewport); await next.click();
                        await expect(page.locator('article:visible')).toHaveCount(viewport.width === 390 ? 3 : 4);
                    }
                    await compare(pages, 'second-page', info);
                    for (const page of pages) await page.getByRole('button', { name: 'Previous message page', exact: true }).click();
                } else if (scenario === 'wall-reply') {
                    for (const [i, page] of pages.entries()) {
                        await page.getByRole('button', { name: 'Respond', exact: true }).filter({ visible: true }).click();
                        await page.getByRole('combobox').filter({ visible: true }).selectOption('example');
                        const input = page.getByRole('textbox', { name: 'Your response', exact: true }).filter({ visible: true }); await bounded(input, viewport); await input.fill('Here is a helpful example.');
                        nodeState(fixtures[i], 'locked');
                        const send = page.getByRole('button', { name: 'Send response', exact: true }).filter({ visible: true }); await bounded(send, viewport); await send.click();
                        await expect(page.getByText('Your response could not be saved yet.', { exact: true }).filter({ visible: true })).toBeVisible();
                        await expect(input).toHaveValue('Here is a helpful example.');
                    }
                    await compare(pages, 'reply-unavailable', info);
                    for (const [i, page] of pages.entries()) {
                        nodeState(fixtures[i], 'available'); await page.getByRole('button', { name: 'Send response', exact: true }).filter({ visible: true }).click();
                        await expect(page.getByText('You responded to this message.', { exact: true }).filter({ visible: true })).toBeVisible();
                        expect(sql(`SELECT response_type FROM learner_message_responses WHERE responder_principal_id='${fixtures[i].principal}' AND message_id IN (SELECT id FROM learner_messages WHERE topic_id='${fixtures[i].topic}')`).trim()).toBe('example');
                    }
                    await Promise.all(pages.map((page) => page.reload()));
                    for (const page of pages) await expect(page.getByText('Here is a helpful example.', { exact: true }).filter({ visible: true })).toBeVisible();
                    await compare(pages, 'reply-refresh', info);
                } else if (scenario === 'wall-helpful') {
                    for (const [i, page] of pages.entries()) {
                        const mark = page.getByRole('button', { name: 'This helped me', exact: true }).filter({ visible: true }); await bounded(mark, viewport);
                        nodeState(fixtures[i], 'locked'); await mark.click();
                        await expect(page.getByRole('alert').filter({ visible: true })).toHaveText('The helpful response mark could not be saved yet.');
                    }
                    await compare(pages, 'helpful-unavailable', info);
                    for (const [i, page] of pages.entries()) {
                        nodeState(fixtures[i], 'available'); await page.getByRole('button', { name: 'This helped me', exact: true }).filter({ visible: true }).click();
                        await expect(page.getByText('The learner marked this response helpful.', { exact: true }).filter({ visible: true })).toBeVisible();
                    }
                    await Promise.all(pages.map((page) => page.reload()));
                    for (const page of pages) await expect(page.getByText('The learner marked this response helpful.', { exact: true }).filter({ visible: true })).toBeVisible();
                    await compare(pages, 'helpful-refresh', info);
                    for (const [i, page] of pages.entries()) {
                        const clear = page.getByRole('button', { name: 'Clear helpful mark', exact: true }).filter({ visible: true }); await bounded(clear, viewport); await clear.click();
                        await expect(page.getByText('The learner marked this response helpful.', { exact: true })).toHaveCount(0);
                        expect(sql(`SELECT COUNT(*) FROM learner_message_responses WHERE helpful_at IS NOT NULL AND message_id IN (SELECT id FROM learner_messages WHERE topic_id='${fixtures[i].topic}')`).trim()).toBe('0');
                    }
                    await Promise.all(pages.map((page) => page.reload()));
                    for (const page of pages) await expect(page.getByRole('button', { name: 'This helped me', exact: true }).filter({ visible: true })).toBeVisible();
                    await compare(pages, 'helpful-cleared-refresh', info);
                }
                if (scenario === 'wall-close-denied') {
                    for (const [i, page] of pages.entries()) {
                        nodeState(fixtures[i], 'locked');
                        const denied = page.waitForResponse((response) => response.url().endsWith('/complete') && response.request().method() === 'POST');
                        const close = page.getByRole('button', { name: 'Close message wall', exact: true }); await close.click();
                        expect((await denied).status()).toBe(404);
                        await expect(close).toBeDisabled();
                        expect(await page.evaluate(() => (window as any).__messageCompletion)).toBeUndefined();
                        expect(await page.evaluate(() => (window as any).__messageDestination)).toBeUndefined();
                        expect(sql(`SELECT current_activity_id FROM learner_route_progress WHERE current_play_run_id='${fixtures[i].run}'`).trim()).toBe(fixtures[i].activity);
                    }
                    await expect.poll(() => errors).toEqual(['The player response could not be saved.', 'The player response could not be saved.']);
                    await compare(pages, 'source-close-failure', info);
                    errors.length = 0;
                    for (const fixture of fixtures) nodeState(fixture, 'available');
                    await Promise.all(pages.map((page) => page.reload()));
                    for (const page of pages) await expect(page.getByText('Source message topic', { exact: true })).toBeVisible();
                }
                if (wall) for (const page of pages) { const close = page.getByRole('button', { name: 'Close message wall', exact: true }); await bounded(close, viewport); await close.click(); }
                for (const [i, page] of pages.entries()) {
                    await expect.poll(() => page.evaluate(() => (window as any).__messageDestination)).toEqual({ id: fixtures[i].next });
                    expect((await page.evaluate(() => (window as any).__messageCompletion)).receipt).toMatchObject({ play_run_id: fixtures[i].run, next_activity_id: fixtures[i].next });
                    expect(sql(`SELECT current_activity_id FROM learner_route_progress WHERE current_play_run_id='${fixtures[i].run}'`).trim()).toBe(fixtures[i].next);
                    if (scenario === 'support-skip') expect(countMessages(fixtures[i])).toBe('0');
                    if (scenario === 'support-submit') expect(sql(`SELECT audience FROM learner_messages WHERE topic_id='${fixtures[i].topic}'`).trim()).toBe('support');
                    if (scenario === 'peer' || scenario === 'prompt-error' || scenario === 'support-submit') expect(countMessages(fixtures[i])).toBe('1');
                }
                expect(errors).toEqual([]); expect(legacy).toEqual([]);
            } finally {
                for (const fixture of fixtures) {
                    sql(`DELETE FROM learning_activity_transitions WHERE from_activity_id IN ('${fixture.activity}','${fixture.next}') OR to_activity_id IN ('${fixture.activity}','${fixture.next}')`);
                    expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${fixture.map}`, { headers: adminHeaders })).status()).toBe(204);
                    sql(`DELETE FROM application_principals WHERE id IN (${fixture.extras.map((id) => `'${id}'`).join(',')})`);
                }
                await Promise.all([admin.close(), ...contexts.map((context) => context.close())]);
            }
        });
    }
}

async function createFixture(admin: BrowserContext, headers: Record<string, string>, context: BrowserContext, scenario: Scenario): Promise<Fixture> {
    const me = await context.request.get('/api/v1/me'); expect(me.status()).toBe(200);
    const principal = uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${uuid((await me.json()).subject_id)}'`).trim());
    const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers, data: { title: `Message UI ${randomUUID()}`, description: null, slug: null } });
    expect(created.status()).toBe(201); const map = uuid((await created.json()).map_id);
    const nodeResponse = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers, data: { title: 'Message place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
    expect(nodeResponse.status()).toBe(201); const node = await nodeResponse.json(); uuid(node.node_id); uuid(node.asset_id);
    const fixture: Fixture = { map, node: node.node_id, activity: randomUUID(), next: randomUUID(), run: randomUUID(), topic: randomUUID(), principal, extras: Array.from({ length: 14 }, () => randomUUID()) };
    const { activity, next, run, topic, extras } = fixture; const start = randomUUID(); const message = randomUUID();
    const support = scenario.startsWith('support'); const wall = scenario.startsWith('wall');
    const config = { messageTopicId: topic, messageAudience: support ? 'support' : 'peers', messagePrompt: 'Share one observation.', messageInputLabel: 'Your note', messageAllowResponses: scenario === 'wall-reply' || scenario === 'wall-helpful' };
    sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}'; UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}'; UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
        INSERT INTO learning_message_topics (id,map_asset_id,slug,title) VALUES ('${topic}','${node.asset_id}','message-ui','Source message topic');
        INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'messages','Messages','',0,NOW(),'${wall ? 'message_wall' : 'message_prompt'}','${JSON.stringify(config)}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
        INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${next}',route_id,'next','Next activity','',1,NOW(),'open_practice','{}' FROM learning_activities WHERE id='${activity}';
        INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}'); INSERT INTO learning_activity_transitions (from_activity_id,to_activity_id,from_connector,trigger,label) VALUES ('${activity}','${next}','completed','completed','Continue route');
        INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${run}' FROM learning_activities WHERE id='${activity}';
        ${extras.map((id) => `INSERT INTO application_principals (id,identity_subject_id) VALUES ('${id}','${randomUUID()}');`).join('')}`);
    if (scenario === 'wall-pages') sql(extras.map((id) => `INSERT INTO learner_messages (topic_id,principal_id,audience,body) VALUES ('${topic}','${id}','peers','An anonymous observation.');`).join(''));
    if (scenario === 'wall-reply' || scenario === 'wall-helpful' || scenario === 'support-replies') {
        sql(`INSERT INTO learner_messages (id,topic_id,principal_id,audience,body) VALUES ('${message}','${topic}','${scenario === 'wall-reply' ? extras[0] : principal}','${support ? 'support' : 'peers'}','An observation to discuss.')`);
        if (scenario === 'wall-helpful') sql(`INSERT INTO learner_message_responses (message_id,responder_principal_id,body,response_type) VALUES ('${message}','${extras[0]}','A useful explanation.','explanation')`);
        if (scenario === 'support-replies') sql(extras.slice(0, 4).map((id, i) => `INSERT INTO learner_message_responses (message_id,responder_principal_id,body,created_at) VALUES ('${message}','${id}','Support reply ${i}','2024-01-0${i + 1}T12:00:00Z');`).join(''));
    }
    return fixture;
}
async function guards(page: Page, fixture: Fixture) {
    expect(await page.evaluate(async ({ activity, run }) => {
        const api = await import('/src/platform/playback-message-api.ts');
        const path = `/learning/activities/${activity}/messages`;
        const status = async (url: string) => { try { await api.playbackMessageRead(url); return 200; } catch (error) { return (error as any).status; } };
        return [await status(`https://example.invalid${path}?play_run_id=${run}`), await status(path), await status(`${path}?play_run_id=${crypto.randomUUID()}`), await status(`${path}?play_run_id=${run}&unknown=1`)];
    }, fixture)).toEqual([501, 400, 409, 400]);
}
async function barrier(page: Page) {
    let release!: () => void; const pending = new Promise<void>((resolve) => { release = resolve; });
    await page.route(/\/api\/v1\/learner\/play-runs\/[^/]+\/activities\/[^/]+\/(peer-wall|peer-message|support-request)(\?|$)/, async (route) => { await pending; await route.continue(); });
    return release;
}
async function compare(pages: Page[], label: string, info: TestInfo) {
    for (const page of pages) { await page.mouse.move(0, 0); await page.evaluate(() => window.scrollTo(0, 0)); }
    expect(await pages[0].getByTestId('message-evidence').innerText()).toBe(await pages[1].getByTestId('message-evidence').innerText());
    expect(await pages[0].getByTestId('message-evidence').boundingBox()).toEqual(await pages[1].getByTestId('message-evidence').boundingBox());
    for (const [i, page] of pages.entries()) await info.attach(`${label}-${i ? 'main' : 'canonical'}`, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
}
async function bounded(control: ReturnType<Page['getByRole']>, viewport: { width: number; height: number }) {
    await expect(control).toBeVisible(); const box = await control.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
}
function nodeState(fixture: Fixture, state: 'locked' | 'available') { sql(`UPDATE learning_nodes SET state='${state}' WHERE id='${fixture.node}'`); }
function countMessages(fixture: Fixture) { return sql(`SELECT COUNT(*) FROM learner_messages WHERE topic_id='${fixture.topic}'`).trim(); }
function uuid(value: string) { expect(value).toMatch(/^[a-f0-9-]{36}$/); return value; }
function sql(input: string) { return execFileSync('docker', ['exec', '-i', 'wicked_learning-application-db-1', 'psql', '-tA', '-v', 'ON_ERROR_STOP=1', '-U', 'wicked_application', '-d', 'wicked_application'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }); }
