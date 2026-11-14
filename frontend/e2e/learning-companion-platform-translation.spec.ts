import { expect, test } from './authenticated';

test('the Learning Companion consumes fixed copy from the platform catalog', async ({
    page,
}) => {
    const playRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4e10';
    const activityId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4e11';

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4e12',
            }),
        });
    });
    await page.route(
        '**/api/v1/learner/platform-translations',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    locale: 'test',
                    translations: {
                        'learning.companion.open': 'Open localized :name',
                        'learning.companion.close_label':
                            'Close localized companion',
                        'learning.companion.context.topic': 'Localized topic',
                        'learning.companion.dialogue.title':
                            'Localized conversation',
                        'learning.companion.dialogue.ai_choose':
                            'Choose localized support',
                        'learning.companion.dialogue.assistance_label':
                            'Localized assistance options',
                        'learning.companion.dialogue.assistance_post_attempt':
                            'After my localized attempt',
                        'learning.companion.dialogue.ai_request':
                            'Use localized support',
                    },
                }),
            });
        },
    );
    await page.route('**/api/v1/learner/companion**', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                avatar_color: '#0891b2',
                avatar_position_x: 50,
                avatar_position_y: 50,
                avatar_scale: 100,
                avatar_url: null,
                configuration: {
                    ai_enabled: true,
                    mode: 'guided_ai',
                    source_scope: 'activity',
                },
                context: {
                    actions: [],
                    activity: { id: activityId, title: 'A local activity' },
                    map: {
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4e13',
                        title: 'A local map',
                    },
                    node: {
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4e14',
                        title: 'A local place',
                    },
                    play_run_id: playRunId,
                    post_attempt_available: true,
                    route: null,
                    surface: 'activity',
                    topic: {
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4e15',
                        title: 'A local topic',
                    },
                    world: null,
                },
                dialogue: {
                    version: 1,
                    start: 'support',
                    nodes: [{ id: 'support', type: 'ai', title: 'Support' }],
                },
                display_name: 'Guide',
                message: 'A bounded companion message.',
            }),
        });
    });
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4e16',
                    play_run_id: playRunId,
                    run_kind: 'route',
                    context: {
                        map_slug: 'private-map',
                        map_title: 'Private map',
                        node_slug: 'private-place',
                        node_title: 'Private place',
                        route_label: 'Companion route',
                    },
                    items: [],
                    tools: [],
                    activity: {
                        id: activityId,
                        slug: 'companion-reading',
                        title: 'Companion reading',
                        description: 'A source-authored reading activity.',
                        activity_type: 'markdown',
                        config: {
                            markdownPages: [
                                {
                                    id: 'first',
                                    title: 'First page',
                                    body: '# First page',
                                    visual: {
                                        borderColorDark: '#2dd4bf',
                                        borderColorLight: '#0891b2',
                                        headingColorDark: '#67e8f9',
                                        headingColorLight: '#0e7490',
                                        pageColorDark: '#0f172a',
                                        pageColorLight: '#ffffff',
                                        textColorDark: '#f8fafc',
                                        textColorLight: '#0f172a',
                                    },
                                },
                            ],
                            markdownTransitions: [
                                { from: 'start', to: 'first' },
                                { from: 'first', to: 'end' },
                            ],
                        },
                        sounds: [],
                        completion: { label: null, next_activity_slug: null },
                        question_feedback: null,
                        recall_item_id: null,
                        check_in: {
                            choice_prompt: null,
                            concepts: [],
                            learning_areas: [],
                            objective: null,
                        },
                        review_context: [],
                        npc_dialogue: null,
                        portal: null,
                        shared_task: null,
                    },
                }),
            });
        },
    );
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/companion-reading/translation`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ translation: null }),
            });
        },
    );

    await page.goto(`/learning/nodes/private-place/play?run=${playRunId}`);

    const launcher = page.getByRole('button', {
        name: 'Open localized Guide',
    });
    await expect(launcher).toBeVisible();
    await launcher.click();
    await expect(
        page.getByRole('button', { name: 'Close localized companion' }),
    ).toBeVisible();
    await expect(page.getByText('Localized topic')).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Localized conversation' }),
    ).toBeVisible();
    await expect(page.getByText('Choose localized support')).toBeVisible();
    await expect(page.getByText('Localized assistance options')).toBeVisible();
    await expect(page.getByText('After my localized attempt')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByRole('button', { name: 'Open localized Guide' }).click();
    const requestSupport = page.getByRole('button', {
        name: 'Use localized support',
    });
    await expect(requestSupport).toBeVisible();
    await expect
        .poll(async () => {
            const bounds = await requestSupport.boundingBox();

            return bounds
                ? bounds.x >= 0 && bounds.x + bounds.width <= 390
                : false;
        })
        .toBe(true);
});
