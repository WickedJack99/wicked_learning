import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function expectBounded(locator: Locator, width: number): Promise<void> {
    const bounds = await locator.boundingBox();

    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
}

const defaultMarkdownCreateBody = {
    introduction: null,
    markdown_graph_layout: {},
    markdown_pages: [
        {
            body: '# First page\n\nWrite markdown content here. Use `![Alt text](/path/to/image.svg)` to insert images.',
            id: 'page-1',
            position: { x: 140, y: 80 },
            title: 'First page',
            visual: {
                border_color_dark: '#2dd4bf',
                border_color_light: '#0891b2',
                heading_color_dark: '#67e8f9',
                heading_color_light: '#0e7490',
                page_color_dark: '#0f172a',
                page_color_light: '#ffffff',
                text_color_dark: '#f8fafc',
                text_color_light: '#0f172a',
            },
        },
    ],
    markdown_transitions: [
        { from: 'start', id: 'start-page-1', to: 'page-1' },
        { from: 'page-1', id: 'page-1-end', to: 'end' },
    ],
    slug: null,
    title: 'Write the page route',
};

const defaultMarkdownUpdateBody = {
    ...defaultMarkdownCreateBody,
    introduction: 'Start with this activity.',
    slug: 'first-activity',
    title: 'First markdown (edited)',
    updated_at: '2026-11-15T10:00:00Z',
};

const defaultPortalCreateBody = {
    introduction: null,
    portal_assets: [],
    portal_background_dark: '',
    portal_background_light: '',
    portal_background_mirrored: false,
    portal_bubble_border_color_dark: '#2dd4bf',
    portal_bubble_border_color_light: '#0891b2',
    portal_bubble_color_dark: '#0f172a',
    portal_bubble_color_light: '#ffffff',
    portal_bubble_text: '',
    portal_bubble_text_color_dark: '#f8fafc',
    portal_bubble_text_color_light: '#0f172a',
    portal_bubble_typing_speed: 24,
    portal_duration_seconds: 1.5,
    portal_foreground_dark: '',
    portal_foreground_light: '',
    portal_foreground_mirrored: false,
    portal_foreground_width: 28,
    portal_foreground_x: 50,
    portal_foreground_y: 50,
    portal_mode: 'output',
    portal_show_on_arrival: true,
    portal_swirl_enabled: true,
    portal_wait_for_enter: false,
    slug: null,
    target_portal_activity_id: null,
    title: 'Link to another place',
};

const defaultPortalUpdateBody = {
    ...defaultPortalCreateBody,
    introduction: 'Start with this activity.',
    slug: 'first-activity',
    target_portal_activity_id: '00000000-0000-4000-8000-000000000713',
    title: 'First portal (edited)',
    updated_at: '2026-11-15T10:00:00Z',
};

const defaultQuestionCreateBody = {
    allow_multiple: false,
    explanation: '',
    feedback_correct: '',
    feedback_incorrect: '',
    introduction: null,
    options: [
        {
            body: '',
            feedback: '',
            is_correct: false,
            key: null,
            label: 'A',
            outcome_key: '',
            weights: {},
        },
        {
            body: '',
            feedback: '',
            is_correct: false,
            key: null,
            label: 'B',
            outcome_key: '',
            weights: {},
        },
    ],
    prompt: '',
    slug: null,
    title: 'Choose the route',
};

const defaultQuestionUpdateBody = {
    allow_multiple: true,
    explanation: 'Notice why the first answer fits.',
    feedback_correct: 'That is right.',
    feedback_incorrect: 'Try the other answer.',
    introduction: 'Start with this activity.',
    options: [
        {
            body: 'The first answer',
            feedback: 'It connects the route.',
            is_correct: true,
            key: null,
            label: 'A',
            outcome_key: 'continue',
            weights: { recall: 1 },
        },
        {
            body: 'The second answer',
            feedback: 'It opens a different route.',
            is_correct: false,
            key: null,
            label: 'B',
            outcome_key: '',
            weights: {},
        },
    ],
    prompt: 'Which answer connects the route?',
    slug: 'first-activity',
    title: 'First question (edited)',
    updated_at: '2026-11-15T10:00:00Z',
};

const defaultMessageFields = {
    accent_color_dark: '#5eead4',
    accent_color_light: '#0f766e',
    allow_responses: false,
    audience: 'peers',
    card_border_color_dark: '#2dd4bf',
    card_border_color_light: '#0f766e',
    card_color_dark: '#13262d',
    card_color_light: '#ffffff',
    input_label: 'Your message',
    prompt: 'Leave a helpful note or an encouraging thought for the next learner.',
    response_prompt: '',
    surface_color_dark: '#071018',
    surface_color_light: '#e6f5f2',
    text_color_dark: '#f1f5f9',
    text_color_light: '#0f172a',
    topic_id: null,
    topic_title: '',
};

const defaultMessagePromptCreateBody = {
    ...defaultMessageFields,
    activity_type: 'message_prompt',
    introduction: null,
    slug: null,
    title: 'Share a useful detail',
};

const defaultMessageWallCreateBody = {
    ...defaultMessageFields,
    activity_type: 'message_wall',
    introduction: null,
    slug: null,
    title: 'Read useful details',
};

const selectedMessageFields = {
    accent_color_dark: '#4ade80',
    accent_color_light: '#15803d',
    card_border_color_dark: '#22c55e',
    card_border_color_light: '#166534',
    card_color_dark: '#10261a',
    card_color_light: '#f0fdf4',
    input_label: 'Share one useful detail',
    prompt: 'What should another learner notice?',
    response_prompt: 'Reply with a helpful explanation or example.',
    surface_color_dark: '#07140d',
    surface_color_light: '#dcfce7',
    text_color_dark: '#f0fdf4',
    text_color_light: '#14532d',
    topic_id: '00000000-0000-4000-8000-000000000716',
    topic_title: '',
};

const defaultMessagePromptUpdateBody = {
    ...selectedMessageFields,
    activity_type: 'message_prompt',
    allow_responses: false,
    audience: 'support',
    introduction: 'Start with this activity.',
    slug: 'first-activity',
    title: 'First message prompt (edited)',
    updated_at: '2026-11-15T10:00:00Z',
};

const defaultMessageWallUpdateBody = {
    ...selectedMessageFields,
    activity_type: 'message_wall',
    allow_responses: true,
    audience: 'peers',
    introduction: 'Start with this activity.',
    slug: 'first-activity',
    title: 'First message wall (edited)',
    updated_at: '2026-11-15T10:00:00Z',
};

async function exerciseSourceGraphDialogs(page: Page): Promise<void> {
    await page
        .getByRole('button', { name: 'Delete First activity' })
        .dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Delete activity?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).dispatchEvent('click');

    await page
        .locator('[aria-label="Connection from First activity to End: completed"]')
        .dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Edit connection' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).dispatchEvent('click');

    await page
        .locator('[aria-label="Start route to First activity"]')
        .dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Route visuals' }),
    ).toBeVisible();
    await expect(page.getByLabel('Name')).toHaveAttribute(
        'placeholder',
        'First activity',
    );
    await page.getByRole('button', { name: 'Cancel' }).dispatchEvent('click');
}

async function openSourceStartRoute(page: Page): Promise<void> {
    await page
        .locator('[aria-label="Start route to First activity"]')
        .dispatchEvent('click');
    await expect(page.getByRole('heading', { name: 'Route visuals' })).toBeVisible();
}

async function openSourceTransition(page: Page): Promise<void> {
    await page
        .locator('[aria-label="Connection from First activity to End: completed"]')
        .dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Edit connection' }),
    ).toBeVisible();
}

async function openSourceActivityHistory(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'History' }).dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Activity history' }),
    ).toBeVisible();
}

async function installCsrf(page: Page): Promise<void> {
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
}

async function dragBetween(
    page: Page,
    source: Locator,
    target: Locator,
): Promise<void> {
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();

    expect(sourceBox).not.toBeNull();
    expect(targetBox).not.toBeNull();

    await page.mouse.move(
        sourceBox!.x + sourceBox!.width / 2,
        sourceBox!.y + sourceBox!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
        targetBox!.x + targetBox!.width / 2,
        targetBox!.y + targetBox!.height / 2,
        { steps: 12 },
    );
    await page.mouse.up();
}

async function dragNodeBy(
    page: Page,
    node: Locator,
    xDistance: number,
    yDistance: number,
): Promise<void> {
    const nodeBox = await node.boundingBox();

    expect(nodeBox).not.toBeNull();

    await page.mouse.move(nodeBox!.x + 96, nodeBox!.y + 24);
    await page.mouse.down();
    await page.mouse.move(
        nodeBox!.x + 96 + xDistance,
        nodeBox!.y + 24 + yDistance,
        { steps: 12 },
    );
    await page.mouse.up();
}

test('renders the lifted source activity graph at the desktop contract viewport', async ({
    page,
}) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');

    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Add activity' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'First activity' }),
    ).toBeVisible();
    await expect(
        page.locator('[aria-label="Start route to First activity"]'),
    ).toBeVisible();
    await expect(
        page.locator(
            '[aria-label="Connection from First activity to End: completed"]',
        ),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        1440,
    );
});

