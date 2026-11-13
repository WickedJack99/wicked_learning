import { expect, test } from './authenticated';

test('a local author can open the guarded source-derived activity review dialog', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    const suffix = Date.now();
    const providerLabel = `Review provider ${suffix}`;
    const templateName = `Review helper ${suffix}`;
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-ai-integrations&ai=providers');
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByLabel('Label').fill(providerLabel);
    await page.getByLabel('API key').fill('local-review-dialog-key');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(providerLabel, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Agent templates' }).click();
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByLabel('Name').fill(templateName);
    await page.getByLabel('Purpose').selectOption('activity_review');
    await page.getByLabel('Provider credential').selectOption({ label: providerLabel });
    await page.getByLabel('Model').fill('local-review-model');
    await page.getByLabel('Enabled').check();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(templateName, { exact: true })).toBeVisible();

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    expect(graphResponse.ok()).toBeTruthy();
    const graph = (await graphResponse.json()) as { maps: Array<{ id: string; nodes: Array<{ id: string }> }> };
    const target = graph.maps.flatMap((map) => map.nodes.map((node) => ({ mapId: map.id, nodeId: node.id })))[0];
    if (!target) throw new Error('the local World Builder needs one node');
    await page.goto(`/settings?panel=admin-world-builder&map=${target.mapId}&node=${target.nodeId}`);
    await page.getByRole('button', { name: 'Open practice' }).click();
    await page.getByLabel('Title').fill(`Review target ${suffix}`);
    const created = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/open-practice-activities'));
    await page.getByRole('button', { name: 'Create activity' }).click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(201);
    const { activity_id: activityId } = await createdResponse.json() as { activity_id: string };

    const unpositionedNodeResponse = await page.request.get(`/api/v1/admin/world-builder/nodes/${target.nodeId}`);
    expect(unpositionedNodeResponse.ok()).toBeTruthy();
    const unpositionedNode = await unpositionedNodeResponse.json() as {
        activity_graph: {
            activities: Array<{ position: { x: number | null; y: number | null } }>;
        };
    };
    const graphPosition = Math.max(
        0,
        ...unpositionedNode.activity_graph.activities.flatMap((candidate) => [
            candidate.position.x ?? 0,
            candidate.position.y ?? 0,
        ]),
    ) + 1_000;
    const csrfResponse = await page.request.get('/api/v1/security/csrf');
    const { token } = await csrfResponse.json() as { token: string };
    const headers = {
        Origin: new URL(page.url()).origin,
        'X-CSRF-Token': token,
    };
    const positionedResponse = await page.request.patch(
        `/api/v1/admin/world-builder/activities/${activityId}/graph-position`,
        { data: { position: { x: graphPosition, y: graphPosition } }, headers },
    );
    expect(positionedResponse.status()).toBe(200);
    const nodeResponse = await page.request.get(`/api/v1/admin/world-builder/nodes/${target.nodeId}`);
    expect(nodeResponse.ok()).toBeTruthy();
    const node = await nodeResponse.json() as {
        activity_graph: { activities: Array<{ id: string; updated_at: string }> };
        sounds: Array<{ id: string; name: string }>;
    };
    const activity = node.activity_graph.activities.find((candidate) => candidate.id === activityId);
    if (!activity) throw new Error('the newly created activity was not returned by the node graph');
    const metadataResponse = await page.request.patch(
        `/api/v1/admin/world-builder/activities/${activityId}/learning-design`,
        {
            data: {
                learning_intent: 'explain',
                competence_topics: [{ topic: 'Systems Thinking', weight: 1 }],
                updated_at: activity.updated_at,
            },
            headers,
        },
    );
    expect(metadataResponse.status()).toBe(200);
    const metadata = await metadataResponse.json() as { updated_at: string };
    const sourcesResponse = await page.request.patch(
        `/api/v1/admin/world-builder/activities/${activityId}/source-references`,
        {
            data: {
                source_references: [{
                    anchor: null,
                    concepts: ['Systems Thinking'],
                    excerpt: 'A development-only source reference.',
                    published_at: null,
                    publisher: 'Wicked Learning test',
                    rights: null,
                    title: 'Source-reference test',
                    url: 'https://example.test/source-reference',
                }],
                updated_at: metadata.updated_at,
            },
            headers,
        },
    );
    expect(sourcesResponse.status()).toBe(200);
    const sources = await sourcesResponse.json() as { updated_at: string };
    const evidenceContextResponse = await page.request.patch(
        `/api/v1/admin/world-builder/activities/${activityId}/evidence-context`,
        {
            data: {
                evidence_objective: 'Notice the next useful choice.',
                evidence_concepts: ['Agency'],
                updated_at: sources.updated_at,
            },
            headers,
        },
    );
    expect(evidenceContextResponse.status()).toBe(200);
    const evidenceContext = await evidenceContextResponse.json() as { updated_at: string };
    const feedbackGuidanceResponse = await page.request.patch(
        `/api/v1/admin/world-builder/activities/${activityId}/feedback-guidance`,
        {
            data: {
                purpose: 'Make the learner’s reasoning visible.',
                evidence: 'Names a reason connected to an observation.',
                response_feedback: null,
                next_action: 'Try the idea with a changed example.',
                rubric: ['Names an observation'],
                independent_check_prompt: null,
                independent_check_feedback: null,
                updated_at: evidenceContext.updated_at,
            },
            headers,
        },
    );
    expect(feedbackGuidanceResponse.status()).toBe(200);
    const feedbackGuidance = await feedbackGuidanceResponse.json() as { updated_at: string };
    const completionChoiceResponse = await page.request.patch(
        `/api/v1/admin/world-builder/activities/${activityId}/completion-choice`,
        {
            data: {
                prompt: 'Choose the kind of continuation that supports your next step.',
                updated_at: feedbackGuidance.updated_at,
            },
            headers,
        },
    );
    expect(completionChoiceResponse.status()).toBe(200);
    const completionChoice = await completionChoiceResponse.json() as { updated_at: string };
    const sound = node.sounds[0];
    if (!sound) throw new Error('the local World Builder needs one reusable sound');
    const ambientSoundResponse = await page.request.patch(
        `/api/v1/admin/world-builder/activities/${activityId}/ambient-sound`,
        {
            data: {
                enabled: true,
                sound_id: sound.id,
                updated_at: completionChoice.updated_at,
            },
            headers,
        },
    );
    expect(ambientSoundResponse.status()).toBe(200);

    await page.reload();
    const card = page.locator('[data-id]').filter({ hasText: `Review target ${suffix}` });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Sources' }).click();
    const sourcesDialog = page.locator('[data-wl-id="authoring.activity-source-references"]');
    await expect(sourcesDialog).toBeVisible();
    await expect(sourcesDialog.getByLabel('Title')).toHaveValue('Source-reference test');
    await sourcesDialog.getByRole('button', { name: 'Close source references' }).click();
    await card.getByRole('button', { name: 'Learner orientation' }).click();
    const evidenceDialog = page.locator('[data-wl-id="authoring.activity-evidence-context"]');
    await expect(evidenceDialog).toBeVisible();
    await expect(evidenceDialog.getByLabel('What this activity invites')).toHaveValue('Notice the next useful choice.');
    await evidenceDialog.getByRole('button', { name: 'Close learner orientation' }).click();
    await card.getByRole('button', { name: 'Feedback guidance' }).click();
    const feedbackDialog = page.locator('[data-wl-id="authoring.activity-feedback-guidance"]');
    await expect(feedbackDialog).toBeVisible();
    await expect(feedbackDialog.getByLabel('Purpose')).toHaveValue('Make the learner’s reasoning visible.');
    await feedbackDialog.getByRole('button', { name: 'Close feedback guidance' }).click();
    await card.getByRole('button', { name: 'Choice context' }).click();
    const choiceDialog = page.locator('[data-wl-id="authoring.activity-completion-choice"]');
    await expect(choiceDialog).toBeVisible();
    await expect(choiceDialog.getByRole('textbox', { name: 'Choice context' })).toHaveValue('Choose the kind of continuation that supports your next step.');
    await choiceDialog.getByRole('button', { name: 'Close choice context' }).click();
    await card.getByRole('button', { name: 'Scene ambience' }).click();
    const ambienceDialog = page.locator('[data-wl-id="authoring.activity-ambient-sound"]');
    await expect(ambienceDialog).toBeVisible();
    await expect(ambienceDialog.getByText(sound.name, { exact: true })).toBeVisible();
    await expect(ambienceDialog.getByLabel('Enable scene ambience')).toBeChecked();
    await ambienceDialog.getByRole('button', { name: 'Close scene ambience' }).click();
    await card.getByRole('button', { name: 'Review activity' }).click();
    const dialog = page.locator('[data-wl-id="authoring.activity-ai-review"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('does not use learner data, and never changes the activity automatically.')).toBeVisible();
    await expect(dialog.getByLabel('Review helper')).toBeVisible();
    await expect(dialog.locator('option', { hasText: templateName })).toHaveCount(1);
});
