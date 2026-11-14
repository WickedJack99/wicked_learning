import { expect, test } from './authenticated';

test('the Tool Grant playback surface consumes the platform catalog', async ({
    page,
}) => {
    const playRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d8a';

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d8b',
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
                        'activities.tool_grant.discovered':
                            'Localized discovery: :tool',
                        'activities.tool_grant.hide': 'Hide localized tool',
                        'activities.tool_grant.take': 'Claim localized tool',
                    },
                }),
            });
        },
    );
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d8c',
                    play_run_id: playRunId,
                    run_kind: 'route',
                    context: {
                        map_slug: 'private-map',
                        map_title: 'Private map',
                        node_slug: 'private-place',
                        node_title: 'Private place',
                        route_label: 'Tool route',
                    },
                    items: [],
                    tools: [],
                    activity: {
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d8d',
                        slug: 'receive-magnifier',
                        title: 'A closer look',
                        description: 'A source-authored tool grant.',
                        activity_type: 'tool_grant',
                        config: {
                            alreadyOwned: false,
                            backgroundDark: null,
                            backgroundLight: null,
                            backgroundMirrored: false,
                            bubbleBorderColorDark: '#2dd4bf',
                            bubbleBorderColorLight: '#0891b2',
                            bubbleColorDark: '#0f172a',
                            bubbleColorLight: '#ffffff',
                            bubbleOpacityDark: 92,
                            bubbleOpacityLight: 94,
                            fadeDurationSeconds: 0,
                            slideDirection: 'left',
                            slideDurationSeconds: 0,
                            text: '',
                            toolMirrored: false,
                            toolX: 50,
                            toolY: 40,
                            typingSpeed: 1,
                            tool: {
                                animation_dark: null,
                                animation_light: null,
                                config: { imageWidthPercent: 18 },
                                description: 'A tool for closer inspection.',
                                image_dark: null,
                                image_light: null,
                                slug: 'magnifier',
                                title: 'Magnifier',
                            },
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
        `**/api/v1/learner/play-runs/${playRunId}/activities/receive-magnifier/translation`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ translation: null }),
            });
        },
    );

    await page.goto(`/learning/nodes/private-place/play?run=${playRunId}`);

    await expect(
        page.getByText('Localized discovery: Magnifier'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Hide localized tool' }),
    ).toBeVisible();
    const takeTool = page.getByRole('button', {
        name: 'Claim localized tool',
    });
    await expect(takeTool).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(takeTool).toBeVisible();
    await expect
        .poll(async () => {
            const bounds = await takeTool.boundingBox();

            return bounds
                ? bounds.x >= 0 && bounds.x + bounds.width <= 390
                : false;
        })
        .toBe(true);
});