test('keeps the source empty editor state bounded at the narrow contract viewport', async ({
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?empty=1');

    await expect(
        page.getByText('No activities yet', { exact: true }),
    ).toBeVisible();
    await expect(
        page.getByText('Add one, then connect Start to its input.', {
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        page.locator(
            '[aria-label="Start node. Connect this to a route activity."]',
        ),
    ).toBeVisible();
    await expect(
        page.locator(
            '[aria-label="End node. Connect completed activities here."]',
        ),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('keeps the populated source graph primary card usable at narrow width', async ({
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');

    await expect(page.locator('.react-flow__renderer')).toHaveCSS(
        'width',
        /[1-9]/,
    );
    await expect(
        page.getByRole('heading', { name: 'First activity' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('heading', { name: 'First activity' }),
        390,
    );
    await expectBounded(
        page.locator('[aria-label="Start route to First activity"]'),
        390,
    );
});

test('selects a source graph card before opening its keyboard delete action', async ({
    page,
}) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');

    await page
        .locator('[aria-label="open_practice: First activity"]')
        .dispatchEvent('click');
    await page.keyboard.press('Delete');
    await expect(
        page.getByRole('heading', { name: 'Delete activity?' }),
    ).toBeVisible();
});

test('opens the source activity-card, connection, and Start-route dialogs', async ({
    page,
}) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');

    await exerciseSourceGraphDialogs(page);
});

test('keeps source graph dialogs reachable at the narrow contract viewport', async ({
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');

    await exerciseSourceGraphDialogs(page);
});

test('creates a connection through the lifted source React Flow handles and typed Rust command', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await installCsrf(page);
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/activity-transitions',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ json: { transitions: [] }, status: 200 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto(
        '/activity-editor-harness.html?source-mutations=1&multi-start=1',
    );

    const source = page.locator(
        '.react-flow__handle.source[data-nodeid="00000000-0000-4000-8000-000000000701"][data-handleid="completed"]',
    );
    const target = page.locator(
        '.react-flow__handle.target[data-nodeid="00000000-0000-4000-8000-000000000722"][data-handleid="in"]',
    );
    await expect(source).toBeVisible();
    await expect(target).toBeVisible();

    await dragBetween(page, source, target);

    await expect.poll(() => commandBody).toEqual({
        from_activity_id: '00000000-0000-4000-8000-000000000701',
        from_connector: 'completed',
        to_activity_id: '00000000-0000-4000-8000-000000000722',
        to_connector: 'in',
    });
    await expect(page.getByTestId('source-mutation-reloads')).toHaveText('1');
});

test('saves source activity, Start, and End drag positions through their typed Rust commands', async ({
    page,
}) => {
    let activityPosition: unknown = null;
    const graphPositions: unknown[] = [];

    await installCsrf(page);
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/graph-position',
        async (route) => {
            activityPosition = route.request().postDataJSON();
            await route.fulfill({ json: { position: { x: 72, y: 48 } }, status: 200 });
        },
    );
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/activity-graph-layout',
        async (route) => {
            graphPositions.push(route.request().postDataJSON());
            await route.fulfill({ json: { graph_layout: {} }, status: 200 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?source-mutations=1');

    await dragNodeBy(
        page,
        page.locator(
            '.react-flow__node[data-id="00000000-0000-4000-8000-000000000701"]',
        ),
        72,
        48,
    );
    await dragNodeBy(page, page.locator('.react-flow__node[data-id="start"]'), 48, 36);
    await dragNodeBy(page, page.locator('.react-flow__node[data-id="end"]'), -48, 36);

    await expect.poll(() => activityPosition).toEqual({
        position: expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number),
        }),
    });
    await expect.poll(() => graphPositions).toHaveLength(2);
    expect(graphPositions).toEqual([
        {
            node: 'start',
            position: expect.objectContaining({
                x: expect.any(Number),
                y: expect.any(Number),
            }),
        },
        {
            node: 'end',
            position: expect.objectContaining({
                x: expect.any(Number),
                y: expect.any(Number),
            }),
        },
    ]);
});

test('keeps the lifted source Activity History restore conflict inside the desktop dialog', async ({
    page,
}) => {
    const activityId = '00000000-0000-4000-8000-000000000701';
    const versionId = '00000000-0000-4000-8000-000000000730';
    let restorePath: string | null = null;

    await installCsrf(page);
    await page.route(
        /\/api\/v1\/admin\/world-builder\/activities\/[^/]+\/versions\?.*$/,
        async (route) => {
            const requestUrl = new URL(route.request().url());

            if (
                requestUrl.pathname !==
                `/api/v1/admin/world-builder/activities/${activityId}/versions`
            ) {
                await route.fallback();

                return;
            }

            await route.fulfill({
                json: {
                    items: [
                        {
                            activity_type: 'open_practice',
                            created_at: '2026-11-15T10:00:00Z',
                            id: versionId,
                            introduction: 'An earlier introduction.',
                            slug: 'saved-activity',
                            title: 'A saved activity',
                        },
                    ],
                    pagination: {
                        last_page: 1,
                        page: 1,
                        per_page: 6,
                        total: 1,
                    },
                },
            });
        },
    );
    await page.route(
        new RegExp(
            `/api/v1/admin/world-builder/activities/${activityId}/versions/${versionId}$`,
        ),
        async (route) => {
            if (route.request().method() === 'POST') {
                restorePath = new URL(route.request().url()).pathname;
                await route.fulfill({ status: 409 });

                return;
            }

            await route.fulfill({
                json: {
                    version: {
                        activity_type: 'open_practice',
                        created_at: '2026-11-15T10:00:00Z',
                        id: versionId,
                        introduction: 'An earlier introduction.',
                        slug: 'saved-activity',
                        snapshot: {
                            companionConfig: { style: 'quiet' },
                            config: { nextStep: 'Notice the connection.' },
                            graphPositionX: 120,
                            graphPositionY: 80,
                            transitions: [{ fromConnector: 'completed' }],
                        },
                        title: 'A saved activity',
                    },
                },
            });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?source-mutations=1');
    await openSourceActivityHistory(page);

    const historyDialog = page
        .getByRole('dialog')
        .filter({ has: page.getByRole('heading', { name: 'Activity history' }) });
    await expect(historyDialog.getByText('A saved activity')).toBeVisible();
    await historyDialog.getByRole('button', { name: 'Inspect' }).click();
    await expect(
        historyDialog.getByRole('heading', { name: 'Type-specific settings' }),
    ).toBeVisible();
    await expect(historyDialog.getByText('Graph position')).toBeVisible();
    await expectBounded(
        historyDialog.getByRole('button', { name: 'Restore this version' }),
        1440,
    );

    page.once('dialog', (dialog) => dialog.accept());
    await historyDialog
        .getByRole('button', { name: 'Restore this version' })
        .click();

    await expect.poll(() => restorePath).toBe(
        `/api/v1/admin/world-builder/activities/${activityId}/versions/${versionId}`,
    );
    await expect(
        historyDialog.getByText(
            'Activity history could not be loaded or restored. Try again.',
        ),
    ).toBeVisible();
    await expect(page.getByTestId('source-mutation-reloads')).toHaveText('0');
});

test('restores the lifted source Activity History entry through the typed Rust command at narrow width', async ({
    page,
}) => {
    const activityId = '00000000-0000-4000-8000-000000000701';
    const versionId = '00000000-0000-4000-8000-000000000731';
    let restoreMethod: string | null = null;

    await installCsrf(page);
    await page.route(
        /\/api\/v1\/admin\/world-builder\/activities\/[^/]+\/versions\?.*$/,
        async (route) => {
            const requestUrl = new URL(route.request().url());

            if (
                requestUrl.pathname !==
                `/api/v1/admin/world-builder/activities/${activityId}/versions`
            ) {
                await route.fallback();

                return;
            }

            await route.fulfill({
                json: {
                    items: [
                        {
                            activity_type: 'open_practice',
                            created_at: '2026-11-15T10:00:00Z',
                            id: versionId,
                            introduction: null,
                            slug: null,
                            title: 'Restore me',
                        },
                    ],
                    pagination: {
                        last_page: 1,
                        page: 1,
                        per_page: 6,
                        total: 1,
                    },
                },
            });
        },
    );
    await page.route(
        new RegExp(
            `/api/v1/admin/world-builder/activities/${activityId}/versions/${versionId}$`,
        ),
        async (route) => {
            restoreMethod = route.request().method();
            await route.fulfill({ status: 204 });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?source-mutations=1');
    await openSourceActivityHistory(page);

    const historyDialog = page
        .getByRole('dialog')
        .filter({ has: page.getByRole('heading', { name: 'Activity history' }) });
    await expect(historyDialog.getByText('Restore me')).toBeVisible();
    await expectBounded(
        historyDialog.getByRole('button', { name: 'Restore this version' }),
        390,
    );

    page.once('dialog', (dialog) => dialog.accept());
    await historyDialog
        .getByRole('button', { name: 'Restore this version' })
        .click();

    await expect.poll(() => restoreMethod).toBe('POST');
    await expect(page.getByTestId('source-mutation-reloads')).toHaveText('1');
    await expect(
        page.getByRole('heading', { name: 'Activity history' }),
    ).toHaveCount(0);
});

test('keeps the lifted source AI review unavailable state inside the desktop dialog', async ({
    page,
}) => {
    const activityId = '00000000-0000-4000-8000-000000000701';
    let commandBody: unknown = null;

    await installCsrf(page);
    await page.route(
        new RegExp(
            `/api/v1/admin/world-builder/activities/${activityId}/ai-review$`,
        ),
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 503 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?source-mutations=1&ai-review=1');
    await expect(
        page.getByText('1 activity needs AI review. The queue is scoped to this node.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Review next' }).click();

    const reviewDialog = page
        .getByRole('dialog')
        .filter({ has: page.getByRole('heading', { name: 'Review activity with AI' }) });
    await expect(reviewDialog.getByText('Needs AI review')).toBeVisible();
    await expect(reviewDialog.getByText('AI review not run yet')).toBeVisible();
    await reviewDialog.getByRole('button', { name: 'Review activity' }).click();

    await expect.poll(() => commandBody).toEqual({
        template_id: '00000000-0000-4000-8000-000000000724',
    });
    await expect(
        reviewDialog.getByText('Request failed with status 503'),
    ).toBeVisible();
    await expect(page.getByTestId('source-mutation-reloads')).toHaveText('0');
    await expectBounded(
        reviewDialog.getByRole('button', { name: 'Review activity' }),
        1440,
    );
});

test('renders the lifted source AI review result after a typed Rust response at narrow width', async ({
    page,
}) => {
    const activityId = '00000000-0000-4000-8000-000000000701';
    let commandBody: unknown = null;

    await installCsrf(page);
    await page.route(
        new RegExp(
            `/api/v1/admin/world-builder/activities/${activityId}/ai-review$`,
        ),
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    activity_id: activityId,
                    ai_review: {
                        contractVersion: 'v1',
                        model: 'review-model',
                        provider: 'local-provider',
                        review: {
                            feedbackGuidance: {
                                evidence: {
                                    note: 'Invite a concrete observation.',
                                    signal: 'supported',
                                },
                                nextAction: {
                                    note: 'Offer a quiet next step.',
                                    signal: 'supported',
                                },
                                purpose: {
                                    note: 'The purpose is visible.',
                                    signal: 'supported',
                                },
                            },
                            learningDesign: {
                                purpose: {
                                    note: 'The activity purpose is aligned.',
                                    signal: 'aligned',
                                },
                                suggestedCompetenceTopics: ['Orientation'],
                                suggestedLearningIntent: 'reflect',
                                topics: {
                                    note: 'The topic remains specific.',
                                    signal: 'aligned',
                                },
                            },
                            sdt: {
                                autonomy: {
                                    note: 'The learner retains a choice.',
                                    signal: 'supported',
                                },
                                competence: {
                                    note: 'The next action is clear.',
                                    signal: 'supported',
                                },
                                relatedness: {
                                    note: 'The activity is individual by design.',
                                    signal: 'unclear',
                                },
                            },
                            strengths: ['The activity offers a clear first step.'],
                            suggestions: ['Add one optional orientation cue.'],
                            summary: 'The activity provides a calm, inspectable starting point.',
                        },
                        reviewedByPrincipalId:
                            '00000000-0000-4000-8000-000000000725',
                        usage: {
                            inputTokens: 120,
                            outputTokens: 80,
                            totalTokens: 200,
                        },
                    },
                    ai_review_status: 'reviewed',
                    ai_reviewed_at: '2026-11-15T12:00:00Z',
                },
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?source-mutations=1&ai-review=1');
    await page.getByRole('button', { name: 'Review next' }).click();

    const reviewDialog = page
        .getByRole('dialog')
        .filter({ has: page.getByRole('heading', { name: 'Review activity with AI' }) });
    await reviewDialog.getByRole('button', { name: 'Review activity' }).click();

    await expect.poll(() => commandBody).toEqual({
        template_id: '00000000-0000-4000-8000-000000000724',
    });
    await expect(
        reviewDialog.getByText(
            'The activity provides a calm, inspectable starting point.',
        ),
    ).toBeVisible();
    await expect(reviewDialog.getByText('AI review current')).toBeVisible();
    await expect(page.getByTestId('source-mutation-reloads')).toHaveText('1');
    await expectBounded(
        reviewDialog.getByRole('button', { name: 'Review again' }),
        390,
    );
});

test('keeps the lifted source saved-template pagination failure in the desktop create dialog', async ({
    page,
}) => {
    let requestUrl: URL | null = null;

    await page.route('**/api/v1/admin/activity-templates?*', async (route) => {
        requestUrl = new URL(route.request().url());

        if (requestUrl.searchParams.get('page') === '1') {
            await route.fulfill({
                json: {
                    items: [],
                    pagination: {
                        last_page: 2,
                        page: 1,
                        per_page: 4,
                        total: 5,
                    },
                    share_targets: [],
                },
            });

            return;
        }

        await route.fulfill({ status: 503 });
    });
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await page.getByRole('button', { name: 'Add activity' }).click();

    const createDialog = page.getByRole('dialog', { name: 'Add activity' });
    await expect(createDialog).toBeVisible();
    await expect.poll(() => requestUrl?.searchParams.get('page')).toBe('1');
    expect(requestUrl?.searchParams.get('per_page')).toBe('4');
    const nextPage = createDialog.getByRole('button', {
        name: 'Next saved template page',
    });
    await nextPage.click();
    await expect.poll(() => requestUrl?.searchParams.get('page')).toBe('2');
    await expect(
        createDialog.getByText('The activity templates could not be loaded.'),
    ).toBeVisible();
    await expectBounded(nextPage, 1440);
});

test('keeps the lifted source saved-source pagination failure in the narrow activity dialog', async ({
    page,
}) => {
    let requestUrl: URL | null = null;

    await page.route('**/api/v1/admin/source-records?*', async (route) => {
        requestUrl = new URL(route.request().url());
        await route.fulfill({ status: 503 });
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?source-catalog=1');
    await page.getByRole('button', { name: 'Edit' }).click();

    const editDialog = page.getByRole('dialog', { name: 'Edit activity' });
    await expect(editDialog).toBeVisible();
    await editDialog.getByRole('tab', { name: /Sources/ }).click();
    const nextPage = editDialog.getByRole('button', {
        name: 'Next saved sources',
    });
    await expect(nextPage).toBeVisible();
    await nextPage.click();

    await expect.poll(() => requestUrl?.searchParams.get('page')).toBe('2');
    expect(requestUrl?.searchParams.get('per_page')).toBe('12');
    await expect(
        editDialog.getByText(
            'The saved sources could not be loaded. Try again.',
        ),
    ).toBeVisible();
    await expectBounded(nextPage, 390);
});

test('keeps the source Start-route validation failure in the source dialog at desktop width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await installCsrf(page);
    await page.route(
        '**/api/v1/admin/world-builder/start-routes/00000000-0000-4000-8000-000000000704',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 409 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?source-mutations=1');
    await openSourceStartRoute(page);
    await page.getByLabel('Name').fill('Choose this route');
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    expect(commandBody).toEqual({
        button_border_color_dark: '',
        button_border_color_light: '',
        button_color_dark: '',
        button_color_light: '',
        description: '',
        image_dark: '',
        image_light: '',
        label: 'Choose this route',
    });
    await expect(
        page.getByText(
            'The learner start could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    await expect(page.getByTestId('source-mutation-reloads')).toHaveText('0');
    await expectBounded(page.getByRole('button', { name: 'Save' }), 1440);
});

test('reloads the source Start-route dialog after a typed Rust update at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await installCsrf(page);
    await page.route(
        '**/api/v1/admin/world-builder/start-routes/00000000-0000-4000-8000-000000000704',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 200 });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?source-mutations=1');
    await openSourceStartRoute(page);
    await page.getByLabel('Description').fill('Start by inspecting the map.');
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    expect(commandBody).toEqual({
        button_border_color_dark: '',
        button_border_color_light: '',
        button_color_dark: '',
        button_color_light: '',
        description: 'Start by inspecting the map.',
        image_dark: '',
        image_light: '',
        label: '',
    });
    await expect(page.getByTestId('source-mutation-reloads')).toHaveText('1');
    await expect(page.getByRole('heading', { name: 'Route visuals' })).toHaveCount(0);
});

test('reorders a source Start route through the typed Rust command', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await installCsrf(page);
    await page.route(
        '**/api/v1/admin/world-builder/start-routes/00000000-0000-4000-8000-000000000704/reorder',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 200 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto(
        '/activity-editor-harness.html?source-mutations=1&multi-start=1',
    );
    await openSourceStartRoute(page);
    await page
        .getByRole('button', { name: 'Move route later' })
        .dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    expect(commandBody).toEqual({ direction: 'down' });
    await expect(page.getByTestId('source-mutation-reloads')).toHaveText('1');
});

test('keeps a source transition validation failure in the source dialog at desktop width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await installCsrf(page);
    await page.route(
        '**/api/v1/admin/world-builder/activity-transitions/00000000-0000-4000-8000-000000000705',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 409 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?source-mutations=1');
    await openSourceTransition(page);
    await page.getByLabel('Connection label').fill('Continue exploring');
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    expect(commandBody).toEqual({
        label: 'Continue exploring',
        trigger_value: null,
    });
    await expect(
        page.getByText(
            'The connection could not be saved. Check the values and try again.',
        ),
    ).toBeVisible();
    await expect(page.getByTestId('source-mutation-reloads')).toHaveText('0');
    await expectBounded(page.getByRole('button', { name: 'Save' }), 1440);
});

test('reloads the source transition dialog after a typed Rust update at narrow width', async ({
    page,
}) => {
    await installCsrf(page);
    await page.route(
        '**/api/v1/admin/world-builder/activity-transitions/00000000-0000-4000-8000-000000000705',
        async (route) => {
            await route.fulfill({ status: 200 });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?source-mutations=1');
    await openSourceTransition(page);
    await page.getByLabel('Connection label').fill('Continue exploring');
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect(page.getByTestId('source-mutation-reloads')).toHaveText('1');
    await expect(
        page.getByRole('heading', { name: 'Edit connection' }),
    ).toHaveCount(0);
});

test('deletes source Start routes and transitions only after their typed Rust commands succeed', async ({
    page,
}) => {
    const deletedPaths: string[] = [];

    await installCsrf(page);
    await page.route('**/api/v1/admin/world-builder/start-routes/*', async (route) => {
        deletedPaths.push(new URL(route.request().url()).pathname);
        await route.fulfill({ status: 200 });
    });
    await page.route('**/api/v1/admin/world-builder/activity-transitions/*', async (route) => {
        deletedPaths.push(new URL(route.request().url()).pathname);
        await route.fulfill({ status: 200 });
    });
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?source-mutations=1');
    await openSourceStartRoute(page);
    await page.getByRole('button', { name: 'Delete route' }).dispatchEvent('click');
    await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Delete' })
        .dispatchEvent('click');
    await expect(page.getByTestId('source-mutation-reloads')).toHaveText('1');

    await openSourceTransition(page);
    await page
        .getByRole('button', { name: 'Delete connection' })
        .dispatchEvent('click');
    await expect(page.getByTestId('source-mutation-reloads')).toHaveText('2');
    expect(deletedPaths).toEqual([
        '/api/v1/admin/world-builder/start-routes/00000000-0000-4000-8000-000000000704',
        '/api/v1/admin/world-builder/activity-transitions/00000000-0000-4000-8000-000000000705',
    ]);
});

test('opens the source Add activity form with its first type', async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');

    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');

    await expect(
        page.getByRole('heading', { name: 'Add activity' }),
    ).toBeVisible();
    await expect(
        page.getByText(
            'Create an activity in this MapAsset. Choose its type, then configure its content, visuals, sound and learning evidence.',
        ),
    ).toBeVisible();
    await expect(page.getByText('Core activity')).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Type' })).toHaveText(
        'Open practice',
    );
});

test('keeps the source Add activity defaults reachable at the narrow viewport', async ({
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');

    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');

    await expect(
        page.getByRole('heading', { name: 'Add activity' }),
    ).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue('');
    await expectBounded(page.getByRole('combobox', { name: 'Type' }), 390);
});

test('switches the source Add activity form to Reflection', async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');

    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Reflection' }).dispatchEvent('click');
    await expect(page.getByRole('combobox', { name: 'Type' })).toHaveText(
        'Reflection',
    );

    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Reflection prompt' }),
    ).toBeVisible();
    await expect(page.getByLabel('Question')).toHaveValue(
        'What feels clearer now?',
    );
});

test('keeps the source Reflection default reachable at the narrow viewport', async ({
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');

    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Reflection' }).dispatchEvent('click');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');

    await expect(
        page.getByRole('heading', { name: 'Reflection prompt' }),
    ).toBeVisible();
    await expect(page.getByLabel('Question')).toHaveValue(
        'What feels clearer now?',
    );
    await expectBounded(page.getByRole('tab', { name: 'Flow' }), 390);
});

for (const viewport of [
    { height: 900, name: 'desktop', width: 1440 },
    { height: 844, name: 'narrow', width: 390 },
]) {
    test(`keeps the source Review default reachable at the ${viewport.name} viewport`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        await page.goto('/activity-editor-harness.html');
        await page
            .getByRole('button', { name: 'Add activity' })
            .dispatchEvent('click');

        await page
            .getByRole('combobox', { name: 'Type' })
            .dispatchEvent('click');
        await page.getByRole('option', { name: 'Review' }).dispatchEvent('click');
        await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');

        await expect(
            page.getByRole('heading', { name: 'Review / revisit prompt' }),
        ).toBeVisible();
        await expect(page.getByLabel('Question')).toHaveValue(
            'What feels clearer now?',
        );
        await expectBounded(
            page.getByRole('tab', { name: 'Flow' }),
            viewport.width,
        );
    });
}

const remainingActivityTypes = [
    { label: 'Markdown', section: 'Markdown pages' },
    { label: 'Portal', section: 'Portal route' },
    { label: 'Question', section: 'Question and answers' },
    { label: 'Message prompt', section: 'Learner messages' },
    { label: 'Message wall', section: 'Learner messages' },
    { label: 'Shared task', section: 'Shared task' },
    { label: 'Item grant', section: 'Item grant behavior' },
    { label: 'Item obstacle', section: 'Item obstacle behavior' },
    { label: 'Obstacle', section: 'Obstacle behavior' },
    { label: 'Tool grant', section: 'Tool grant behavior' },
] as const;

for (const viewport of [
    { height: 900, name: 'desktop', width: 1440 },
    { height: 844, name: 'narrow', width: 390 },
]) {
    for (const activityType of remainingActivityTypes) {
        test(`renders source ${activityType.label} flow fields at the ${viewport.name} viewport`, async ({
            page,
        }) => {
            await page.setViewportSize(viewport);
            await page.goto('/activity-editor-harness.html');
            await page
                .getByRole('button', { name: 'Add activity' })
                .dispatchEvent('click');

            await page
                .getByRole('combobox', { name: 'Type' })
                .dispatchEvent('click');
            await page
                .getByRole('option', {
                    exact: true,
                    name: activityType.label,
                })
                .dispatchEvent('click');
            await page
                .getByRole('tab', { name: 'Flow' })
                .dispatchEvent('click');

            await expect(
                page.getByRole('heading', {
                    exact: true,
                    name: activityType.section,
                }),
            ).toBeVisible();
            await expectBounded(
                page.getByRole('tab', { name: 'Flow' }),
                viewport.width,
            );
        });
    }
}

test('surfaces a typed Rust Open-practice validation failure', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/open-practice-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 400 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByLabel('Title').fill('Practice safely');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await page
        .getByLabel('Learner invitation')
        .fill('Try the next step and notice what changes.');

    await page.locator('form').evaluate((form) => form.requestSubmit());

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual({
        introduction: null,
        next_step: 'Try the next step and notice what changes.',
        slug: null,
        title: 'Practice safely',
    });
});

test('reloads after a typed Rust Open-practice create succeeds', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/open-practice-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: { activity_id: '00000000-0000-4000-8000-000000000707' },
                status: 201,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByLabel('Title').fill('Practice safely');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await page
        .getByLabel('Learner invitation')
        .fill('Try the next step and notice what changes.');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.locator('form').evaluate((form) => form.requestSubmit());
    await reloaded;

    expect(commandBody).toEqual({
        introduction: null,
        next_step: 'Try the next step and notice what changes.',
        slug: null,
        title: 'Practice safely',
    });
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('surfaces a typed Rust stale Open-practice update without overwriting', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/open-practice',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 409 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
    await page.getByLabel('Title').fill('Practice safely (edited)');
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual({
        introduction: 'Start with this activity.',
        next_step: 'Choose a useful next step, then continue when you are ready.',
        slug: 'first-activity',
        title: 'Practice safely (edited)',
        updated_at: '2026-11-15T10:00:00Z',
    });
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
});

test('reloads after a typed Rust Open-practice update succeeds at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/open-practice',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    activity_id: '00000000-0000-4000-8000-000000000701',
                    updated_at: '2026-11-15T10:01:00Z',
                },
                status: 200,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('Practice safely (edited)');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');
    await reloaded;

    expect(commandBody).toEqual({
        introduction: 'Start with this activity.',
        next_step: 'Choose a useful next step, then continue when you are ready.',
        slug: 'first-activity',
        title: 'Practice safely (edited)',
        updated_at: '2026-11-15T10:00:00Z',
    });
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

async function openReflectionCreateForm(page: Page): Promise<void> {
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Reflection' }).dispatchEvent('click');
}

test('surfaces a typed Rust Reflection validation failure', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/reflection-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 400 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await openReflectionCreateForm(page);
    await page.getByLabel('Title').fill('Notice your progress');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await page
        .getByLabel('Question')
        .fill('What changed after the experiment?');

    await page.locator('form').evaluate((form) => form.requestSubmit());

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual({
        introduction: null,
        note: null,
        prompt: 'What changed after the experiment?',
        slug: null,
        subtopic: null,
        title: 'Notice your progress',
        topic: null,
    });
});

test('reloads after a typed Rust Reflection create succeeds', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/reflection-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: { activity_id: '00000000-0000-4000-8000-000000000708' },
                status: 201,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await openReflectionCreateForm(page);
    await page.getByLabel('Title').fill('Notice your progress');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await page
        .getByLabel('Question')
        .fill('What changed after the experiment?');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.locator('form').evaluate((form) => form.requestSubmit());
    await reloaded;

    expect(commandBody).toEqual({
        introduction: null,
        note: null,
        prompt: 'What changed after the experiment?',
        slug: null,
        subtopic: null,
        title: 'Notice your progress',
        topic: null,
    });
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('surfaces a typed Rust stale Reflection update without overwriting', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/reflection',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 409 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?reflection=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First reflection (edited)');
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual({
        introduction: 'Start with this activity.',
        note: 'Take a quiet moment.',
        prompt: 'How did that go?',
        slug: 'first-activity',
        subtopic: 'Experiments',
        title: 'First reflection (edited)',
        topic: 'Learning',
        updated_at: '2026-11-15T10:00:00Z',
    });
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
});

test('reloads after a typed Rust Reflection update succeeds at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/reflection',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    activity_id: '00000000-0000-4000-8000-000000000701',
                    updated_at: '2026-11-15T10:01:00Z',
                },
                status: 200,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?reflection=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First reflection (edited)');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');
    await reloaded;

    expect(commandBody).toEqual({
        introduction: 'Start with this activity.',
        note: 'Take a quiet moment.',
        prompt: 'How did that go?',
        slug: 'first-activity',
        subtopic: 'Experiments',
        title: 'First reflection (edited)',
        topic: 'Learning',
        updated_at: '2026-11-15T10:00:00Z',
    });
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

async function openReviewCreateForm(page: Page): Promise<void> {
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Review' }).dispatchEvent('click');
}

test('surfaces a typed Rust Review validation failure', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/review-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 400 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await openReviewCreateForm(page);
    await page.getByLabel('Title').fill('Revisit your learning');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await page
        .getByLabel('Question')
        .fill('What will you carry into the next route?');

    await page.locator('form').evaluate((form) => form.requestSubmit());

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual({
        introduction: null,
        note: null,
        prompt: 'What will you carry into the next route?',
        slug: null,
        subtopic: null,
        title: 'Revisit your learning',
        topic: null,
    });
});

test('reloads after a typed Rust Review create succeeds', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/review-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: { activity_id: '00000000-0000-4000-8000-000000000709' },
                status: 201,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await openReviewCreateForm(page);
    await page.getByLabel('Title').fill('Revisit your learning');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await page
        .getByLabel('Question')
        .fill('What will you carry into the next route?');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.locator('form').evaluate((form) => form.requestSubmit());
    await reloaded;

    expect(commandBody).toEqual({
        introduction: null,
        note: null,
        prompt: 'What will you carry into the next route?',
        slug: null,
        subtopic: null,
        title: 'Revisit your learning',
        topic: null,
    });
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('surfaces a typed Rust stale Review update without overwriting', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/review',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 409 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?review=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First review (edited)');
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual({
        introduction: 'Start with this activity.',
        note: 'Take a quiet moment.',
        prompt: 'How did that go?',
        slug: 'first-activity',
        subtopic: 'Experiments',
        title: 'First review (edited)',
        topic: 'Learning',
        updated_at: '2026-11-15T10:00:00Z',
    });
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
});

test('reloads after a typed Rust Review update succeeds at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/review',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    activity_id: '00000000-0000-4000-8000-000000000701',
                    updated_at: '2026-11-15T10:01:00Z',
                },
                status: 200,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?review=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First review (edited)');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');
    await reloaded;

    expect(commandBody).toEqual({
        introduction: 'Start with this activity.',
        note: 'Take a quiet moment.',
        prompt: 'How did that go?',
        slug: 'first-activity',
        subtopic: 'Experiments',
        title: 'First review (edited)',
        topic: 'Learning',
        updated_at: '2026-11-15T10:00:00Z',
    });
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

async function openMarkdownCreateForm(page: Page): Promise<void> {
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Markdown' }).dispatchEvent('click');
}

test('surfaces a typed Rust Markdown validation failure', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/markdown-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 400 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await openMarkdownCreateForm(page);
    await page.getByLabel('Title').fill('Write the page route');

    await page.locator('form').evaluate((form) => form.requestSubmit());

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual(defaultMarkdownCreateBody);
});

test('reloads after a typed Rust Markdown create succeeds', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/markdown-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: { activity_id: '00000000-0000-4000-8000-000000000710' },
                status: 201,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await openMarkdownCreateForm(page);
    await page.getByLabel('Title').fill('Write the page route');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.locator('form').evaluate((form) => form.requestSubmit());
    await reloaded;

    expect(commandBody).toEqual(defaultMarkdownCreateBody);
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('surfaces a typed Rust stale Markdown update without overwriting', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/markdown',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 409 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?markdown=1');
    await page
        .getByRole('button', { name: 'Edit', exact: true })
        .dispatchEvent('click');
    await page.getByLabel('Title').fill('First markdown (edited)');
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual(defaultMarkdownUpdateBody);
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
});

test('reloads after a typed Rust Markdown update succeeds at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/markdown',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    activity_id: '00000000-0000-4000-8000-000000000701',
                    updated_at: '2026-11-15T10:01:00Z',
                },
                status: 200,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?markdown=1');
    await page
        .getByRole('button', { name: 'Edit', exact: true })
        .dispatchEvent('click');
    await page.getByLabel('Title').fill('First markdown (edited)');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');
    await reloaded;

    expect(commandBody).toEqual(defaultMarkdownUpdateBody);
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('hands the source Markdown card to the dedicated editor seam', async ({
    page,
}) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?markdown=1');

    await page
        .getByRole('button', { name: 'Edit pages' })
        .dispatchEvent('click');

    await expect(page.getByTestId('dedicated-activity-handoff')).toHaveText(
        'markdown',
    );
    await expectBounded(
        page.getByRole('button', { name: 'Edit pages' }),
        1440,
    );
});

