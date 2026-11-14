import { expect, installE2eAdminSession, test } from './authenticated';
import type { APIRequestContext } from '@playwright/test';
import {
    collaborationStorageStatePath,
    hasCollaborationStorageState,
} from './session-state';

const origin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;
const api = (path: string) => new URL(path, origin).toString();

async function csrfToken(request: APIRequestContext): Promise<string> {
    const csrf = await request.get(api('/api/v1/security/csrf'));
    expect(csrf.status()).toBe(200);
    const { token } = await csrf.json();
    return token;
}

async function createOrganization(
    request: APIRequestContext,
    csrf: string,
    marker: string,
): Promise<{ slug: string }> {
    const created = await request.post(api('/api/v1/organizations'), {
        data: {
            description: `A source-parity local organization ${marker}.`,
            governance_type: 'monarchy',
            name: `Organization E2E ${marker}`,
            slogan: 'A local collaboration space',
        },
        headers: { Origin: origin, 'X-CSRF-Token': csrf },
    });
    expect(created.status()).toBe(201);
    return (await created.json()).organization;
}

test('organization creation preserves the source submit-and-validate flow', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                appearance: 'light',
                avatar_url: null,
                capabilities: [],
                email: 'learner@example.test',
                name: 'Learner',
                roles: ['learner'],
                settings_access: {},
                subject_id: '00000000-0000-0000-0000-000000000001',
                username: null,
            }),
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ locale: 'en', translations: {} }),
        });
    });
    await page.route('**/api/v1/learner/feedback-prompt-preference', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ status: 'declined' }),
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });
    await page.route('**/api/v1/organizations', async (route) => {
        if (route.request().method() === 'POST') {
            await route.fulfill({
                contentType: 'application/json',
                status: 400,
                body: JSON.stringify({
                    code: 'invalid_request',
                    title: 'The request is not valid.',
                }),
            });
            return;
        }

        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                organizations: [],
                pagination: {
                    current_page: 1,
                    last_page: 1,
                    per_page: 12,
                    total: 0,
                },
            }),
        });
    });

    await page.goto('/organizations');

    await expect(
        page.getByRole('heading', { name: 'Organizations' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'New organization' }).click();

    const create = page.waitForRequest((request) =>
        request.url().endsWith('/api/v1/organizations') &&
        request.method() === 'POST',
    );
    const createButton = page.getByRole('button', { name: 'Create' });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    expect((await create).postDataJSON()).toMatchObject({ name: '' });
    await expect(
        page.getByText(
            'The organization could not be created. Check its name and your organization limit.',
        ),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
        page.getByRole('heading', { name: 'Create organization' }),
    ).toBeVisible();
});

