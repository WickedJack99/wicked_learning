import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

async function expectBounded(locator: Locator, width: number): Promise<void> {
    const bounds = await locator.boundingBox();

    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
}

async function exerciseSourceGraphDialogs(page: Page): Promise<void> {
    await page
        .getByRole('button', { name: 'Delete First activity' })
        .dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Delete activity?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).dispatchEvent('click');

    await page
        .locator('[aria-label="Connection from First activity to End: completed"]')
        .dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Edit connection' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).dispatchEvent('click');

    await page
        .locator('[aria-label="Start route to First activity"]')
        .dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Route visuals' }),
    ).toBeVisible();
    await expect(page.getByLabel('Name')).toHaveAttribute(
        'placeholder',
        'First activity',
    );
    await page.getByRole('button', { name: 'Cancel' }).dispatchEvent('click');
}

test('renders the lifted source activity graph at the desktop contract viewport', async ({
    page,
}) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');

    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Add activity' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'First activity' }),
    ).toBeVisible();
    await expect(
        page.locator('[aria-label="Start route to First activity"]'),
    ).toBeVisible();
    await expect(
        page.locator(
            '[aria-label="Connection from First activity to End: completed"]',
        ),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        1440,
    );
});

test('keeps the source empty editor state bounded at the narrow contract viewport', async ({
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?empty=1');

    await expect(
        page.getByText('No activities yet', { exact: true }),
    ).toBeVisible();
    await expect(
        page.getByText('Add one, then connect Start to its input.', {
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        page.locator(
            '[aria-label="Start node. Connect this to a route activity."]',
        ),
    ).toBeVisible();
    await expect(
        page.locator(
            '[aria-label="End node. Connect completed activities here."]',
        ),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('keeps the populated source graph primary card usable at narrow width', async ({
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');

    await expect(page.locator('.react-flow__renderer')).toHaveCSS(
        'width',
        /[1-9]/,
    );
    await expect(
        page.getByRole('heading', { name: 'First activity' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('heading', { name: 'First activity' }),
        390,
    );
    await expectBounded(
        page.locator('[aria-label="Start route to First activity"]'),
        390,
    );
});

test('selects a source graph card before opening its keyboard delete action', async ({
    page,
}) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');

    await page
        .locator('[aria-label="open_practice: First activity"]')
        .dispatchEvent('click');
    await page.keyboard.press('Delete');
    await expect(
        page.getByRole('heading', { name: 'Delete activity?' }),
    ).toBeVisible();
});

test('opens the source activity-card, connection, and Start-route dialogs', async ({
    page,
}) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');

    await exerciseSourceGraphDialogs(page);
});

test('keeps source graph dialogs reachable at the narrow contract viewport', async ({
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');

    await exerciseSourceGraphDialogs(page);
});

test('opens the source Add activity form with its first type', async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');

    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');

    await expect(
        page.getByRole('heading', { name: 'Add activity' }),
    ).toBeVisible();
    await expect(
        page.getByText(
            'Create an activity in this MapAsset. Choose its type, then configure its content, visuals, sound and learning evidence.',
        ),
    ).toBeVisible();
    await expect(page.getByText('Core activity')).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'Type' })).toHaveText(
        'Open practice',
    );
});

test('keeps the source Add activity defaults reachable at the narrow viewport', async ({
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');

    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');

    await expect(
        page.getByRole('heading', { name: 'Add activity' }),
    ).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveValue('');
    await expectBounded(page.getByRole('combobox', { name: 'Type' }), 390);
});

test('switches the source Add activity form to Reflection', async ({ page }) => {
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');

    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Reflection' }).dispatchEvent('click');
    await expect(page.getByRole('combobox', { name: 'Type' })).toHaveText(
        'Reflection',
    );

    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Reflection prompt' }),
    ).toBeVisible();
    await expect(page.getByLabel('Question')).toHaveValue(
        'What feels clearer now?',
    );
});

test('keeps the source Reflection default reachable at the narrow viewport', async ({
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');

    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Reflection' }).dispatchEvent('click');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');

    await expect(
        page.getByRole('heading', { name: 'Reflection prompt' }),
    ).toBeVisible();
    await expect(page.getByLabel('Question')).toHaveValue(
        'What feels clearer now?',
    );
    await expectBounded(page.getByRole('tab', { name: 'Flow' }), 390);
});

for (const viewport of [
    { height: 900, name: 'desktop', width: 1440 },
    { height: 844, name: 'narrow', width: 390 },
]) {
    test(`keeps the source Review default reachable at the ${viewport.name} viewport`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        await page.goto('/activity-editor-harness.html');
        await page
            .getByRole('button', { name: 'Add activity' })
            .dispatchEvent('click');

        await page
            .getByRole('combobox', { name: 'Type' })
            .dispatchEvent('click');
        await page.getByRole('option', { name: 'Review' }).dispatchEvent('click');
        await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');

        await expect(
            page.getByRole('heading', { name: 'Review / revisit prompt' }),
        ).toBeVisible();
        await expect(page.getByLabel('Question')).toHaveValue(
            'What feels clearer now?',
        );
        await expectBounded(
            page.getByRole('tab', { name: 'Flow' }),
            viewport.width,
        );
    });
}

const remainingActivityTypes = [
    { label: 'Markdown', section: 'Markdown pages' },
    { label: 'Portal', section: 'Portal route' },
    { label: 'Question', section: 'Question and answers' },
    { label: 'Message prompt', section: 'Learner messages' },
    { label: 'Message wall', section: 'Learner messages' },
    { label: 'Shared task', section: 'Shared task' },
    { label: 'Item grant', section: 'Item grant behavior' },
    { label: 'Item obstacle', section: 'Item obstacle behavior' },
    { label: 'Obstacle', section: 'Obstacle behavior' },
    { label: 'Tool grant', section: 'Tool grant behavior' },
] as const;

for (const viewport of [
    { height: 900, name: 'desktop', width: 1440 },
    { height: 844, name: 'narrow', width: 390 },
]) {
    for (const activityType of remainingActivityTypes) {
        test(`renders source ${activityType.label} flow fields at the ${viewport.name} viewport`, async ({
            page,
        }) => {
            await page.setViewportSize(viewport);
            await page.goto('/activity-editor-harness.html');
            await page
                .getByRole('button', { name: 'Add activity' })
                .dispatchEvent('click');

            await page
                .getByRole('combobox', { name: 'Type' })
                .dispatchEvent('click');
            await page
                .getByRole('option', {
                    exact: true,
                    name: activityType.label,
                })
                .dispatchEvent('click');
            await page
                .getByRole('tab', { name: 'Flow' })
                .dispatchEvent('click');

            await expect(
                page.getByRole('heading', {
                    exact: true,
                    name: activityType.section,
                }),
            ).toBeVisible();
            await expectBounded(
                page.getByRole('tab', { name: 'Flow' }),
                viewport.width,
            );
        });
    }
}

test('surfaces a typed Rust Open-practice validation failure', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/open-practice-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 400 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByLabel('Title').fill('Practice safely');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await page
        .getByLabel('Learner invitation')
        .fill('Try the next step and notice what changes.');

    await page.locator('form').evaluate((form) => form.requestSubmit());

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual({
        introduction: null,
        next_step: 'Try the next step and notice what changes.',
        slug: null,
        title: 'Practice safely',
    });
});

test('reloads after a typed Rust Open-practice create succeeds', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/open-practice-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: { activity_id: '00000000-0000-4000-8000-000000000707' },
                status: 201,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByLabel('Title').fill('Practice safely');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await page
        .getByLabel('Learner invitation')
        .fill('Try the next step and notice what changes.');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.locator('form').evaluate((form) => form.requestSubmit());
    await reloaded;

    expect(commandBody).toEqual({
        introduction: null,
        next_step: 'Try the next step and notice what changes.',
        slug: null,
        title: 'Practice safely',
    });
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('surfaces a typed Rust stale Open-practice update without overwriting', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/open-practice',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 409 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
    await page.getByLabel('Title').fill('Practice safely (edited)');
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual({
        introduction: 'Start with this activity.',
        next_step: 'Choose a useful next step, then continue when you are ready.',
        slug: 'first-activity',
        title: 'Practice safely (edited)',
        updated_at: '2026-11-15T10:00:00Z',
    });
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
});

test('reloads after a typed Rust Open-practice update succeeds at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/open-practice',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    activity_id: '00000000-0000-4000-8000-000000000701',
                    updated_at: '2026-11-15T10:01:00Z',
                },
                status: 200,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('Practice safely (edited)');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');
    await reloaded;

    expect(commandBody).toEqual({
        introduction: 'Start with this activity.',
        next_step: 'Choose a useful next step, then continue when you are ready.',
        slug: 'first-activity',
        title: 'Practice safely (edited)',
        updated_at: '2026-11-15T10:00:00Z',
    });
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

async function openReflectionCreateForm(page: Page): Promise<void> {
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Reflection' }).dispatchEvent('click');
}

test('surfaces a typed Rust Reflection validation failure', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/reflection-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 400 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await openReflectionCreateForm(page);
    await page.getByLabel('Title').fill('Notice your progress');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await page
        .getByLabel('Question')
        .fill('What changed after the experiment?');

    await page.locator('form').evaluate((form) => form.requestSubmit());

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual({
        introduction: null,
        note: null,
        prompt: 'What changed after the experiment?',
        slug: null,
        subtopic: null,
        title: 'Notice your progress',
        topic: null,
    });
});

test('reloads after a typed Rust Reflection create succeeds', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/reflection-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: { activity_id: '00000000-0000-4000-8000-000000000708' },
                status: 201,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await openReflectionCreateForm(page);
    await page.getByLabel('Title').fill('Notice your progress');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await page
        .getByLabel('Question')
        .fill('What changed after the experiment?');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.locator('form').evaluate((form) => form.requestSubmit());
    await reloaded;

    expect(commandBody).toEqual({
        introduction: null,
        note: null,
        prompt: 'What changed after the experiment?',
        slug: null,
        subtopic: null,
        title: 'Notice your progress',
        topic: null,
    });
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('surfaces a typed Rust stale Reflection update without overwriting', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/reflection',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 409 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?reflection=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First reflection (edited)');
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual({
        introduction: 'Start with this activity.',
        note: 'Take a quiet moment.',
        prompt: 'How did that go?',
        slug: 'first-activity',
        subtopic: 'Experiments',
        title: 'First reflection (edited)',
        topic: 'Learning',
        updated_at: '2026-11-15T10:00:00Z',
    });
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
});