test('keeps the source Markdown dedicated-editor handoff reachable at narrow width', async ({
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?markdown=1');

    await page
        .getByRole('button', { name: 'Edit pages' })
        .dispatchEvent('click');

    await expect(page.getByTestId('dedicated-activity-handoff')).toHaveText(
        'markdown',
    );
    await expectBounded(
        page.getByRole('button', { name: 'Edit pages' }),
        390,
    );
});

async function openPortalCreateForm(page: Page): Promise<void> {
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Portal' }).dispatchEvent('click');
}

test('surfaces a typed Rust Portal validation failure', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/portal-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 400 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await openPortalCreateForm(page);
    await page.getByLabel('Title').fill('Link to another place');

    await page.locator('form').evaluate((form) => form.requestSubmit());

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual(defaultPortalCreateBody);
});

test('reloads after a typed Rust Portal create succeeds', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/portal-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: { activity_id: '00000000-0000-4000-8000-000000000711' },
                status: 201,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await openPortalCreateForm(page);
    await page.getByLabel('Title').fill('Link to another place');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.locator('form').evaluate((form) => form.requestSubmit());
    await reloaded;

    expect(commandBody).toEqual(defaultPortalCreateBody);
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('surfaces a typed Rust stale Portal update without overwriting', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/portal',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 409 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?portal=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First portal (edited)');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await expect(page.getByLabel('Travel target')).toHaveText(
        'Map / Exit node / Exit portal',
    );
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual(defaultPortalUpdateBody);
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
});

