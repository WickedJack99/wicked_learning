import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

const origin = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
).origin;
const api = (path: string) => new URL(path, origin).toString();

async function login(
    request: APIRequestContext,
    email: string,
    password: string,
): Promise<string> {
    const csrf = await request.get(api('/api/v1/security/csrf'));
    expect(csrf.status()).toBe(200);
    const { token } = await csrf.json();
    const result = await request.post(api('/api/v1/session/login'), {
        data: { email, password },
        headers: { Origin: origin, 'X-CSRF-Token': token },
    });
    expect(result.status()).toBe(200);
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

test('organizations preserve the source membership, leadership and chat workflow', async ({
    page,
    playwright,
    request,
}) => {
    const firstEmail = process.env.E2E_LOGIN_EMAIL;
    const firstPassword = process.env.E2E_LOGIN_PASSWORD;
    const secondEmail = process.env.E2E_SECOND_LOGIN_EMAIL;
    const secondPassword = process.env.E2E_SECOND_LOGIN_PASSWORD;
    test.skip(
        !firstEmail || !firstPassword || !secondEmail || !secondPassword,
        'requires two disposable local identities',
    );

    const marker = String(Date.now());
    const second = await playwright.request.newContext({ baseURL: origin });
    try {
        const firstCsrf = await login(request, firstEmail!, firstPassword!);
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

        const secondCsrf = await login(second, secondEmail!, secondPassword!);
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

        await page.goto(
            new URL('/settings?panel=admin-learning-support&support=organization-icons', origin).toString(),
        );
        await expect(page.getByRole('heading', { name: 'Organization Icons' })).toBeVisible();
        await expect(page.getByText(`Organization E2E ${marker}`)).toBeVisible();
        await page.getByRole('button', { name: 'Remove icon' }).click();
        await expect(page.getByText('No pending organization icon reports.')).toBeVisible();
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