test('reloads after a typed Rust Reflection update succeeds at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/reflection',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    activity_id: '00000000-0000-4000-8000-000000000701',
                    updated_at: '2026-11-15T10:01:00Z',
                },
                status: 200,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?reflection=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First reflection (edited)');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');
    await reloaded;

    expect(commandBody).toEqual({
        introduction: 'Start with this activity.',
        note: 'Take a quiet moment.',
        prompt: 'How did that go?',
        slug: 'first-activity',
        subtopic: 'Experiments',
        title: 'First reflection (edited)',
        topic: 'Learning',
        updated_at: '2026-11-15T10:00:00Z',
    });
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

async function openReviewCreateForm(page: Page): Promise<void> {
    await page
        .getByRole('button', { name: 'Add activity' })
        .dispatchEvent('click');
    await page.getByRole('combobox', { name: 'Type' }).dispatchEvent('click');
    await page.getByRole('option', { name: 'Review' }).dispatchEvent('click');
}

test('surfaces a typed Rust Review validation failure', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/review-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 400 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html');
    await openReviewCreateForm(page);
    await page.getByLabel('Title').fill('Revisit your learning');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await page
        .getByLabel('Question')
        .fill('What will you carry into the next route?');

    await page.locator('form').evaluate((form) => form.requestSubmit());

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual({
        introduction: null,
        note: null,
        prompt: 'What will you carry into the next route?',
        slug: null,
        subtopic: null,
        title: 'Revisit your learning',
        topic: null,
    });
});