test('reloads after a typed Rust Portal update succeeds at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/portal',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    activity_id: '00000000-0000-4000-8000-000000000701',
                    updated_at: '2026-11-15T10:01:00Z',
                },
                status: 200,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?portal=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First portal (edited)');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');
    await reloaded;

    expect(commandBody).toEqual(defaultPortalUpdateBody);
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

async function openQuestionCreateForm(page: Page): Promise<void> {
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Question' }).dispatchEvent('click');
}

test('surfaces a typed Rust Question validation failure with source defaults', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/question-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 400 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await openQuestionCreateForm(page);
    await page.getByLabel('Title').fill('Choose the route');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Question and answers' }),
    ).toBeVisible();
    await expect(page.getByLabel('Question prompt')).toHaveValue('');

    await page.locator('form').evaluate((form) => form.requestSubmit());

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual(defaultQuestionCreateBody);
});

test('reloads after a typed Rust Question create succeeds at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/question-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: { activity_id: '00000000-0000-4000-8000-000000000715' },
                status: 201,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await openQuestionCreateForm(page);
    await page.getByLabel('Title').fill('Choose the route');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await expectBounded(page.getByLabel('Question prompt'), 390);

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.locator('form').evaluate((form) => form.requestSubmit());
    await reloaded;

    expect(commandBody).toEqual(defaultQuestionCreateBody);
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('surfaces a typed Rust stale Question update without overwriting', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/question',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 409 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?question=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First question (edited)');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await expect(page.getByLabel('Question prompt')).toHaveValue(
        'Which answer connects the route?',
    );
    await expect(
        page.getByLabel('Allow selecting more than one answer'),
    ).toBeChecked();
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual(defaultQuestionUpdateBody);
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
});

