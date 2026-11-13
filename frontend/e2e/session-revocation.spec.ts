import { randomUUID } from 'node:crypto';

import {
    expect,
    test,
    type Browser,
    type BrowserContext,
    type Page,
} from '@playwright/test';

import { installE2eAdminSession } from './authenticated';

const origin = 'http://localhost:8081';
const rateLimitRetryDelayMs = 60_000;

async function csrfToken(page: Page): Promise<string> {
    const response = await page.request.get('/api/v1/security/csrf');
    expect(response.ok()).toBeTruthy();

    return ((await response.json()) as { token: string }).token;
}

async function registerDisposableLearner(
    browser: Browser,
    registrationToken: string,
    label: string,
): Promise<{ context: BrowserContext; email: string; page: Page }> {
    const context = await browser.newContext();
    const page = await context.newPage();
    const marker = randomUUID();
    const email = `session-security-${marker}@wicked-learning.local`;
    const password = `Session-security-${marker}`;
    const token = await csrfToken(page);
    const request = () =>
        page.request.post('/api/v1/registration', {
            data: {
                email,
                name: `Session security ${label}`,
                password,
                password_confirmation: password,
                registration_token: registrationToken,
            },
            headers: {
                Origin: origin,
                'X-CSRF-Token': token,
            },
        });
    let registration = await request();
    if (registration.status() === 429) {
        await page.waitForTimeout(rateLimitRetryDelayMs);
        registration = await request();
    }
    expect(registration.status()).toBe(200);
    const session = await page.request.get('/api/v1/session');
    expect(session.status()).toBe(200);
    await expect(session.json()).resolves.toMatchObject({ authenticated: true });

    return { context, email, page };
}

async function subjectIdForEmail(page: Page, email: string): Promise<string> {
    const response = await page.request.get('/api/v1/admin/users');
    expect(response.status()).toBe(200);
    const { users } = (await response.json()) as {
        users: Array<{ email: string; subject_id: string }>;
    };
    const subject = users.find((user) => user.email === email);
    expect(subject).toBeDefined();

    return subject!.subject_id;
}

async function createRegistrationToken(page: Page, note: string): Promise<string> {
    const token = await csrfToken(page);
    const response = await page.request.post('/api/v1/registration-tokens', {
        data: { note, roles: ['learner'] },
        headers: {
            Origin: origin,
            'X-CSRF-Token': token,
        },
    });
    expect(response.status()).toBe(200);

    return ((await response.json()) as { token: string }).token;
}

test('logout and an administrator login disablement revoke disposable server sessions', async ({
    browser,
    page,
}) => {
    test.setTimeout(180_000);
    test.skip(
        !process.env.E2E_LOGIN_EMAIL || !process.env.E2E_LOGIN_PASSWORD,
        'requires the disposable local administrator',
    );

    await installE2eAdminSession(page.context());

    const logoutRegistrationToken = await createRegistrationToken(
        page,
        `Session logout E2E ${randomUUID()}`,
    );
    const logoutLearner = await registerDisposableLearner(
        browser,
        logoutRegistrationToken,
        'logout learner',
    );
    let logoutSubjectId: string | undefined;
    try {
        logoutSubjectId = await subjectIdForEmail(page, logoutLearner.email);
        const token = await csrfToken(logoutLearner.page);
        const logout = await logoutLearner.page.request.post('/api/v1/session/logout', {
            headers: {
                Origin: origin,
                'X-CSRF-Token': token,
            },
        });
        expect(logout.status()).toBe(204);
        const session = await logoutLearner.page.request.get('/api/v1/session');
        expect(session.status()).toBe(200);
        await expect(session.json()).resolves.toEqual({
            authenticated: false,
            subject_id: null,
            two_factor_required: false,
        });
    } finally {
        if (logoutSubjectId) {
            const token = await csrfToken(page);
            const deletion = await page.request.delete(
                `/api/v1/admin/users/${logoutSubjectId}`,
                {
                    headers: { Origin: origin, 'X-CSRF-Token': token },
                },
            );
            expect(deletion.status()).toBe(204);
        }
        await logoutLearner.context.close();
    }

    const disableRegistrationToken = await createRegistrationToken(
        page,
        `Session disable E2E ${randomUUID()}`,
    );
    const disabledLearner = await registerDisposableLearner(
        browser,
        disableRegistrationToken,
        'disabled learner',
    );
    let disabledSubjectId: string | undefined;
    try {
        disabledSubjectId = await subjectIdForEmail(page, disabledLearner.email);
        const token = await csrfToken(page);
        const disable = await page.request.patch(
            `/api/v1/admin/users/${disabledSubjectId}/access`,
            {
                data: {
                    banned_until: null,
                    login_disabled: true,
                    roles: ['learner'],
                },
                headers: { Origin: origin, 'X-CSRF-Token': token },
            },
        );
        expect(disable.status()).toBe(204);
        const disabledSession = await disabledLearner.page.request.get('/api/v1/session');
        expect(disabledSession.status()).toBe(200);
        await expect(disabledSession.json()).resolves.toEqual({
            authenticated: false,
            subject_id: null,
            two_factor_required: false,
        });
    } finally {
        if (disabledSubjectId) {
            const token = await csrfToken(page);
            const deletion = await page.request.delete(
                `/api/v1/admin/users/${disabledSubjectId}`,
                {
                    headers: { Origin: origin, 'X-CSRF-Token': token },
                },
            );
            expect(deletion.status()).toBe(204);
        }
        await disabledLearner.context.close();
    }
});
