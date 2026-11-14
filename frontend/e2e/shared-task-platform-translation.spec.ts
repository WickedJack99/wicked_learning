import { expect, test } from './authenticated';

test('the Shared Task playback surface consumes the platform catalog', async ({
    page,
}) => {
    const playRunId = '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e';

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5f',
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
                        'activities.shared_task.area.contribute':
                            'Localized contribution',
                        'activities.shared_task.area.peer_review':
                            'Localized peer review',
                        'activities.shared_task.peer_review':
                            'Localized peer review heading',
                        'activities.shared_task.peer_review_choose':
                            'Choose a localized contribution',
                        'activities.shared_task.peer_review_follow_up_add':
                            'Add a localized note',
                        'activities.shared_task.peer_review_helpful':
                            'Localized helpful mark',
                        'activities.shared_task.peer_review_received':
                            'Localized received feedback',
                        'activities.shared_task.peer_review_response_placeholder':
                            'Write a localized response',
                        'activities.shared_task.peer_review_response_type':
                            'Localized response type',
                        'activities.shared_task.peer_review_submit':
                            'Save localized review',
                        'activities.shared_task.peer_review_type.example':
                            'Localized example',
                        'activities.shared_task.project_step': 'Localized step',
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
                    start_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d60',
                    play_run_id: playRunId,
                    run_kind: 'route',
                    context: {
                        map_slug: 'private-map',
                        map_title: 'Private map',
                        node_slug: 'private-place',
                        node_title: 'Private place',
                        route_label: 'Shared task route',
                    },
                    items: [],
                    tools: [],
                    activity: {
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d61',
                        slug: 'shared-task',
                        title: 'A shared task',
                        description: 'An authored shared task.',
                        activity_type: 'shared_task',
                        config: {
                            minimumLength: 20,
                            projectSteps: ['Name a useful clue'],
                            repeatPolicy: 'one',
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
                        shared_task: {
                            accepted_count: 1,
                            can_share_contributions: true,
                            checklist: { completed_step_indexes: [] },
                            contributions: [],
                            has_submitted: true,
                            is_complete: false,
                            latest_submission_at: null,
                            peer_review: {
                                enabled: true,
                                has_reviewed: false,
                                prompt: 'Offer one useful response.',
                                received_reviews: [
                                    {
                                        body: 'A useful response from a peer.',
                                        can_mark_helpful: true,
                                        created_at: null,
                                        follow_up: null,
                                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d62',
                                        is_helpful: false,
                                        project_step: 'Name a useful clue',
                                        response_type: 'example',
                                    },
                                ],
                                reviewable_contributions: [
                                    {
                                        body: 'An anonymous contribution.',
                                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d63',
                                        project_step: 'Name a useful clue',
                                        task_kind: 'text',
                                        truncated: false,
                                    },
                                ],
                                submitted_review: null,
                            },
                            remaining: 1,
                            submission: {
                                body: 'My original contribution.',
                                can_revise: false,
                                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d64',
                                project_step: null,
                                revised_at: null,
                                revised_body: null,
                            },
                            threshold: 2,
                        },
                    },
                }),
            });
        },
    );
    await page.route(
        `**/api/v1/learner/play-runs/${playRunId}/activities/shared-task/translation`,
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({ translation: null }),
            });
        },
    );

    await page.goto(`/learning/nodes/private-place/play?run=${playRunId}`);
    await page.getByRole('button', { name: 'Localized peer review' }).click();

    await expect(
        page.getByRole('heading', { name: 'Localized peer review heading' }),
    ).toBeVisible();
    await expect(page.getByText('Localized received feedback')).toBeVisible();
    await expect(
        page.getByText('Localized step: Name a useful clue'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Localized helpful mark' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Add a localized note' }),
    ).toBeVisible();
    await expect(
        page.getByText('Choose a localized contribution'),
    ).toBeVisible();
    await expect(
        page.getByPlaceholder('Write a localized response'),
    ).toBeVisible();
    await expect(page.getByText('Localized response type')).toBeVisible();
    await expect(
        page.getByRole('combobox').filter({
            has: page.getByRole('option', { name: 'Localized example' }),
        }),
    ).toHaveCount(1);
    await expect(
        page.getByRole('button', { name: 'Save localized review' }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.getByRole('button', { name: 'Localized peer review' }).click();
    const saveReview = page.getByRole('button', {
        name: 'Save localized review',
    });
    await expect(saveReview).toBeVisible();
    await expect
        .poll(async () => {
            const bounds = await saveReview.boundingBox();

            return bounds
                ? bounds.x >= 0 && bounds.x + bounds.width <= 390
                : false;
        })
        .toBe(true);
});
