import { expect, test } from './authenticated';

test('the Learning Support signal workspace localizes its unavailable state', async ({ page }) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ email: 'support@example.test', roles: ['learning_support'], settings_access: { learner_support_signals: true }, subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9a' }) });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ locale: 'test', translations: { 'settings.learning_support.signals.unavailable': 'Localized unavailable signals' } }) });
    });
    await page.route('**/api/v1/admin/learning-support/signals', async (route) => {
        await route.fulfill({ status: 503 });
    });

    await page.goto('/settings?panel=admin-learning-support&support=support-signals');
    await expect(page.getByRole('alert')).toHaveText('Localized unavailable signals');
});

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
                        'settings.learning_support.signals.individual.label':
                            'Localized individual support',
                        'settings.learning_support.individual.eyebrow':
                            'Localized learner support',
                        'settings.learning_support.individual.last_activity':
                            'Localized last activity',
                        'settings.learning_support.individual.current_month':
                            'Localized current month',
                        'settings.learning_support.individual.no_group':
                            'Localized no group',
                        'settings.learning_support.signals.no_activity_yet':
                            'Localized no activity',
                        'settings.learning_support.manual.title':
                            'Localized locked node',
                        'settings.learning_support.manual.description':
                            'Localized node guidance',
                        'settings.learning_support.manual.node':
                            'Localized node',
                        'settings.learning_support.manual.open':
                            'Localized open',
                        'settings.learning_support.manual.currently_open':
                            'Localized open nodes',
                        'settings.learning_support.manual.close':
                            'Localized close',
                        'settings.learning_support.notes.title':
                            'Localized support prompts',
                        'settings.learning_support.topics.title':
                            'Localized topic',
                        'settings.learning_support.topics.contribution':
                            'Localized contribution',
                        'settings.learning_support.topics.this_month':
                            'Localized this month',
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
                    can_grant_manual_unlocks: true,
                    learners: [
                        {
                            email: 'learner@example.test',
                            groups: [],
                            last_activity_at: null,
                            manual_unlocks: [
                                {
                                    granted_at: '2026-11-14T12:34:00Z',
                                    map_title: 'Server-owned open map',
                                    node_id:
                                        '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4da0',
                                    node_title: 'Server-owned open node',
                                },
                            ],
                            name: 'Server-owned learner',
                            subject_id:
                                '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4da1',
                            support_notes: [
                                {
                                    text: 'Server-owned support note',
                                    tone: 'support',
                                },
                            ],
                            topics: [
                                {
                                    evidence_types: ['reflection'],
                                    monthly_contribution: 1,
                                    name: 'Server-owned topic',
                                    slug: 'server-topic',
                                    total_contribution: 2,
                                },
                            ],
                            username: null,
                        },
                    ],
                    manual_unlock_targets: [
                        {
                            id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9e',
                            nodes: [
                                {
                                    id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9f',
                                    title: 'Server-owned node target',
                                },
                            ],
                            title: 'Server-owned map target',
                        },
                    ],
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

    await page.goto(
        '/settings?panel=admin-learning-support&support=support-signals&signals=individual',
    );
    await expect(
        page.getByRole('heading', { name: 'Localized individual support' }),
    ).toBeVisible();
    await expect(page.getByText('Localized learner support')).toBeVisible();
    await expect(page.getByText('Localized last activity')).toBeVisible();
    await expect(page.getByText('Localized no activity')).toBeVisible();
    await expect(page.getByText('Localized current month')).toBeVisible();
    await expect(page.getByText('Localized no group')).toBeVisible();
    await expect(page.getByText('Localized locked node')).toBeVisible();
    await expect(page.getByText('Localized node guidance')).toBeVisible();
    await expect(page.getByText('Localized node', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Localized open' })).toBeVisible();
    await expect(page.getByText('Localized open nodes')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Localized close' })).toBeVisible();
    await expect(page.getByText('Localized support prompts')).toBeVisible();
    await expect(
        page.getByText('Localized topic', { exact: true }),
    ).toHaveText('Localized topic');
    await expect(
        page.getByText('Localized contribution', { exact: true }),
    ).toHaveText('Localized contribution');
    await expect(
        page.getByText('Localized this month', { exact: true }),
    ).toHaveText('Localized this month');
    await expect(
        page.getByRole('heading', { name: 'Server-owned learner' }),
    ).toBeVisible();
    await expect(page.getByText('Server-owned support note')).toBeVisible();
    await expect(page.getByText('Server-owned topic')).toHaveText(
        'Server-owned topic',
    );
    await expect(
        page.getByRole('combobox', { name: 'Localized node' }),
    ).toContainText('Server-owned node target');
    await expect(page.getByText('Server-owned open map')).toBeVisible();
    await expect(page.getByText('Server-owned open node')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    const heading = page.getByRole('heading', {
        name: 'Localized individual support',
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
