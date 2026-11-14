import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const journalThemeMode = {
    accent: '#2dd4bf',
    accent_opacity: 100,
    accent_text: '#020617',
    accent_text_opacity: 100,
    background_assets: [],
    background_image: '',
    background_overlay: '#020617',
    background_overlay_opacity: 72,
    background_position_x: 50,
    background_position_y: 50,
    background_zoom: 100,
    body_text: '#e2e8f0',
    body_text_opacity: 100,
    button_background: '#0f172a',
    button_background_opacity: 100,
    button_border: '#475569',
    button_border_opacity: 100,
    button_text: '#f8fafc',
    button_text_opacity: 100,
    content_background: '#0f172a',
    content_background_opacity: 100,
    header_background: '#0f172a',
    header_background_opacity: 100,
    heading_text: '#f8fafc',
    heading_text_opacity: 100,
    input_background: '#020617',
    input_background_opacity: 100,
    muted_text: '#94a3b8',
    muted_text_opacity: 100,
    panel_background: '#0b1117',
    panel_background_opacity: 100,
    panel_border: '#475569',
    panel_border_opacity: 100,
    selected_background: '#134e4a',
    selected_background_opacity: 100,
    selected_border: '#5eead4',
    selected_border_opacity: 100,
    selected_text: '#f8fafc',
    selected_text_opacity: 100,
    sidebar_background: '#111827',
    sidebar_background_opacity: 100,
};

test('the source Journal localizes review, revisit, and check-in copy without clipping at 390px', async ({
    page,
}) => {
    await page.route('**/api/v1/me', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                appearance: 'dark',
                avatar_url: null,
                capabilities: [],
                email: 'learner@example.test',
                name: 'Learner',
                roles: ['learner'],
                settings_access: {},
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5e',
                username: null,
            }),
        }),
    );
    await page.route('**/api/v1/learner/platform-translations', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'journal.feedback.ready': 'Translated feedback guidance.',
                    'journal.feedback.request': 'Translated request feedback',
                    'journal.revisit.chosen': 'Translated return choice',
                    'journal.revisit.due': 'Translated after :days days.',
                    'journal.revisit.ready': 'Translated readiness',
                    'learning.activity.check_in.direction.related.label':
                        'Translated direction',
                },
            }),
        }),
    );
    await page.route('**/api/v1/learner/journal?*', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                allow_expert_access_requests: true,
                check_ins: [
                    {
                        activity_slug: 'consider-a-direction',
                        activity_title: 'Consider a direction',
                        feeling: 'clearer',
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d5f',
                        map_slug: 'orientation-map',
                        map_title: 'Orientation map',
                        next_direction: 'related',
                        node_slug: 'arrival',
                        node_title: 'Arrival',
                        note: null,
                        origin_topic_slug: null,
                        recorded_at: '2026-11-14T09:00:00Z',
                        topics: [],
                    },
                ],
                feedback_domains: [
                    {
                        id: null,
                        key: 'journal',
                        label: 'Journal reviewers',
                        type: 'journal',
                    },
                ],
                pages: [
                    {
                        expert_access_requested: false,
                        feedback_request: null,
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d60',
                        learning_context: null,
                        markdown: '',
                        preferred_mode: 'view',
                        reflection_count: 0,
                        subtopic: null,
                        title: 'Private field note',
                        topic: 'Field studies',
                        updated_at: '2026-11-14T09:00:00Z',
                    },
                ],
                pagination: {
                    current_page: 1,
                    last_page: 1,
                    per_page: 4,
                    total: 1,
                },
                revisit_invitations: [
                    {
                        activity_slug: 'consider-a-direction',
                        activity_title: 'Consider a direction',
                        available_after_days: 3,
                        available_at: '2026-11-14T09:00:00Z',
                        available_since: '2026-11-11T09:00:00Z',
                        check_in_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d61',
                        map_slug: 'orientation-map',
                        map_title: 'Orientation map',
                        node_slug: 'arrival',
                        node_title: 'Arrival',
                        revisit_reason: 'pause',
                    },
                ],
                theme: { dark: journalThemeMode, light: journalThemeMode },
            }),
        }),
    );

    await page.goto('/home?journal=1');
    const journal = page.locator('#learning-journal-panel');
    await expect(journal).toBeVisible();
    await expect(
        journal.getByText('Translated feedback guidance.'),
    ).toBeVisible();
    await expect(
        journal.getByRole('button', { name: 'Translated request feedback' }),
    ).toBeVisible();
    await expect(journal.getByText('Translated direction')).toBeVisible();
    await expect(journal.getByText('Translated return choice')).toBeVisible();
    await expect(journal.getByText('Translated readiness')).toBeVisible();
    await expect(journal.getByText('Translated after 3 days.')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(journal).toBeVisible();
    await expectWithinViewport(page, journal);
    const requestFeedback = journal.getByRole('button', {
        name: 'Translated request feedback',
    });
    await requestFeedback.scrollIntoViewIfNeeded();
    await expectWithinViewport(page, requestFeedback);
});

async function expectWithinViewport(
    page: Page,
    locator: Locator,
): Promise<void> {
    const box = await locator.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(
        (await page.viewportSize())!.width,
    );
    expect(box!.y + box!.height).toBeLessThanOrEqual(
        (await page.viewportSize())!.height,
    );
}
