import { expect, test } from './authenticated';

test('the Learning Support signal workspace consumes fixed catalog copy without translating the scoped signal data', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'support@example.test',
                roles: ['learning_support'],
                settings_access: { learner_support_signals: true },
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9a',
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
                        'settings.learning_support.peer_support.contributor':
                            'localized contributor',
                        'settings.learning_support.peer_support.contributors':
                            'localized contributors',
                        'settings.learning_support.peer_support.description':
                            'Localized private queue guidance.',
                        'settings.learning_support.peer_support.eyebrow':
                            'Localized queue',
                        'settings.learning_support.peer_support.latest_review':
                            'Localized latest review: :review',
                        'settings.learning_support.peer_support.review_waiting':
                            'localized review waiting',
                        'settings.learning_support.peer_support.reviews_waiting':
                            'localized reviews waiting',
                        'settings.learning_support.peer_support.title':
                            'Localized peer queue',
                        'settings.learning_support.signals.collective.label':
                            'Localized collective overview',
                        'settings.learning_support.collective.active_days':
                            'Localized active days',
                        'settings.learning_support.collective.chart_label':
                            'Localized activity chart',
                        'settings.learning_support.collective.description':
                            'Localized collective guidance.',
                        'settings.learning_support.collective.eyebrow':
                            'Localized collective activity',
                        'settings.learning_support.collective.max_learners':
                            'Localized learner maximum',
                        'settings.learning_support.collective.title':
                            'Localized thirty day view',
                        'settings.learning_support.collective.topic_signals':
                            'Localized topic signals',
                    },
                }),
            });
        },
    );
    await page.route(
        '**/api/v1/admin/learning-support/signals',
        async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    activity_overview_30_days: [
                        {
                            active_learners: 1,
                            contribution_recorded: 0,
                            date: '2026-11-13',
                            evidence_events: 2,
                        },
                        {
                            active_learners: 3,
                            contribution_recorded: 0,
                            date: '2026-11-14',
                            evidence_events: 5,
                        },
                    ],
                    can_grant_manual_unlocks: false,
                    learners: [],
                    manual_unlock_targets: [],
                    month_key: '2026-11',
                    peer_support: [
                        {
                            activity_id:
                                '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
                            activity_title: 'Server-owned activity title',
                            context_href: '/world?map=private-map&focused=private-node',
                            contributor_count: 2,
                            latest_review_at: '2026-11-14T12:34:00Z',
                            map_id:
                                '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9c',
                            map_title: 'Server-owned map title',
                            node_id:
                                '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9d',
                            node_title: 'Server-owned node title',
                            unresolved_review_count: 2,
                        },
                    ],
                    summary: {
                        learners: 0,
                        learners_with_signals: 0,
                        topics_with_monthly_activity: 0,
                    },
                }),
            });
        },
    );

    await page.goto(
        '/settings?panel=admin-learning-support&support=support-signals&signals=peer-support',
    );

    await expect(page.getByText('Localized queue')).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Localized peer queue' }),
    ).toBeVisible();
    await expect(
        page.getByText('Localized private queue guidance.'),
    ).toBeVisible();
    await expect(page.getByText('Server-owned activity title')).toBeVisible();
    await expect(page.getByText('Server-owned map title')).toBeVisible();
    await expect(page.getByText('Server-owned node title')).toBeVisible();
    await expect(page.getByText('localized reviews waiting')).toBeVisible();
    await expect(page.getByText('localized contributors')).toBeVisible();
    await expect(
        page.getByText(/^Localized latest review:/),
    ).toBeVisible();

    await page.goto(
        '/settings?panel=admin-learning-support&support=support-signals&signals=collective',
    );
    await expect(
        page.getByRole('heading', {
            name: 'Localized collective overview',
        }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Localized thirty day view' }),
    ).toBeVisible();
    await expect(
        page.getByText('Localized collective guidance.'),
    ).toBeVisible();
    await expect(page.getByText('Localized active days')).toBeVisible();
    await expect(page.getByText('Localized learner maximum')).toBeVisible();
    await expect(page.getByText('Localized topic signals')).toBeVisible();
    await expect(
        page.getByRole('img', { name: 'Localized activity chart' }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    const heading = page.getByRole('heading', {
        name: 'Localized collective overview',
    });
    await expect(heading).toBeVisible();
    await expect
        .poll(async () => {
            const bounds = await heading.boundingBox();

            return bounds
                ? bounds.x >= 0 && bounds.x + bounds.width <= 390
                : false;
        })
        .toBe(true);
});