test('reloads after a typed Rust Question update succeeds at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/question',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    activity_id: '00000000-0000-4000-8000-000000000701',
                    updated_at: '2026-11-15T10:01:00Z',
                },
                status: 200,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?question=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First question (edited)');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await expectBounded(page.getByLabel('Question prompt'), 390);

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');
    await reloaded;

    expect(commandBody).toEqual(defaultQuestionUpdateBody);
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

const messageVariants = [
    {
        createBody: defaultMessagePromptCreateBody,
        editTitle: 'First message prompt (edited)',
        fixture: 'message-prompt',
        label: 'Message prompt',
        title: 'Share a useful detail',
        updateBody: defaultMessagePromptUpdateBody,
    },
    {
        createBody: defaultMessageWallCreateBody,
        editTitle: 'First message wall (edited)',
        fixture: 'message-wall',
        label: 'Message wall',
        title: 'Read useful details',
        updateBody: defaultMessageWallUpdateBody,
    },
] as const;

async function openMessageCreateForm(
    page: Page,
    label: (typeof messageVariants)[number]['label'],
): Promise<void> {
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: label }).dispatchEvent('click');
}

for (const variant of messageVariants) {
    test(`surfaces a typed Rust ${variant.label} validation failure with source defaults`, async ({
        page,
    }) => {
        let commandBody: unknown = null;

        await page.route('**/api/v1/security/csrf', async (route) => {
            await route.fulfill({ json: { token: 'test-csrf' } });
        });
        await page.route(
            '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/message-activities',
            async (route) => {
                commandBody = route.request().postDataJSON();
                await route.fulfill({ status: 400 });
            },
        );
        await page.setViewportSize({ height: 900, width: 1440 });
        await page.goto('/activity-editor-harness.html');
        await openMessageCreateForm(page, variant.label);
        await page.getByLabel('Title').fill(variant.title);
        await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
        await expect(
            page.getByRole('heading', { name: 'Learner messages' }),
        ).toBeVisible();
        await expect(page.getByLabel('New topic name')).toHaveValue('');

        await page.locator('form').evaluate((form) => form.requestSubmit());

        await expect.poll(() => commandBody).not.toBeNull();
        await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
        await expect(
            page.getByText(
                'The activity could not be saved. Check the field values and try again.',
            ),
        ).toBeVisible();
        expect(commandBody).toEqual(variant.createBody);
    });

    test(`reloads after a typed Rust ${variant.label} create succeeds at narrow width`, async ({
        page,
    }) => {
        let commandBody: unknown = null;

        await page.route('**/api/v1/security/csrf', async (route) => {
            await route.fulfill({ json: { token: 'test-csrf' } });
        });
        await page.route(
            '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/message-activities',
            async (route) => {
                commandBody = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        activity_id:
                            '00000000-0000-4000-8000-000000000717',
                    },
                    status: 201,
                });
            },
        );
        await page.setViewportSize({ height: 844, width: 390 });
        await page.goto('/activity-editor-harness.html');
        await openMessageCreateForm(page, variant.label);
        await page.getByLabel('Title').fill(variant.title);
        await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
        await expectBounded(page.getByLabel('Message topic'), 390);

        const reloaded = page.waitForEvent(
            'framenavigated',
            (frame) => frame === page.mainFrame(),
        );
        await page.locator('form').evaluate((form) => form.requestSubmit());
        await reloaded;

        expect(commandBody).toEqual(variant.createBody);
        await expect(
            page.getByRole('heading', { name: 'Node activities' }),
        ).toBeVisible();
        await expectBounded(
            page.getByRole('button', { name: 'Add activity' }),
            390,
        );
    });

    test(`surfaces a typed Rust stale ${variant.label} update without overwriting`, async ({
        page,
    }) => {
        let commandBody: unknown = null;

        await page.route('**/api/v1/security/csrf', async (route) => {
            await route.fulfill({ json: { token: 'test-csrf' } });
        });
        await page.route(
            '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/message',
            async (route) => {
                commandBody = route.request().postDataJSON();
                await route.fulfill({ status: 409 });
            },
        );
        await page.setViewportSize({ height: 900, width: 1440 });
        await page.goto(`/activity-editor-harness.html?${variant.fixture}=1`);
        await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
        await page.getByLabel('Title').fill(variant.editTitle);
        await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
        await expect(page.getByLabel('Message topic')).toHaveText(
            'Useful details',
        );

        if (variant.fixture === 'message-wall') {
            await expect(
                page.getByLabel('Invite optional peer responses'),
            ).toBeChecked();
        } else {
            await expect(
                page.getByRole('textbox', { name: 'Prompt' }),
            ).toHaveValue(
                'What should another learner notice?',
            );
        }

        await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

        await expect.poll(() => commandBody).not.toBeNull();
        await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
        await expect(
            page.getByText(
                'The activity could not be saved. Check the field values and try again.',
            ),
        ).toBeVisible();
        expect(commandBody).toEqual(variant.updateBody);
        await expect(
            page.getByRole('heading', { name: 'Edit activity' }),
        ).toBeVisible();
    });

    test(`reloads after a typed Rust ${variant.label} update succeeds at narrow width`, async ({
        page,
    }) => {
        let commandBody: unknown = null;

        await page.route('**/api/v1/security/csrf', async (route) => {
            await route.fulfill({ json: { token: 'test-csrf' } });
        });
        await page.route(
            '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/message',
            async (route) => {
                commandBody = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        activity_id:
                            '00000000-0000-4000-8000-000000000701',
                        updated_at: '2026-11-15T10:01:00Z',
                    },
                    status: 200,
                });
            },
        );
        await page.setViewportSize({ height: 844, width: 390 });
        await page.goto(`/activity-editor-harness.html?${variant.fixture}=1`);
        await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
        await page.getByLabel('Title').fill(variant.editTitle);
        await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
        await expectBounded(page.getByLabel('Message topic'), 390);

        const reloaded = page.waitForEvent(
            'framenavigated',
            (frame) => frame === page.mainFrame(),
        );
        await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');
        await reloaded;

        expect(commandBody).toEqual(variant.updateBody);
        await expect(
            page.getByRole('heading', { name: 'Node activities' }),
        ).toBeVisible();
        await expectBounded(
            page.getByRole('button', { name: 'Add activity' }),
            390,
        );
    });
}

