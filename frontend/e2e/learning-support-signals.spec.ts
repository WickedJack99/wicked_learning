import { expect, test } from './authenticated';

test('a local support worker can discover the source-shaped support signal sections', async ({ page }) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');
    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);
    const signalsResponsePromise = page.waitForResponse(
        (response) =>
            response.url().includes('/api/v1/admin/learning-support/signals') &&
            response.status() === 200,
    );
    await page.goto('/settings?panel=admin-learning-support&support=support-signals');
    const signalsResponse = await signalsResponsePromise;
    expect(signalsResponse.status()).toBe(200);
    const signals = await signalsResponse.json();
    expect(signals).toMatchObject({
        peer_support: expect.any(Array),
        summary: {
            learners: expect.any(Number),
            learners_with_signals: expect.any(Number),
            topics_with_monthly_activity: expect.any(Number),
        },
    });
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    const learningSupportNavigation = page.getByRole('tablist', {
        name: 'Learning support sections',
    });
    await expect(
        learningSupportNavigation.getByRole('tab', {
            name: 'Learner Messages',
        }),
    ).toBeVisible();
    await expect(
        learningSupportNavigation.getByRole('tab', {
            name: 'Support Signals',
        }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Collective Overview' }),
    ).toBeVisible();
    await expect(
        page.getByRole('img', {
            name: 'Anonymous active learners during the last 30 days',
        }),
    ).toBeVisible();

    await learningSupportNavigation
        .getByRole('tab', { name: 'Learner Messages' })
        .click();
    await expect(page).toHaveURL(/support=learner-messages/);
    await expect(
        page.getByRole('tablist', { name: 'Learning support sections' }),
    ).toBeVisible();
    await expect(
        page.getByRole('tablist', { name: 'Message topics' }),
    ).toBeVisible();

    await page.goto(
        '/settings?panel=admin-learning-support&support=platform-feedback',
    );
    const platformFeedbackNavigation = page.getByRole('tablist', {
        name: 'Learning support sections',
    });
    await expect(
        platformFeedbackNavigation.getByRole('tab', {
            name: 'Platform Feedback',
        }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
        page.getByRole('heading', { name: 'Shared feedback' }),
    ).toBeVisible();

    await page.goto(
        '/settings?panel=admin-learning-support&support=feedback-requests',
    );
    await expect(
        page.getByRole('tablist', { name: 'Learning support sections' }),
    ).toBeVisible();
    await expect(
        page
            .getByRole('tablist', { name: 'Learning support sections' })
            .getByRole('tab', { name: /^Feedback/ }),
    ).toHaveAttribute('aria-selected', 'true');

    await page.goto('/settings?panel=admin-learning-support&support=journal');
    await expect(
        page
            .getByRole('tablist', { name: 'Learning support sections' })
            .getByRole('tab', { name: /^Journal\b/ }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible();

    await page.goto(
        '/settings?panel=admin-learning-support&support=platform-feedback',
    );
    await expect(
        page.getByRole('heading', { name: 'Shared feedback' }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    const platformFeedbackHeadingBounds = await page
        .getByRole('heading', { name: 'Shared feedback' })
        .boundingBox();
    expect(platformFeedbackHeadingBounds).not.toBeNull();
    expect(platformFeedbackHeadingBounds!.x).toBeGreaterThanOrEqual(0);
    expect(
        platformFeedbackHeadingBounds!.x + platformFeedbackHeadingBounds!.width,
    ).toBeLessThanOrEqual(390);
    expect(platformFeedbackHeadingBounds!.y).toBeGreaterThanOrEqual(0);
    expect(
        platformFeedbackHeadingBounds!.y + platformFeedbackHeadingBounds!.height,
    ).toBeLessThanOrEqual(844);

    await page.setViewportSize({ width: 1280, height: 844 });

    await page.goto(
        '/settings?panel=admin-learning-support&support=support-signals',
    );
    await expect(
        page.getByRole('heading', { name: 'Collective Overview' }),
    ).toBeVisible();

    await page.getByRole('tab', { name: 'Individual Support' }).click();
    await expect(
        page.getByRole('heading', { name: 'Individual Support' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/signals=individual/);

    await page.getByRole('tab', { name: 'Peer Support' }).click();
    await expect(
        page.getByRole('heading', { name: 'Peer Support', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', {
            name: 'Shared-task exchanges to revisit',
        }),
    ).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByLabel('Settings area')).toBeVisible();
    const learningSupportSelect = page.getByLabel(
        'Learning support section',
        { exact: true },
    );
    await expect(learningSupportSelect).toBeVisible();
    const learningSupportSelectBounds =
        await learningSupportSelect.boundingBox();
    expect(learningSupportSelectBounds).not.toBeNull();
    expect(learningSupportSelectBounds!.x).toBeGreaterThanOrEqual(0);
    expect(learningSupportSelectBounds!.y).toBeGreaterThanOrEqual(0);
    expect(
        learningSupportSelectBounds!.x + learningSupportSelectBounds!.width,
    ).toBeLessThanOrEqual(390);
    expect(
        learningSupportSelectBounds!.y + learningSupportSelectBounds!.height,
    ).toBeLessThanOrEqual(844);
    const peerSupportTab = page.getByRole('tab', { name: 'Peer Support' });
    await expect(peerSupportTab).toBeVisible();
    const peerSupportTabBounds = await peerSupportTab.boundingBox();
    expect(peerSupportTabBounds).not.toBeNull();
    expect(peerSupportTabBounds!.x).toBeGreaterThanOrEqual(0);
    expect(peerSupportTabBounds!.y).toBeGreaterThanOrEqual(0);
    expect(peerSupportTabBounds!.x + peerSupportTabBounds!.width).toBeLessThanOrEqual(390);
    expect(peerSupportTabBounds!.y + peerSupportTabBounds!.height).toBeLessThanOrEqual(844);
});
