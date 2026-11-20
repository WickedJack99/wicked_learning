import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { administratorStorageStatePath, collaborationStorageStatePath } from './session-state';

const evidenceOrigin = 'http://localhost:8084';
const pin = '32c3113a5bc688c9944c20942cdf40a6a5d57d7f';
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`whole copied Shared Task writes through Rust at ${viewport.width}`, async ({ browser, baseURL }, info) => {
        test.setTimeout(90_000);
        for (const path of ['features/world/shared-task-activity.tsx', 'features/world/activity-utils.tsx', 'components/ui/button.tsx', 'hooks/use-platform-translation.ts', 'lib/utils.ts', 'features/world/api.ts']) {
            expect(readFileSync(`../resources/js/${path}`)).toEqual(execFileSync('git', ['show', `${pin}:resources/js/${path}`]));
        }
        const admin = await browser.newContext({ baseURL, storageState: administratorStorageStatePath });
        const owner = await browser.newContext({ baseURL, viewport, storageState: collaborationStorageStatePath('first') });
        const peer = await browser.newContext({ baseURL, storageState: collaborationStorageStatePath('second') });
        const headersFor = async (context: typeof owner) => ({ Origin: new URL(baseURL!).origin, 'X-CSRF-Token': (await (await context.request.get('/api/v1/security/csrf')).json()).token });
        const adminHeaders = await headersFor(admin); const peerHeaders = await headersFor(peer);
        const principalFor = async (context: typeof owner) => {
            const me = await context.request.get('/api/v1/me'); expect(me.status()).toBe(200);
            const subject = uuid((await me.json()).subject_id);
            return uuid(sql(`SELECT id FROM application_principals WHERE identity_subject_id='${subject}'`).trim());
        };
        const principal = await principalFor(owner); const otherPrincipal = await principalFor(peer);
        const activity = randomUUID(); const start = randomUUID(); const run = randomUUID(); const peerRun = randomUUID();
        let map: string | undefined;
        try {
            const created = await admin.request.post('/api/v1/admin/world-builder/maps', { headers: adminHeaders, data: { title: `Shared browser ${randomUUID()}`, description: null, slug: null } });
            expect(created.status()).toBe(201); map = uuid((await created.json()).map_id);
            const createdNode = await admin.request.post(`/api/v1/admin/world-builder/maps/${map}/nodes`, { headers: adminHeaders, data: { title: 'Shared place', description: null, position_q: 0, position_r: 0, state: 'available', visual_config: {} } });
            expect(createdNode.status()).toBe(201); const node = await createdNode.json(); uuid(node.node_id); uuid(node.asset_id);
            const config = { threshold: 100, showContributions: true, peerReviewEnabled: true, peerReviewPrompt: 'What connection could help?', minimumLength: 10, repeatPolicy: 'once_per_user', prompt: 'Explain a useful connection.', projectSteps: ['Notice', 'Explain'] };
            sql(`UPDATE learning_maps SET published_at=NOW(),access_roles='["public"]' WHERE id='${map}';
                UPDATE learning_nodes SET published_at=NOW() WHERE id='${node.node_id}'; UPDATE learning_map_assets SET published_at=NOW() WHERE id='${node.asset_id}';
                UPDATE learning_routes SET published_at=NOW() WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activities (id,route_id,slug,title,description,position,published_at,activity_type,activity_config) SELECT '${activity}',id,'shared-browser','Shared browser activity','',0,NOW(),'shared_task','${JSON.stringify(config)}' FROM learning_routes WHERE map_asset_id='${node.asset_id}';
                INSERT INTO learning_activity_starts (id,node_id,activity_id) VALUES ('${start}','${node.node_id}','${activity}');
                INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${principal}','${node.node_id}',route_id,id,'in_progress','${start}','${run}' FROM learning_activities WHERE id='${activity}';
                INSERT INTO learner_route_progress (principal_id,node_id,route_id,current_activity_id,status,activity_start_id,current_play_run_id) SELECT '${otherPrincipal}','${node.node_id}',route_id,id,'in_progress','${start}','${peerRun}' FROM learning_activities WHERE id='${activity}';`);
            const endpoint = (id: string) => `/api/v1/learner/play-runs/${id}/activities/${encodeURIComponent(`id:${activity}`)}/shared-task`;
            const contribution = await peer.request.post(`${endpoint(peerRun)}/submissions`, { headers: peerHeaders, data: { body: 'A peer noticed an interesting connection.', share_with_peers: true } });
            expect(contribution.status()).toBe(200);
            const peerSubmission = (await contribution.json()).submission.id;
            const page = await owner.newPage(); const original = await owner.newPage();
            const legacyRequests: string[] = []; const errors: string[] = [];
            page.on('request', (request) => { if (new URL(request.url()).pathname.startsWith('/learning/activities/')) legacyRequests.push(request.url()); });
            page.on('pageerror', (error) => errors.push(error.message));
            const url = `${evidenceOrigin}/e2e/canonical-player-shared.html?run=${run}`;
            await page.goto(url); await original.goto(`${url}&original`);
            await expect(page.getByText('Explain a useful connection.', { exact: true })).toBeVisible();
            await compare(page, original, 'initial', info);
            const notice = page.getByRole('checkbox', { name: 'Notice', exact: true });
            await notice.check();
            await expect.poll(async () => (await snapshot()).private_state.shared_task_checklists).toEqual([{ activity_id: activity, completed_step_indexes: [0] }]);
            // A real stale-run rejection must roll back the optimistic checkbox
            // and retain an unsent contribution; no fake server success is used.
            sql(`UPDATE learner_route_progress SET status='completed' WHERE principal_id='${principal}' AND current_play_run_id='${run}'`);
            await page.getByRole('checkbox', { name: 'Explain', exact: true }).check();
            await expect(page.getByText('The project step could not be saved yet.', { exact: true })).toBeVisible();
            await expect(page.getByRole('checkbox', { name: 'Explain', exact: true })).not.toBeChecked();
            const body = page.locator(`#shared-task-${activity}`);
            await body.fill('I connected the two patterns in this example.');
            await page.getByRole('button', { name: 'Submit contribution', exact: true }).click();
            await expect(page.getByText('This contribution could not be accepted.', { exact: true })).toBeVisible();
            await expect(body).toHaveValue('I connected the two patterns in this example.');
            sql(`UPDATE learner_route_progress SET status='in_progress' WHERE principal_id='${principal}' AND current_play_run_id='${run}'`);
            await page.getByRole('checkbox', { name: 'Share this contribution anonymously with later learners.' }).check();
            await bounded(page.getByRole('button', { name: 'Submit contribution', exact: true }), viewport);
            await page.getByRole('button', { name: 'Submit contribution', exact: true }).click();
            await expect(page.getByText('Your contribution has been recorded.', { exact: true })).toBeVisible();
            let state = (await snapshot()).activity.shared_task;
            expect(state.submission.body).toBe('I connected the two patterns in this example.');
            const ownSubmission = state.submission.id;
            await page.getByRole('button', { name: 'Peer review', exact: true }).click();
            await page.getByRole('radio', { name: 'A peer noticed an interesting connection.', exact: true }).check();
            await page.locator('#shared-task-peer-review-body').fill('This connection also explains the second example.');
            await bounded(page.getByRole('button', { name: 'Save peer review', exact: true }), viewport);
            await page.getByRole('button', { name: 'Save peer review', exact: true }).click();
            await expect(page.getByText('Your anonymous peer review has been recorded.', { exact: true })).toBeVisible();
            state = (await snapshot()).activity.shared_task;
            expect(state.peer_review.submitted_review.body).toBe('This connection also explains the second example.');
            expect(sql(`SELECT submission_id FROM learner_shared_task_reviews WHERE id='${uuid(state.peer_review.submitted_review.id)}'`).trim()).toBe(peerSubmission);
            const response = await peer.request.post(`${endpoint(peerRun)}/reviews`, { headers: peerHeaders, data: { submission_id: ownSubmission, body: 'Try using another example to show the connection.', response_type: 'example' } });
            expect(response.status()).toBe(200);
            await page.reload(); await page.getByRole('button', { name: 'Peer review', exact: true }).click();
            await expect(page.getByText('Try using another example to show the connection.')).toBeVisible();
            await page.getByRole('button', { name: 'This helped', exact: true }).click();
            await expect.poll(async () => (await snapshot()).activity.shared_task.peer_review.received_reviews[0].is_helpful).toBe(true);
            await page.getByRole('button', { name: /private note/i }).first().click();
            await page.getByLabel('What will you carry forward? (private)').fill('Use a second concrete example next time.');
            await page.getByRole('button', { name: 'Save private note', exact: true }).click();
            await expect.poll(async () => (await snapshot()).activity.shared_task.peer_review.received_reviews[0].follow_up).toBe('Use a second concrete example next time.');
            await page.getByLabel('Revised contribution', { exact: true }).fill('The second example shows why these patterns connect.');
            await bounded(page.getByRole('button', { name: 'Save one revision', exact: true }), viewport);
            await page.getByRole('button', { name: 'Save one revision', exact: true }).click();
            await expect(page.getByText('Your revised contribution', { exact: true })).toBeVisible();
            await expect.poll(async () => (await snapshot()).activity.shared_task.submission.revised_body).toBe('The second example shows why these patterns connect.');
            await page.reload(); await original.reload();
            await page.getByRole('button', { name: 'Peer review', exact: true }).click();
            await original.getByRole('button', { name: 'Peer review', exact: true }).click();
            await compare(page, original, 'persisted-review', info);
            expect((await snapshot()).activity.shared_task.submission.revised_body).toBe('The second example shows why these patterns connect.');
            const guardStatuses = await page.evaluate(async ({ run, activity }) => {
                const adapter = await import('/src/platform/playback-shared-task-api.ts');
                const document = await (await fetch(`/api/v1/learner/play-runs/${run}`)).json();
                const payload = { play_run_id: run, completed_step_indexes: [0] };
                const path = `/learning/activities/${activity}/shared-task-checklist`;
                const status = async (method: 'POST' | 'PATCH', url: string, data: Record<string, unknown>) => {
                    try { await adapter.sharedTaskWrite(method, url, data); return 200; }
                    catch (error) { return (error as { status: number }).status; }
                };
                const older = adapter.bindSharedTaskPlayback(document);
                const newer = adapter.bindSharedTaskPlayback(document);
                older();
                const retained = await status('POST', path, payload);
                const foreign = await status('POST', `https://example.invalid${path}`, payload);
                const unknownRun = await status('POST', path, { ...payload, play_run_id: crypto.randomUUID() });
                const malformed = await status('POST', path, { ...payload, completed_step_indexes: ['0'] });
                const wrongMethod = await status('PATCH', path, payload);
                newer();
                const unbound = await status('POST', path, payload);
                return { retained, foreign, unknownRun, malformed, wrongMethod, unbound };
            }, { run, activity });
            expect(guardStatuses).toEqual({ retained: 200, foreign: 501, unknownRun: 409, malformed: 400, wrongMethod: 501, unbound: 409 });
            expect(legacyRequests).toEqual([]); expect(errors).toEqual([]);
            async function snapshot() {
                const result = await owner.request.get(`/api/v1/learner/play-runs/${run}`); expect(result.status()).toBe(200); return result.json();
            }
        } finally {
            if (map) expect((await admin.request.delete(`/api/v1/admin/world-builder/maps/${map}`, { headers: adminHeaders })).status()).toBe(204);
            await admin.close(); await owner.close(); await peer.close();
        }
    });
}

async function compare(page: Page, original: Page, label: string, info: import('@playwright/test').TestInfo) {
    const copied = page.getByTestId('shared-task-evidence'); const source = original.getByTestId('shared-task-evidence');
    await expect(source).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await original.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(0, 0);
    await original.mouse.move(0, 0);
    expect(await copied.innerText()).toBe(await source.innerText());
    expect(await copied.boundingBox()).toEqual(await source.boundingBox());
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
