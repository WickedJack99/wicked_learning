import { expect, test } from './authenticated';

test('a learner receives the canonical English platform catalog while no alternate locale is enabled', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(
        !email || !password,
        'requires the disposable local administrator',
    );

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const catalog = await page.request.get(
        '/api/v1/learner/platform-translations',
    );
    expect(catalog.status()).toBe(200);
    await expect(catalog.json()).resolves.toMatchObject({
        locale: 'en',
        translations: { 'common.cancel': 'Cancel' },
    });
});

test('the lifted learner header consumes the scoped platform catalog', async ({
    page,
}) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
            }),
        }),
    );
    await page.route('**/api/v1/learner/platform-translations', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'navigation.primary.learning_desk': 'Lernbereich',
                },
            }),
        }),
    );
    await page.goto('/home');
    await expect(page.getByRole('link', { name: 'Lernbereich' })).toBeVisible();

    const desktopNavigationItems = page.locator(
        '[data-wl-id^="learner.navigation.item."]',
    );
    await expect(desktopNavigationItems).toHaveCount(6);
    await expectNavigationItemsInsideViewport(page, desktopNavigationItems);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole('link', { name: 'Lernbereich' })).toBeVisible();
    await expectNavigationItemsInsideViewport(
        page,
        page.locator('[data-wl-id^="learner.navigation.item."]'),
    );
});

test('the lifted Paths reader consumes its source platform catalog entries', async ({
    page,
}) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
            }),
        }),
    );
    await page.route('**/api/v1/learner/platform-translations', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'paths.description': 'Translated route guidance.',
                    'paths.eyebrow': 'Translated routes',
                    'paths.title': 'Translated Paths',
                },
            }),
        }),
    );
    await page.route('**/api/v1/learner/paths**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                pagination: {
                    current_page: 1,
                    last_page: 1,
                    per_page: 6,
                    total: 0,
                },
                paths: [],
                selected_purpose: null,
                selected_time_budget: null,
                topic_context: null,
            }),
        }),
    );

    await page.goto('/paths');
    await expect(
        page.getByRole('heading', { name: 'Translated Paths' }),
    ).toBeVisible();
    await expect(page.getByText('Translated route guidance.')).toBeVisible();
    await expect(page.getByText('Translated routes')).toBeVisible();
});

test('the topic directory receives its source management capability and catalog copy', async ({
    page,
}) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'author@example.test',
                roles: ['author'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
            }),
        }),
    );
    await page.route('**/api/v1/learner/platform-translations', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'topics.manage': 'Manage localized topics',
                    'topics.title': 'Translated Topics',
                },
            }),
        }),
    );
    await page.route('**/api/v1/learner/topics**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                areas: [{ slug: 'orientation', title: 'Orientation' }],
                can_manage_topics: true,
                pagination: {
                    current_page: 1,
                    last_page: 1,
                    per_page: 6,
                    total: 0,
                },
                search: '',
                selected_area: {
                    description: null,
                    slug: 'orientation',
                    title: 'Orientation',
                    topics: [],
                },
            }),
        }),
    );

    await page.goto('/topics');
    await expect(
        page.getByRole('heading', { name: 'Translated Topics' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Manage localized topics' }),
    ).toHaveAttribute('href', '/admin/topics');
});

test('the topic detail consumes its source navigation and overview catalog copy', async ({
    page,
}) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
            }),
        }),
    );
    await page.route('**/api/v1/learner/platform-translations', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'topics.detail.navigation.label': 'Localized sections',
                    'topics.detail.navigation.overview': 'Localized overview',
                    'topics.detail.no_content':
                        'Localized topic overview guidance.',
                    'topics.detail.no_subtopics':
                        'Localized empty subtopics guidance.',
                    'topics.detail.subtopics': 'Localized subtopics',
                },
            }),
        }),
    );
    await page.route('**/api/v1/learner/topics/example/overview**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                subtopics: [],
                subtopics_pagination: {
                    current_page: 1,
                    last_page: 1,
                    per_page: 6,
                    total: 0,
                },
                topic: {
                    area_title: 'Orientation',
                    content: null,
                    description: null,
                    parent: null,
                    slug: 'example',
                    title: 'Example topic',
                },
            }),
        }),
    );

    await page.goto('/topics/example?section=overview');
    await expect(
        page.getByRole('tablist', { name: 'Localized sections' }),
    ).toBeVisible();
    await expect(
        page.getByRole('tab', { name: 'Localized overview' }),
    ).toBeVisible();
    await expect(
        page.getByText('Localized topic overview guidance.'),
    ).toBeVisible();
    await expect(page.getByText('Localized subtopics')).toBeVisible();
    await expect(
        page.getByText('Localized empty subtopics guidance.'),
    ).toBeVisible();
});

test('the topic trail consumes its source competence catalog copy', async ({
    page,
}) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
            }),
        }),
    );
    await page.route('**/api/v1/learner/platform-translations', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'topics.detail.competence.empty':
                        'Localized first learning light.',
                    'topics.detail.competence.eyebrow':
                        'Localized learning trail',
                    'topics.detail.competence.open_all':
                        'Localized competence map',
                    'topics.detail.competence.title': 'Localized topic trail',
                },
            }),
        }),
    );
    await page.route('**/api/v1/learner/topics/example/trail', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                competence: null,
                learning_areas: [],
                learning_pulse: [],
                reflection_narrative: null,
                subtopic_competence: [],
                topic: {
                    area_title: 'Orientation',
                    description: null,
                    parent: null,
                    slug: 'example',
                    title: 'Example topic',
                },
            }),
        }),
    );

    await page.goto('/topics/example');
    await expect(page.getByText('Localized learning trail')).toBeVisible();
    await expect(page.getByText('Localized topic trail')).toBeVisible();
    await expect(
        page.getByText('Localized first learning light.'),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Localized competence map' }),
    ).toBeVisible();
});