const defaultSharedTaskCreateBody = {
    cycle_mode: 'none',
    input_label: 'Your contribution',
    instructions: '',
    introduction: null,
    minimum_length: 20,
    peer_review_enabled: false,
    peer_review_prompt:
        'What does this contribution help you notice, question, or extend?',
    project_deliverable: '',
    project_goal: '',
    project_steps: [],
    prompt: 'Add a useful contribution.',
    repeat_policy: 'once_per_user',
    show_contributions: false,
    slug: null,
    task_kind: 'text',
    threshold: 3,
    title: 'Contribute together',
    validation_mode: 'minimum_length',
};

const defaultSharedTaskUpdateBody = {
    cycle_mode: 'question_response_question',
    input_label: 'Your useful contribution',
    instructions: 'Connect your contribution to the shared goal.',
    introduction: 'Start with this activity.',
    minimum_length: 40,
    peer_review_enabled: true,
    peer_review_prompt: 'Offer one helpful explanation or example.',
    project_deliverable: 'A shared field guide',
    project_goal: 'Notice the details together.',
    project_steps: ['Look closely', 'Share a detail'],
    prompt: 'What detail helps the next learner?',
    repeat_policy: 'unlimited',
    show_contributions: true,
    slug: 'first-activity',
    task_kind: 'reflection',
    threshold: 4,
    title: 'First shared task (edited)',
    updated_at: '2026-11-15T10:00:00Z',
    validation_mode: 'none',
};

async function openSharedTaskCreateForm(page: Page): Promise<void> {
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Shared task' }).dispatchEvent('click');
}

test('surfaces a typed Rust Shared Task validation failure with source defaults', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/shared-task-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 400 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await openSharedTaskCreateForm(page);
    await page.getByLabel('Title').fill('Contribute together');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await expect(
        page.getByRole('heading', { exact: true, name: 'Shared task' }),
    ).toBeVisible();
    await expect(page.locator('#shared-task-prompt')).toHaveValue(
        'Add a useful contribution.',
    );

    await page.locator('form').evaluate((form) => form.requestSubmit());

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual(defaultSharedTaskCreateBody);
});

test('reloads after a typed Rust Shared Task create succeeds at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/shared-task-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: { activity_id: '00000000-0000-4000-8000-000000000718' },
                status: 201,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await openSharedTaskCreateForm(page);
    await page.getByLabel('Title').fill('Contribute together');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await expectBounded(page.locator('#shared-task-prompt'), 390);

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.locator('form').evaluate((form) => form.requestSubmit());
    await reloaded;

    expect(commandBody).toEqual(defaultSharedTaskCreateBody);
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('surfaces a typed Rust stale Shared Task update without overwriting', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/shared-task',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 409 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?shared-task=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First shared task (edited)');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await expect(page.locator('#shared-task-prompt')).toHaveValue(
        'What detail helps the next learner?',
    );
    await expect(
        page.getByLabel('Invite one anonymous peer review'),
    ).toBeChecked();
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual(defaultSharedTaskUpdateBody);
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
});

test('reloads after a typed Rust Shared Task update succeeds at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/shared-task',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    activity_id: '00000000-0000-4000-8000-000000000701',
                    updated_at: '2026-11-15T10:01:00Z',
                },
                status: 200,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?shared-task=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First shared task (edited)');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await expectBounded(page.locator('#shared-task-prompt'), 390);

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');
    await reloaded;

    expect(commandBody).toEqual(defaultSharedTaskUpdateBody);
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

const defaultItemGrantCreateBody = {
    background_dark: null,
    background_light: null,
    background_mirrored: false,
    introduction: null,
    items: [],
    probability_percent: 100,
    slug: null,
    title: 'Offer a useful item',
};

