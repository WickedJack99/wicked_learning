import { expect, test } from './authenticated';

test('the Learning Support moderation workspace localizes fixed controls without translating private moderation data', async ({
    page,
}) => {
    const topic = {
        helpful_message_count: 1,
        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9a',
        map_asset_title: 'Server-owned map asset',
        map_title: 'Server-owned map',
        message_count: 2,
        title: 'Server-owned topic',
        unconfirmed_message_count: 1,
    };

    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                email: 'support@example.test',
                roles: ['learning_support'],
                settings_access: {},
                subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9b',
            }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                locale: 'test',
                translations: {
                    'settings.learner_messages.close_reply': 'Localized close reply',
                    'settings.learner_messages.delete': 'Localized delete',
                    'settings.learner_messages.filter_all': 'Localized all (:count)',
                    'settings.learner_messages.helpful_signal': 'Localized helpful',
                    'settings.learner_messages.hidden_note': 'Localized hidden',
                    'settings.learner_messages.next_page': 'Localized next',
                    'settings.learner_messages.page': 'Localized page :current of :total',
                    'settings.learner_messages.peer_message': 'Localized peer message',
                    'settings.learner_messages.previous_page': 'Localized previous',
                    'settings.learner_messages.reply_label': 'Localized private reply',
                    'settings.learner_messages.reply_privately': 'Localized reply privately',
                    'settings.learner_messages.reply_submit': 'Localized send reply',
                    'settings.learner_messages.reply_visibility': 'Localized reply visibility',
                    'settings.learner_messages.response_kind_explanation': 'Localized explanation',
                    'settings.learner_messages.responses_count_one': 'Localized :count response',
                    'settings.learner_messages.show': 'Localized show',
                    'settings.learner_messages.support_request': 'Localized support request',
                },
            }),
            contentType: 'application/json',
        });
    });
    await page.route('**/api/v1/learning-support/topics', async (route) => {
        await route.fulfill({ body: JSON.stringify([topic]), contentType: 'application/json' });
    });
    await page.route('**/api/v1/learning-support/topics/*/messages*', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                counts: { all: 2, helpful: 1, unconfirmed: 1 },
                messages: [
                    {
                        audience: 'support',
                        author: { email: 'private-learner@example.test', subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9c' },
                        body: 'Server-owned private request',
                        created_at: '2026-11-14T12:00:00Z',
                        hidden_at: null,
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9d',
                        response_count: 1,
                        response_pagination: { current_page: 1, last_page: 1, per_page: 6, total: 1 },
                        responses: [{
                            author: { email: 'supporter@example.test', subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9e' },
                            body: 'Server-owned private response',
                            created_at: '2026-11-14T12:01:00Z',
                            hidden_at: null,
                            id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4d9f',
                            is_helpful: true,
                            response_type: 'explanation',
                        }],
                    },
                    {
                        audience: 'peers',
                        author: { email: 'peer-learner@example.test', subject_id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4da0' },
                        body: 'Server-owned peer message',
                        created_at: '2026-11-14T12:02:00Z',
                        hidden_at: '2026-11-14T12:03:00Z',
                        id: '018f1f8c-4c2f-7b8a-9d0e-0f1a2b3c4da1',
                        response_count: 0,
                        response_pagination: { current_page: 1, last_page: 1, per_page: 6, total: 0 },
                        responses: [],
                    },
                ],
                pagination: { current_page: 1, last_page: 2, per_page: 6, total: 8 },
                topic,
            }),
            contentType: 'application/json',
        });
    });

    await page.goto('/settings?panel=admin-learning-support&support=learner-messages');

    await expect(page.getByText('Localized support request')).toBeVisible();
    await expect(page.getByText('Localized peer message')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Localized reply privately' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Localized show' })).toBeVisible();
    await expect(page.getByText('Localized hidden')).toBeVisible();
    await expect(page.getByText('Localized 1 response')).toBeVisible();
    await expect(page.getByText('Localized explanation')).toBeVisible();
    await expect(page.getByText('Localized helpful')).toBeVisible();
    await expect(page.getByText('Localized page 1 of 2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Localized previous' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Localized next' })).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Server-owned map asset' }),
    ).toBeVisible();
    await expect(
        page.getByText('Server-owned map · Server-owned topic'),
    ).toBeVisible();
    await expect(page.getByText('Server-owned private request')).toBeVisible();
    await expect(page.getByText('Server-owned private response')).toBeVisible();
    await expect(page.getByText('Server-owned peer message')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const supportLabel = page.getByText('Localized support request');
    await expect(supportLabel).toBeVisible();
    await expect.poll(async () => {
        const bounds = await supportLabel.boundingBox();
        return bounds ? bounds.x >= 0 && bounds.x + bounds.width <= 390 : false;
    }).toBe(true);
});