test('the topic trail preserves localized evidence detail and sources', async ({
    page,
}) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
            }),
        }),
    );
    await page.route('**/api/v1/learner/platform-translations', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'competence.evidence.sources': 'Localized sources',
                    'learning.calibration.after_guidance':
                        'Localized after guidance:',
                    'learning.calibration.before_answer':
                        'Localized before answering:',
                    'learning.evidence.assistance_supported':
                        'Localized support context',
                    'learning.reflection.independent_check_short':
                        'Localized independent check',
                    'learning.reflection.observed_cues_label':
                        'Localized noticed: ',
                    'learning.review.outcome_clearer': 'Localized clearer',
                    'learning.review.outcome_clearer_description':
                        'Localized outcome description.',
                    'learning.review.outcome_signal':
                        'Localized review signal',
                },
            }),
        }),
    );
    await page.route('**/api/v1/learner/topics/example/trail', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                competence: {
                    name: 'Example competence',
                    revisit: null,
                    slug: 'example-competence',
                    visual: {
                        aura_ratio: 0.2,
                        brightness_ratio: 0.4,
                        description: 'A concrete evidence trail.',
                        evidence_ledger: [
                            {
                                activity_slug: 'example-activity',
                                activity_title: 'Example activity',
                                assistance_level: 'supported',
                                attempt_number: 2,
                                concepts: ['A concept'],
                                confidence: 'leaning',
                                confidence_after_feedback: 'settled',
                                evidence_claim: 'reflection',
                                evidence_criterion: 'Notice the next step.',
                                evidence_rubric: ['Specific cue'],
                                evidence_type: 'reflect',
                                id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                                independent_check: true,
                                learning_purpose: 'Practice a next step.',
                                node_slug: 'example-node',
                                node_title: 'Example node',
                                objective: 'Orient with care.',
                                observed_cues: ['Named a choice'],
                                outcome: 'clearer',
                                recorded_at: '2026-11-14T12:00:00Z',
                                sources: [
                                    {
                                        anchor: null,
                                        concepts: [],
                                        excerpt: null,
                                        published_at: null,
                                        publisher: null,
                                        rights: null,
                                        title: 'Example source',
                                        url: 'https://example.test/source',
                                    },
                                ],
                            },
                        ],
                        evidence_types: ['reflect'],
                        learning_periods: ['Nov 2026'],
                        recent_description: 'A recent observation.',
                        size_ratio: 0.3,
                        size_tier: 'star',
                    },
                },
                learning_areas: [],
                learning_pulse: [],
                reflection_narrative: null,
                subtopic_competence: [],
                topic: {
                    area_title: 'Orientation',
                    content: null,
                    description: null,
                    parent: null,
                    slug: 'example',
                    title: 'Example topic',
                },
            }),
        }),
    );

    await page.goto('/topics/example');
    await expect(page.getByText('Localized noticed: Named a choice')).toBeVisible();
    await expect(page.getByText('Localized independent check')).toBeVisible();
    await expect(page.getByText('Localized review signal')).toBeVisible();
    await expect(page.getByText('Localized after guidance: settled')).toBeVisible();
    await expect(page.getByText('Localized support context')).toBeVisible();
    await expect(page.getByText('Localized sources:')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Example source' })).toHaveAttribute(
        'href',
        'https://example.test/source',
    );

    await page.setViewportSize({ width: 390, height: 844 });
    const source = page.getByRole('link', { name: 'Example source' });
    await source.scrollIntoViewIfNeeded();
    const box = await source.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});

test('the topic routes filters consume their source catalog copy', async ({
    page,
}) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                email: 'learner@example.test',
                roles: ['learner'],
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
            }),
        }),
    );
    await page.route('**/api/v1/learner/platform-translations', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'topics.detail.paths.description':
                        'Localized route guidance.',
                    'topics.detail.paths.eyebrow': 'Localized routes',
                    'topics.detail.paths.filters.purpose.label':
                        'Localized purpose',
                    'topics.detail.paths.filters.time.label': 'Localized time',
                    'topics.detail.paths.title': 'Localized route start',
                },
            }),
        }),
    );
    await page.route('**/api/v1/learner/paths**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                pagination: {
                    current_page: 1,
                    last_page: 1,
                    per_page: 6,
                    total: 0,
                },
                paths: [],
                selected_purpose: null,
                selected_time_budget: null,
                topic_context: {
                    area_title: 'Orientation',
                    description: null,
                    parent: null,
                    slug: 'example',
                    title: 'Example topic',
                },
            }),
        }),
    );

    await page.goto('/topics/example?section=routes');
    await expect(page.getByText('Localized routes')).toBeVisible();
    await expect(page.getByText('Localized route start')).toBeVisible();
    await expect(page.getByText('Localized route guidance.')).toBeVisible();
    await expect(page.getByLabel('Localized purpose')).toBeVisible();
    await expect(page.getByLabel('Localized time')).toBeVisible();
});

async function expectNavigationItemsInsideViewport(
    page: import('@playwright/test').Page,
    items: import('@playwright/test').Locator,
): Promise<void> {
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('the test browser has no viewport');

    for (let index = 0; index < (await items.count()); index += 1) {
        const box = await items.nth(index).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
}