test('reloads after a typed Rust Review create succeeds', async ({ page }) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/nodes/00000000-0000-4000-8000-000000000703/review-activities',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: { activity_id: '00000000-0000-4000-8000-000000000709' },
                status: 201,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html');
    await openReviewCreateForm(page);
    await page.getByLabel('Title').fill('Revisit your learning');
    await page.getByRole('tab', { name: 'Flow' }).dispatchEvent('click');
    await page
        .getByLabel('Question')
        .fill('What will you carry into the next route?');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.locator('form').evaluate((form) => form.requestSubmit());
    await reloaded;

    expect(commandBody).toEqual({
        introduction: null,
        note: null,
        prompt: 'What will you carry into the next route?',
        slug: null,
        subtopic: null,
        title: 'Revisit your learning',
        topic: null,
    });
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});

test('surfaces a typed Rust stale Review update without overwriting', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/review',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({ status: 409 });
        },
    );
    await page.setViewportSize({ height: 900, width: 1440 });
    await page.goto('/activity-editor-harness.html?review=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First review (edited)');
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');

    await expect.poll(() => commandBody).not.toBeNull();
    await page.getByRole('tab', { name: 'Basics' }).dispatchEvent('click');
    await expect(
        page.getByText(
            'The activity could not be saved. Check the field values and try again.',
        ),
    ).toBeVisible();
    expect(commandBody).toEqual({
        introduction: 'Start with this activity.',
        note: 'Take a quiet moment.',
        prompt: 'How did that go?',
        slug: 'first-activity',
        subtopic: 'Experiments',
        title: 'First review (edited)',
        topic: 'Learning',
        updated_at: '2026-11-15T10:00:00Z',
    });
    await expect(
        page.getByRole('heading', { name: 'Edit activity' }),
    ).toBeVisible();
});