test('organization detail preserves source section and page query parameters', async ({
    page,
}) => {
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                appearance: 'light',
                avatar_url: null,
                capabilities: [],
                email: 'learner@example.test',
                name: 'Learner',
                roles: ['learner'],
                settings_access: {},
                subject_id: '00000000-0000-0000-0000-000000000001',
                username: null,
            }),
        });
    });
    await page.route('**/api/v1/learner/platform-translations', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ locale: 'en', translations: {} }),
        });
    });
    await page.route('**/api/v1/learner/feedback-prompt-preference', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ status: 'declined' }),
        });
    });
    let requestedMembersPage = '';
    await page.route('**/api/v1/organizations/source-organization*', async (route) => {
        requestedMembersPage = new URL(route.request().url()).searchParams.get(
            'members_page',
        ) ?? '';
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                organization: {
                    can_moderate_messages: false,
                    can_send_messages: true,
                    description: null,
                    governance_type: 'monarchy',
                    icon_url: null,
                    id: '10000000-0000-0000-0000-000000000001',
                    is_leader: true,
                    leader_count: 1,
                    leadership_rotated_at: null,
                    member_count: 2,
                    members: [
                        {
                            id: '20000000-0000-0000-0000-000000000001',
                            joined_at: '2026-01-01T00:00:00Z',
                            role: 'leader',
                            user: {
                                id: '30000000-0000-0000-0000-000000000001',
                                name: 'Other learner',
                            },
                        },
                        {
                            id: '20000000-0000-0000-0000-000000000002',
                            joined_at: '2026-01-01T00:00:00Z',
                            role: 'member',
                            user: {
                                id: '30000000-0000-0000-0000-000000000002',
                                name: 'New member',
                            },
                        },
                    ],
                    members_pagination: {
                        current_page: 2,
                        last_page: 2,
                        per_page: 1,
                        total: 2,
                    },
                    messages: [],
                    messages_pagination: null,
                    name: 'Source organization',
                    pending_join_requests: [],
                    pending_join_requests_pagination: null,
                    slug: 'source-organization',
                    slogan: null,
                    viewer_join_request: null,
                    viewer_membership: {
                        id: '20000000-0000-0000-0000-000000000001',
                        joined_at: '2026-01-01T00:00:00Z',
                        role: 'leader',
                        user: {
                            id: '30000000-0000-0000-0000-000000000001',
                            name: 'Learner',
                        },
                    },
                },
            }),
        });
    });
    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ token: 'test-csrf-token' }),
        });
    });
    await page.route('**/api/v1/organizations/source-organization/messages', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            status: 400,
            body: JSON.stringify({
                code: 'invalid_request',
                title: 'The request is not valid.',
            }),
        });
    });

    await page.goto('/organizations/source-organization?section=members&members_page=2');

    await expect(
        page.getByRole('heading', { name: 'Source organization' }),
    ).toBeVisible();
    await expect.poll(() => requestedMembersPage).toBe('2');
    await expect(
        page.getByRole('button', { name: 'Members (2)' }),
    ).toHaveClass(/bg-\[/);
    await expect(page.getByText('Other learner')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Make leader' }),
    ).toBeVisible();
    await page
        .getByRole('navigation', { name: 'Organization members' })
        .getByRole('button', { name: 'Previous' })
        .click();
    await expect.poll(() => requestedMembersPage).toBe('');
    await expect(page).toHaveURL(/\?section=members$/);
    await page.goto('/organizations/source-organization?section=membership');
    await expect(
        page.getByText(
            'You are the last leader. Delete the organization from leader controls instead of leaving it.',
        ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open leader controls' }).click();
    await expect(
        page.getByRole('heading', { name: 'Leader controls' }),
    ).toBeVisible();
    await page.goto('/organizations/source-organization?section=chat');
    const send = page.waitForRequest((request) =>
        request.url().endsWith('/api/v1/organizations/source-organization/messages') &&
        request.method() === 'POST',
    );
    const sendButton = page.getByRole('button', { name: 'Send message' });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();
    expect((await send).postDataJSON()).toEqual({ body: '' });
    await expect(
        page.getByText(
            'This organization action could not be completed. Please try again.',
        ),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
        page.getByRole('heading', { name: 'Organization chat' }),
    ).toBeVisible();
});

test('organizations preserve the source membership, leadership and chat workflow', async ({
    page,
    playwright,
    request,
}) => {
    test.skip(
        !process.env.E2E_LOGIN_EMAIL || !process.env.E2E_LOGIN_PASSWORD || !hasCollaborationStorageState(),
        'requires the disposable local administrator and global collaboration sessions',
    );

    const marker = String(Date.now());
    const second = await playwright.request.newContext({
        baseURL: origin,
        storageState: collaborationStorageStatePath('second'),
    });
    try {
        await installE2eAdminSession(page.context());
        request = page.context().request;
        const firstCsrf = await csrfToken(request);
        const firstStorage = await page.context().storageState();
        const organization = await createOrganization(request, firstCsrf, marker);
        const uploaded = await request.post(
            api(`/api/v1/organizations/${organization.slug}/icon`),
            {
                headers: { Origin: origin, 'X-CSRF-Token': firstCsrf },
                multipart: {
                    file: {
                        buffer: Buffer.from(
                            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><rect width="20" height="20" fill="#d4a72c"/></svg>',
                        ),
                        mimeType: 'image/svg+xml',
                        name: 'organization-icon.svg',
                    },
                },
            },
        );
        expect(uploaded.status()).toBe(200);
        const iconUrl = (await uploaded.json()).url as string;
        const servedIcon = await request.get(api(iconUrl));
        expect(servedIcon.status()).toBe(200);
        expect(servedIcon.headers()['content-type']).toBe('image/svg+xml');

        const secondCsrf = await csrfToken(second);
        const requested = await second.post(
            api(`/api/v1/organizations/${organization.slug}/join-requests`),
            {
                data: { message: `Please add me (${marker}).` },
                headers: { Origin: origin, 'X-CSRF-Token': secondCsrf },
            },
        );
        expect(requested.status()).toBe(200);

        const leaderView = await request.get(
            api(`/api/v1/organizations/${organization.slug}`),
        );
        expect(leaderView.status()).toBe(200);
        const requestId = (await leaderView.json()).organization
            .pending_join_requests[0].id;
        const approved = await request.patch(
            api(`/api/v1/organization-join-requests/${requestId}`),
            {
                data: { approved: true },
                headers: { Origin: origin, 'X-CSRF-Token': firstCsrf },
            },
        );
        expect(approved.status()).toBe(200);

        const sent = await second.post(
            api(`/api/v1/organizations/${organization.slug}/messages`),
            {
                data: { body: `A member chat message (${marker}).` },
                headers: { Origin: origin, 'X-CSRF-Token': secondCsrf },
            },
        );
        expect(sent.status()).toBe(200);

        const reported = await second.post(
            api(`/api/v1/organizations/${organization.slug}/icon-reports`),
            {
                data: { reason: `Please review this source-parity icon (${marker}).` },
                headers: { Origin: origin, 'X-CSRF-Token': secondCsrf },
            },
        );
        expect(reported.status()).toBe(204);

        const storage = await second.storageState();
        await page.context().addCookies(storage.cookies);
        await page.goto(
            new URL(`/organizations/${organization.slug}`, origin).toString(),
        );
        await expect(page.getByRole('heading', { name: `Organization E2E ${marker}` })).toBeVisible();
        await expect(page.getByRole('img', { name: `Organization E2E ${marker} icon` })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Report icon' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Chat' })).toBeVisible();
        await page.getByRole('button', { name: 'Chat' }).click();
        await expect(page.getByText(`A member chat message (${marker}).`)).toBeVisible();
        await expect(page.getByRole('button', { name: /Members \(2\)/ })).toBeVisible();

        await page.context().addCookies(firstStorage.cookies);
        await page.goto(
            new URL('/settings?panel=admin-learning-support&support=organization-icons', origin).toString(),
        );
        await expect(
            page.getByRole('tablist', { name: 'Learning support sections' }),
        ).toBeVisible();
        await expect(
            page
                .getByRole('tablist', { name: 'Learning support sections' })
                .getByRole('tab', { name: 'Organization Icons' }),
        ).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByRole('heading', { name: 'Organization Icons' })).toBeVisible();
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(
            page.getByLabel('Learning support section', { exact: true }),
        ).toHaveValue('organization-icons');
        await page.setViewportSize({ width: 1280, height: 844 });
        const membershipLimit = page.getByLabel('Organization membership limit');
        await membershipLimit.fill('9');
        const savePolicy = page.getByRole('button', { name: 'Save' });
        await Promise.all([
            page.waitForResponse((response) => response.url().endsWith('/api/v1/admin/organization-policy') && response.request().method() === 'PATCH' && response.status() === 200),
            savePolicy.click(),
        ]);
        await expect(membershipLimit).toHaveValue('9');
        await membershipLimit.fill('10');
        await Promise.all([
            page.waitForResponse((response) => response.url().endsWith('/api/v1/admin/organization-policy') && response.request().method() === 'PATCH' && response.status() === 200),
            savePolicy.click(),
        ]);
        await expect(membershipLimit).toHaveValue('10');
        await expect(page.getByText(`Organization E2E ${marker}`)).toBeVisible();
        await page.locator('article').filter({ hasText: `Organization E2E ${marker}` }).getByRole('button', { name: 'Remove icon' }).click();
        await expect(page.getByText(`Organization E2E ${marker}`)).toHaveCount(0);
        const afterRemoval = await request.get(
            api(`/api/v1/organizations/${organization.slug}`),
        );
        expect(afterRemoval.status()).toBe(200);
        expect((await afterRemoval.json()).organization.icon_url).toBeNull();

        const deleted = await request.delete(
            api(`/api/v1/organizations/${organization.slug}`),
            { headers: { Origin: origin, 'X-CSRF-Token': firstCsrf } },
        );
        expect(deleted.status()).toBe(204);
        expect(
            (await second.get(api(`/api/v1/organizations/${organization.slug}`))).status(),
        ).toBe(404);
    } finally {
        await second.dispose();
    }
});
