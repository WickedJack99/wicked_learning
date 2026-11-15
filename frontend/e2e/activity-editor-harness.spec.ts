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