test('reloads after a typed Rust Review update succeeds at narrow width', async ({
    page,
}) => {
    let commandBody: unknown = null;

    await page.route('**/api/v1/security/csrf', async (route) => {
        await route.fulfill({ json: { token: 'test-csrf' } });
    });
    await page.route(
        '**/api/v1/admin/world-builder/activities/00000000-0000-4000-8000-000000000701/review',
        async (route) => {
            commandBody = route.request().postDataJSON();
            await route.fulfill({
                json: {
                    activity_id: '00000000-0000-4000-8000-000000000701',
                    updated_at: '2026-11-15T10:01:00Z',
                },
                status: 200,
            });
        },
    );
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto('/activity-editor-harness.html?review=1');
    await page.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
    await page.getByLabel('Title').fill('First review (edited)');

    const reloaded = page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame(),
    );
    await page.getByRole('button', { name: 'Save' }).dispatchEvent('click');
    await reloaded;

    expect(commandBody).toEqual({
        introduction: 'Start with this activity.',
        note: 'Take a quiet moment.',
        prompt: 'How did that go?',
        slug: 'first-activity',
        subtopic: 'Experiments',
        title: 'First review (edited)',
        topic: 'Learning',
        updated_at: '2026-11-15T10:00:00Z',
    });
    await expect(
        page.getByRole('heading', { name: 'Node activities' }),
    ).toBeVisible();
    await expectBounded(
        page.getByRole('button', { name: 'Add activity' }),
        390,
    );
});
