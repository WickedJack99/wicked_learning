import { expect, test } from './authenticated';

test('a local administrator can open lifted workspaces at the current Laravel Settings paths', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    await page.goto('/settings?panel=admin-world-builder');
    const settingsNavigation = page.getByRole('navigation', {
        name: 'Settings navigation',
    });
    await expect(
        settingsNavigation.getByRole('button', { name: 'World Builder' }),
    ).toBeVisible();
    const worldBuilderSections = page.getByRole('tablist', {
        name: 'World builder sections',
    });
    await worldBuilderSections
        .getByRole('tab', { name: 'Review queue' })
        .click();
    await expect(page).toHaveURL(
        /\/settings\?panel=admin-world-builder&worldSection=review$/,
    );
    await expect(
        page.getByRole('heading', { name: 'Review queue' }),
    ).toBeVisible();
    await worldBuilderSections.getByRole('tab', { name: 'Graph' }).click();
    await expect(page).toHaveURL(
        /\/settings\?panel=admin-world-builder&worldSection=graph$/,
    );
    await worldBuilderSections.getByRole('tab', { name: 'Structural' }).click();
    await expect(page).toHaveURL(
        /\/settings\?panel=admin-world-builder&worldSection=structural$/,
    );
    await expect(page.getByText('World maps', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Configure map' }).click();
    await expect(page).toHaveURL(
        /\/settings\?panel=admin-world-builder&worldSection=structural&map=[0-9a-f-]+&worldView=configure$/,
    );
    await expect(
        page.getByRole('button', { name: 'Edit map details' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Duplicate map' }).click();
    await expect(
        page.getByRole('heading', { name: 'Duplicate authored map' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.goto('/settings?panel=admin-world-builder&worldSection=graph');
    const quickNavigation = page.getByRole('navigation', {
        name: 'Settings quick navigation',
    });
    await expect(
        quickNavigation.getByRole('link', { name: 'Bookmarks' }),
    ).toBeVisible();
    await quickNavigation.getByRole('link', { name: 'Bookmarks' }).click();
    await expect(page).toHaveURL(/\/bookmarks$/);

    await page.goto('/settings?panel=admin-world-builder');
    await page.getByLabel('Search settings').fill('API');
    await expect(
        settingsNavigation.getByRole('button', { name: 'API' }),
    ).toBeVisible();
    await expect(
        settingsNavigation.getByRole('button', { name: 'World Builder' }),
    ).toBeHidden();
    await page.getByLabel('Search settings').fill('Guardrails');
    await expect(
        settingsNavigation.getByRole('button', { name: 'AI' }),
    ).toBeVisible();
    await expect(
        settingsNavigation.getByRole('button', { name: 'World Builder' }),
    ).toBeHidden();
    await page.getByLabel('Search settings').fill('');
    await settingsNavigation
        .getByRole('button', { name: 'Assets & World Objects' })
        .click();
    await expect(page).toHaveURL(
        /\/settings\?panel=admin-assets-world-objects$/,
    );
    await expect(
        page.getByRole('heading', { name: 'Visual library' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-assets-world-objects&asset=items');
    await expect(page.getByRole('heading', { name: 'Edit items' })).toBeVisible();

    await page.goto('/settings?panel=admin-assets-world-objects&asset=tools');
    await expect(page.getByRole('heading', { name: 'Edit tools' })).toBeVisible();

    await page.goto('/settings?panel=admin-assets-world-objects&asset=visuals');
    await expect(
        page.getByRole('heading', { name: 'Visual library' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-assets-world-objects&asset=sounds');
    await expect(
        page.getByRole('heading', { name: 'Reusable sound library' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-assets-world-objects&asset=cursors');
    await expect(
        page.getByRole('heading', { name: 'Cursor images' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-public-pages');
    await expect(
        page.getByRole('heading', { name: 'Public presentation' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-color-palettes');
    await expect(
        page.getByRole('heading', { name: 'Color palette' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-translations');
    await expect(
        page.getByRole('heading', { name: 'Language administration' }),
    ).toBeVisible();

    await page.goto('/settings?personal=appearance&support=learning-concepts');
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();

    await page.goto('/settings?panel=appearance');
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();

    await page.goto('/settings?panel=admin-presentation');
    await expect(
        page.getByRole('heading', { name: 'Public presentation' }),
    ).toBeVisible();

    await page.goto('/settings?panel=admin-users');
    await expect(
        page.getByRole('heading', { level: 1, name: 'Users' }),
    ).toBeVisible();

    await page.goto('/settings?panel=information');
    await expect(
        page.getByRole('heading', { level: 1, name: 'About & legal' }),
    ).toBeVisible();
    await expect(
        page.getByText(
            'No settings are available here with the current permissions.',
        ),
    ).toBeVisible();

    await page.goto('/settings/profile');
    await expect(page).toHaveURL(/\/settings\?panel=personal&personal=profile$/);
    await expect(
        page.getByRole('heading', { level: 1, name: 'Profile' }),
    ).toBeVisible();

    await page.goto('/settings/language');
    await expect(page).toHaveURL(/\/settings\?panel=personal&personal=language$/);
    await expect(
        page.getByRole('heading', { level: 1, name: 'Language' }),
    ).toBeVisible();

    await page.goto('/settings/appearance');
    await expect(page).toHaveURL(/\/settings\?panel=personal&personal=appearance$/);
    await expect(
        page.getByRole('heading', { level: 1, name: 'Appearance' }),
    ).toBeVisible();

    await page.goto('/settings/color-palette');
    await expect(page).toHaveURL(
        /\/settings\?panel=admin-presentation-localization&presentation=palette$/,
    );
    await expect(
        page.getByRole('heading', { name: 'Color palette' }),
    ).toBeVisible();

    const confirmationStatus = page.waitForResponse(
        (response) =>
            response.url().endsWith('/api/v1/account/password/confirmation') &&
            response.request().method() === 'GET',
    );
    await page.goto('/settings/security');
    const confirmation = await confirmationStatus;
    expect(confirmation.status()).toBe(200);
    const { confirmed } = (await confirmation.json()) as { confirmed: boolean };
    if (!confirmed) {
        await expect(page).toHaveURL(
            /\/confirm-password\?next=%2Fsettings%2Fsecurity$/,
        );
        await page.getByLabel('Password').fill(password!);
        await page.getByRole('button', { name: 'Confirm password' }).click();
    }
    await expect(page).toHaveURL(/\/settings\/security$/);
    await expect(
        page.getByRole('heading', { level: 1, name: 'Security' }),
    ).toBeVisible();

    const legacyRedirects = [
        ['/settings/admin-panel', '/settings?panel=admin-learning-support&support=admin-panel'],
        ['/settings/assets', '/settings?panel=admin-assets-world-objects&asset=visuals'],
        ['/settings/assets/media', '/settings?panel=admin-assets-world-objects&asset=visuals'],
        ['/settings/assets/items', '/settings?panel=admin-assets-world-objects&asset=items'],
        ['/settings/assets/tools', '/settings?panel=admin-assets-world-objects&asset=tools'],
        ['/settings/assets/sounds', '/settings?panel=admin-assets-world-objects&asset=sounds'],
        ['/settings/presentation', '/settings?panel=admin-presentation-localization&presentation=public'],
        ['/settings/languages', '/settings?panel=admin-presentation-localization&presentation=languages'],
        ['/settings/journal', '/settings?panel=admin-learning-support&support=journal'],
        ['/settings/ai', '/settings?panel=admin-ai-integrations'],
        ['/settings/groups', '/settings?panel=admin-access&access=groups'],
    ];
    for (const [sourcePath, destination] of legacyRedirects) {
        await page.goto(sourcePath);
        await expect(page).toHaveURL(destination);
    }

    const graphResponse = await page.request.get('/api/v1/admin/world-builder');
    expect(graphResponse.ok()).toBeTruthy();
    const graph = (await graphResponse.json()) as {
        maps: Array<{ id: string }>;
    };
    const editableMapId = graph.maps[0]?.id;
    expect(editableMapId).toBeTruthy();

    await page.goto('/settings/worlds');
    await expect(page).toHaveURL('/settings?panel=admin-world-builder');

    await page.goto(`/settings/worlds/maps/${editableMapId}/edit`);
    await expect(page).toHaveURL(
        `/settings?panel=admin-world-builder&map=${editableMapId}&worldView=nodes`,
    );

    await page.goto(`/settings/worlds/maps/${editableMapId}/configure`);
    await expect(page).toHaveURL(
        `/settings?panel=admin-world-builder&map=${editableMapId}&worldView=configure`,
    );
});

test('World Builder retains source section visibility for a no-access Settings projection', async ({
    page,
}) => {
    const email = process.env.E2E_LOGIN_EMAIL;
    const password = process.env.E2E_LOGIN_PASSWORD;
    test.skip(!email || !password, 'requires the disposable local administrator');

    await page.goto('/login');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/world$/);

    const currentUserResponse = await page.request.get('/api/v1/me');
    expect(currentUserResponse.ok()).toBeTruthy();
    const currentUser = (await currentUserResponse.json()) as {
        settings_access: Record<string, boolean>;
    };
    const noAccess = Object.fromEntries(
        Object.keys(currentUser.settings_access).map((resource) => [
            resource,
            false,
        ]),
    );
    await page.route('**/api/v1/me', async (route) => {
        await route.fulfill({
            body: JSON.stringify({
                ...currentUser,
                settings_access: noAccess,
            }),
            contentType: 'application/json',
        });
    });

    await page.goto('/settings?panel=admin-world-builder&worldSection=review');
    await expect(
        page.getByText(
            'World builder settings are not available with the current permissions.',
        ),
    ).toBeVisible();
    await expect(
        page.getByRole('tablist', { name: 'World builder sections' }),
    ).toBeHidden();
    await expect(
        page.getByRole('heading', { name: 'Review queue' }),
    ).toBeHidden();
});