const defaultItemGrantUpdateBody = {
    background_dark: '/media/dark.png',
    background_light: '/media/light.png',
    background_mirrored: true,
    introduction: 'Start with this activity.',
    items: [
        {
            item_id: '00000000-0000-4000-8000-000000000719',
            quantity: 3,
        },
    ],
    probability_percent: 65.5,
    slug: 'first-activity',
    title: 'First item grant (edited)',
    updated_at: '2026-11-15T10:00:00Z',
};

async function openItemGrantCreateForm(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Add activity' }).dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Item grant' }).dispatchEvent('click');
}

for (const [status, viewport, name] of [
    [400, { height: 900, width: 1440 }, 'validation failure'],
    [201, { height: 844, width: 390 }, 'successful create'],
] as const) {
    test(`captures source Item Grant defaults for a typed Rust ${name}`, async ({ page }) => {
        let commandBody: unknown = null;
        await page.route('**/api/v1/security/csrf', async (route) => route.fulfill({ json: { token: 'test-csrf' } }));
        await page.route('**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/item-grant-activities', async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill(status === 201 ? { json: { activity_id: '00000000-0000-4000-8000-000000000720' }, status } : { status });
        });
        await page.setViewportSize(viewport);
        await page.goto('/activity-editor-harness.html');
        await openItemGrantCreateForm(page);
        await page.getByLabel('Title').fill('Offer a useful item');
        await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
        await expectBounded(page.getByLabel('Probability'), viewport.width);
        const reloaded = status === 201 ? page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame()) : null;
        await page.locator('form').evaluate((form) => form.requestSubmit());

        if (reloaded) {
            await reloaded;
        }

        await expect.poll(() => commandBody).not.toBeNull();
        expect(commandBody).toEqual(defaultItemGrantCreateBody);
    });
}

const defaultToolGrantFields = {
    background_dark: null,
    background_light: null,
    background_mirrored: false,
    bubble_border_color_dark: '#2dd4bf',
    bubble_border_color_light: '#0891b2',
    bubble_color_dark: '#0f172a',
    bubble_color_light: '#ffffff',
    bubble_opacity_dark: 92,
    bubble_opacity_light: 94,
    fade_duration_seconds: 0.4,
    slide_direction: 'left',
    slide_duration_seconds: 0.6,
    text: null,
    tool_id: '00000000-0000-4000-8000-000000000721',
    tool_mirrored: false,
    tool_x: 50,
    tool_y: 50,
    typing_speed: 24,
};

const validToolGrantCreateBody = {
    ...defaultToolGrantFields,
    fade_duration_seconds: 1,
    slide_duration_seconds: 1,
    introduction: null,
    slug: null,
    title: 'Offer a useful tool',
};

const defaultToolGrantUpdateBody = {
    background_dark: '/media/tool-dark.png',
    background_light: '/media/tool-light.png',
    background_mirrored: true,
    bubble_border_color_dark: '#4ade80',
    bubble_border_color_light: '#15803d',
    bubble_color_dark: '#10261a',
    bubble_color_light: '#f0fdf4',
    bubble_opacity_dark: 88,
    bubble_opacity_light: 91,
    fade_duration_seconds: 0.8,
    introduction: 'Start with this activity.',
    slide_direction: 'bottom',
    slide_duration_seconds: 1.2,
    slug: 'first-activity',
    text: 'Use this tool to notice the details.',
    title: 'First tool grant (edited)',
    tool_id: '00000000-0000-4000-8000-000000000721',
    tool_mirrored: true,
    tool_x: 42,
    tool_y: 58,
    typing_speed: 30,
    updated_at: '2026-11-15T10:00:00Z',
};

async function openToolGrantCreateForm(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Add activity' }).dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Tool grant' }).dispatchEvent('click');
}

for (const [status, viewport, name] of [
    [400, { height: 900, width: 1440 }, 'validation failure'],
    [201, { height: 844, width: 390 }, 'successful create'],
] as const) {
    test(`captures a valid source Tool Grant create for a typed Rust ${name}`, async ({ page }) => {
        let commandBody: unknown = null;
        await page.route('**/api/v1/security/csrf', async (route) => route.fulfill({ json: { token: 'test-csrf' } }));
        await page.route('**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/tool-grant-activities', async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill(status === 201 ? { json: { activity_id: '00000000-0000-4000-8000-000000000722' }, status } : { status });
        });
        await page.setViewportSize(viewport);
        await page.goto('/activity-editor-harness.html');
        await openToolGrantCreateForm(page);
        await page.getByLabel('Title').fill('Offer a useful tool');
        await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
        await page
            .getByRole('combobox', { name: 'Tool to give' })
            .dispatchEvent('click');
        await page
            .getByRole('option', { name: 'Field lens' })
            .dispatchEvent('click');
        await page
            .getByRole('tab', { name: 'Visuals' })
            .dispatchEvent('click');
        await expectBounded(page.getByLabel('Typing speed'), viewport.width);
        await page.getByLabel('Slide duration').fill('1');
        await page.getByLabel('Fade duration').fill('1');
        const reloaded = status === 201 ? page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame()) : null;
        await page.locator('form').evaluate((form) => form.requestSubmit());

        if (reloaded) {
            await reloaded;
        }

        await expect.poll(() => commandBody).not.toBeNull();
        expect(commandBody).toEqual(validToolGrantCreateBody);
    });
}

test('retains the pinned Tool Grant decimal defaults and their native validity state', async ({
    page,
}) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await openToolGrantCreateForm(page);
    await page.getByRole('tab', { name: 'Visuals' }).dispatchEvent('click');

    await expect(page.getByLabel('Slide duration')).toHaveValue('0.6');
    await expect(page.getByLabel('Fade duration')).toHaveValue('0.4');
    await expect(
        page.locator('form').evaluate((form) => form.checkValidity()),
    ).resolves.toBe(false);
});

for (const [status, viewport, name] of [
    [409, { height: 900, width: 1440 }, 'stale update'],
    [200, { height: 844, width: 390 }, 'successful update'],
] as const) {
    test(`captures a typed Rust Tool Grant ${name} without losing source fields`, async ({ page }) => {
        let commandBody: unknown = null;
        await page.route('**/api/v1/security/csrf', async (route) => route.fulfill({ json: { token: 'test-csrf' } }));
        await page.route('**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/tool-grant', async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill(status === 200 ? { json: { activity_id: '00000000-0000-4000-8000-000000000701', updated_at: '2026-11-15T10:01:00Z' }, status } : { status });
        });
        await page.setViewportSize(viewport);
        await page.goto('/activity-editor-harness.html?tool-grant=1');
        await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
        await page.getByLabel('Title').fill('First tool grant (edited)');
        await page
            .getByRole('tab', { name: 'Visuals' })
            .dispatchEvent('click');
        await expect(page.getByLabel('Typing speed')).toHaveValue('30');
        const reloaded = status === 200 ? page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame()) : null;
        await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

        if (reloaded) {
            await reloaded;
        }

        await expect.poll(() => commandBody).not.toBeNull();
        expect(commandBody).toEqual(defaultToolGrantUpdateBody);

        if (status === 409) {
            await expect(
                page.getByRole('heading', { name: 'Edit activity' }),
            ).toBeVisible();
        }
    });
}

const defaultItemObstacleCreateBody = {
    background_dark: null,
    background_light: null,
    background_mirrored: false,
    consume_on_each_entry: false,
    introduction: null,
    lock_minutes: 0,
    met_background_dark: null,
    met_background_light: null,
    met_background_mirrored: false,
    overlay_dark: null,
    overlay_light: null,
    overlay_mirrored: false,
    overlay_width: 30,
    overlay_x: 50,
    overlay_y: 50,
    slug: null,
    slots: [{ item_id: null, width: 10, x: 50, y: 50 }],
    sound_met_enabled: false,
    sound_met_id: null,
    sound_not_met_enabled: false,
    sound_not_met_id: null,
    sound_transition_enabled: false,
    sound_transition_id: null,
    title: 'Open the field case',
};

const defaultItemObstacleUpdateBody = {
    background_dark: '/media/obstacle-dark.png',
    background_light: '/media/obstacle-light.png',
    background_mirrored: true,
    consume_on_each_entry: true,
    introduction: 'Start with this activity.',
    lock_minutes: 7,
    met_background_dark: '/media/obstacle-met-dark.png',
    met_background_light: '/media/obstacle-met-light.png',
    met_background_mirrored: true,
    overlay_dark: '/media/obstacle-overlay-dark.png',
    overlay_light: '/media/obstacle-overlay-light.png',
    overlay_mirrored: true,
    overlay_width: 36,
    overlay_x: 42,
    overlay_y: 58,
    slug: 'first-activity',
    slots: [
        {
            item_id: '00000000-0000-4000-8000-000000000719',
            width: 18,
            x: 42,
            y: 58,
        },
    ],
    sound_met_enabled: true,
    sound_met_id: '00000000-0000-4000-8000-000000000720',
    sound_not_met_enabled: true,
    sound_not_met_id: '00000000-0000-4000-8000-000000000720',
    sound_transition_enabled: true,
    sound_transition_id: '00000000-0000-4000-8000-000000000720',
    title: 'First item obstacle (edited)',
    updated_at: '2026-11-15T10:00:00Z',
};

async function openItemObstacleCreateForm(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Add activity' }).dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Item obstacle' }).dispatchEvent('click');
}

