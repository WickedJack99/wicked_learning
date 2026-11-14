import { expect, test } from './authenticated';

test('the Learning Support prompt consumes fixed catalog copy while retaining server-owned context', async ({
    page,
}) => {
    const playRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9a';

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
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
                        'activities.support.default_prompt':
                            'Describe your localized support need.',
                        'activities.support.description':
                            'Localized private-support guidance.',
                        'activities.support.input_label': 'Localized request',
                        'activities.support.send': 'Send localized request',
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
                    start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9c',
                    play_run_id: playRunId,
                    run_kind: 'route',
                    context: {
                        map_slug: 'private-map',
                        map_title: 'Private map',
                        node_slug: 'private-place',
                        node_title: 'Private place',
                        route_label: 'Support route',
                    },
                    items: [],
                    tools: [],
                    activity: {
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9d',
                        slug: 'support-prompt',
                        title: 'A source-authored support prompt',
                        description: 'An authored activity description.',
                        activity_type: 'message_prompt',
                        config: { messageAudience: 'support' },
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
        `**/api/v1/learner/play-runs/${playRunId}/activities/support-prompt/translation`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ translation: null }),
            });
        },
    );
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/support-prompt/support-request`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    has_contributed: false,
                    message: null,
                    topic_title: 'Server-owned support topic',
                }),
            });
        },
    );

    await page.goto(`/learning/nodes/private-place/play?run=${playRunId}`);

    await expect(
        page.getByText('Server-owned support topic'),
    ).toBeVisible();
    await expect(
        page.getByText('Describe your localized support need.'),
    ).toBeVisible();
    await expect(
        page.getByText('Localized private-support guidance.'),
    ).toBeVisible();
    await expect(page.getByLabel('Localized request')).toBeVisible();
    const send = page.getByRole('button', {
        name: 'Send localized request',
    });
    await expect(send).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(send).toBeVisible();
    await expect
        .poll(async () => {
            const bounds = await send.boundingBox();

            return bounds
                ? bounds.x >= 0 && bounds.x + bounds.width <= 390
                : false;
        })
        .toBe(true);
});