for (const [status, viewport, name] of [
    [400, { height: 900, width: 1440 }, 'validation failure'],
    [201, { height: 844, width: 390 }, 'successful create'],
] as const) {
    test(`captures source Item Obstacle defaults for a typed Rust ${name}`, async ({ page }) => {
        let commandBody: unknown = null;
        await page.route('**/api/v1/security/csrf', async (route) => route.fulfill({ json: { token: 'test-csrf' } }));
        await page.route('**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/item-obstacle-activities', async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill(status === 201 ? { json: { activity_id: '00000000-0000-4000-8000-000000000723' }, status } : { status });
        });
        await page.setViewportSize(viewport);
        await page.goto('/activity-editor-harness.html');
        await openItemObstacleCreateForm(page);
        await page.getByLabel('Title').fill('Open the field case');
        await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
        await expectBounded(page.getByLabel('Failed try lockout'), viewport.width);
        const reloaded = status === 201 ? page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame()) : null;
        await page.locator('form').evaluate((form) => form.requestSubmit());

        if (reloaded) {
            await reloaded;
        }

        await expect.poll(() => commandBody).not.toBeNull();
        expect(commandBody).toEqual(defaultItemObstacleCreateBody);
    });
}

const defaultObstacleCreateBody = {
    allowed_tool_ids: [],
    background_dark: null,
    background_light: null,
    background_mirrored: false,
    bubble_border_color_dark: '#2dd4bf',
    bubble_border_color_light: '#0891b2',
    bubble_color_dark: '#0f172a',
    bubble_color_light: '#ffffff',
    bubble_opacity_dark: 92,
    bubble_opacity_light: 94,
    introduction: null,
    obstacle_image_dark: null,
    obstacle_image_light: null,
    obstacle_image_mirrored: false,
    obstacle_width: 28,
    obstacle_x: 50,
    obstacle_y: 50,
    persist_after_solved: true,
    prompt_text: null,
    revisit_background_dark: null,
    revisit_background_light: null,
    revisit_background_mirrored: false,
    revisit_image_dark: null,
    revisit_image_light: null,
    revisit_image_mirrored: false,
    revisit_text: null,
    slug: null,
    success_animation: 'zoom',
    success_text: null,
    title: 'Open the signal case',
    typing_speed: 24,
};

const defaultObstacleUpdateBody = {
    allowed_tool_ids: ['00000000-0000-4000-8000-000000000721'],
    background_dark: '/media/base-obstacle-dark.png',
    background_light: '/media/base-obstacle-light.png',
    background_mirrored: true,
    bubble_border_color_dark: '#4ade80',
    bubble_border_color_light: '#15803d',
    bubble_color_dark: '#10261a',
    bubble_color_light: '#f0fdf4',
    bubble_opacity_dark: 88,
    bubble_opacity_light: 91,
    introduction: 'Start with this activity.',
    obstacle_image_dark: '/media/base-obstacle-image-dark.png',
    obstacle_image_light: '/media/base-obstacle-image-light.png',
    obstacle_image_mirrored: true,
    obstacle_width: 34,
    obstacle_x: 42,
    obstacle_y: 58,
    persist_after_solved: false,
    prompt_text: 'Use the lens to inspect this signal.',
    revisit_background_dark: '/media/base-obstacle-revisit-dark.png',
    revisit_background_light: '/media/base-obstacle-revisit-light.png',
    revisit_background_mirrored: true,
    revisit_image_dark: '/media/base-obstacle-revisit-image-dark.png',
    revisit_image_light: '/media/base-obstacle-revisit-image-light.png',
    revisit_image_mirrored: true,
    revisit_text: 'The signal is ready to inspect again.',
    slug: 'first-activity',
    success_animation: 'shake',
    success_text: 'You found the useful detail.',
    title: 'First obstacle (edited)',
    typing_speed: 30,
    updated_at: '2026-11-15T10:00:00Z',
};

async function openObstacleCreateForm(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Add activity' }).dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page
        .getByRole('option', { exact: true, name: 'Obstacle' })
        .dispatchEvent('click');
}

for (const [status, viewport, name] of [
    [400, { height: 900, width: 1440 }, 'validation failure'],
    [201, { height: 844, width: 390 }, 'successful create'],
] as const) {
    test(`captures source Base Obstacle defaults for a typed Rust ${name}`, async ({ page }) => {
        let commandBody: unknown = null;
        await page.route('**/api/v1/security/csrf', async (route) => route.fulfill({ json: { token: 'test-csrf' } }));
        await page.route('**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/obstacle-activities', async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill(status === 201 ? { json: { activity_id: '00000000-0000-4000-8000-000000000724' }, status } : { status });
        });
        await page.setViewportSize(viewport);
        await page.goto('/activity-editor-harness.html');
        await openObstacleCreateForm(page);
        await page.getByLabel('Title').fill('Open the signal case');
        await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
        await expectBounded(page.getByRole('combobox', { name: 'Tools that work here' }), viewport.width);
        const reloaded = status === 201 ? page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame()) : null;
        await page.locator('form').evaluate((form) => form.requestSubmit());

        if (reloaded) {
            await reloaded;
        }

        await expect.poll(() => commandBody).not.toBeNull();
        expect(commandBody).toEqual(defaultObstacleCreateBody);
    });
}

for (const [status, viewport, name] of [
    [409, { height: 900, width: 1440 }, 'stale update'],
    [200, { height: 844, width: 390 }, 'successful update'],
] as const) {
    test(`captures a typed Rust Base Obstacle ${name} without losing source fields`, async ({ page }) => {
        let commandBody: unknown = null;
        await page.route('**/api/v1/security/csrf', async (route) => route.fulfill({ json: { token: 'test-csrf' } }));
        await page.route('**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/obstacle', async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill(status === 200 ? { json: { activity_id: '00000000-0000-4000-8000-000000000701', updated_at: '2026-11-15T10:01:00Z' }, status } : { status });
        });
        await page.setViewportSize(viewport);
        await page.goto('/activity-editor-harness.html?obstacle=1');
        await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
        await page.getByLabel('Title').fill('First obstacle (edited)');
        await page.getByRole('tab', { name: 'Visuals' }).dispatchEvent('click');
        await expectBounded(page.getByLabel('Typing speed'), viewport.width);
        const reloaded = status === 200 ? page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame()) : null;
        await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

        if (reloaded) {
            await reloaded;
        }

        await expect.poll(() => commandBody).not.toBeNull();
        expect(commandBody).toEqual(defaultObstacleUpdateBody);

        if (status === 409) {
            await expect(
                page.getByRole('heading', { name: 'Edit activity' }),
            ).toBeVisible();
        }
    });
}

for (const [status, viewport, name] of [
    [409, { height: 900, width: 1440 }, 'stale update'],
    [200, { height: 844, width: 390 }, 'successful update'],
] as const) {
    test(`captures a typed Rust Item Obstacle ${name} without losing source fields`, async ({ page }) => {
        let commandBody: unknown = null;
        await page.route('**/api/v1/security/csrf', async (route) => route.fulfill({ json: { token: 'test-csrf' } }));
        await page.route('**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/item-obstacle', async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill(status === 200 ? { json: { activity_id: '00000000-0000-4000-8000-000000000701', updated_at: '2026-11-15T10:01:00Z' }, status } : { status });
        });
        await page.setViewportSize(viewport);
        await page.goto('/activity-editor-harness.html?item-obstacle=1');
        await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
        await page.getByLabel('Title').fill('First item obstacle (edited)');
        await page.getByRole('tab', { name: 'Visuals' }).dispatchEvent('click');
        await expectBounded(page.getByLabel('Overlay width'), viewport.width);
        const reloaded = status === 200 ? page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame()) : null;
        await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

        if (reloaded) {
            await reloaded;
        }

        await expect.poll(() => commandBody).not.toBeNull();
        expect(commandBody).toEqual(defaultItemObstacleUpdateBody);

        if (status === 409) {
            await expect(
                page.getByRole('heading', { name: 'Edit activity' }),
            ).toBeVisible();
        }
    });
}

for (const [status, viewport, name] of [
    [409, { height: 900, width: 1440 }, 'stale update'],
    [200, { height: 844, width: 390 }, 'successful update'],
] as const) {
    test(`captures a typed Rust Item Grant ${name} without losing source fields`, async ({ page }) => {
        let commandBody: unknown = null;
        await page.route('**/api/v1/security/csrf', async (route) => route.fulfill({ json: { token: 'test-csrf' } }));
        await page.route('**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/item-grant', async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill(status === 200 ? { json: { activity_id: '00000000-0000-4000-8000-000000000701', updated_at: '2026-11-15T10:01:00Z' }, status } : { status });
        });
        await page.setViewportSize(viewport);
        await page.goto('/activity-editor-harness.html?item-grant=1');
        await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
        await page.getByLabel('Title').fill('First item grant (edited)');
        await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
        await expect(page.getByLabel('Probability')).toHaveValue('65.5');
        const reloaded = status === 200 ? page.waitForEvent('framenavigated', (frame) => frame === page.mainFrame()) : null;
        await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

        if (reloaded) {
            await reloaded;
        }

        await expect.poll(() => commandBody).not.toBeNull();
        expect(commandBody).toEqual(defaultItemGrantUpdateBody);

        if (status === 409) {
            await expect(
                page.getByRole('heading', { name: 'Edit activity' }),
            ).toBeVisible();
        }
    });
}
