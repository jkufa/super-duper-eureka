import { expect, test } from '@playwright/test';

import { debuggerPanel, gotoApp, stepControls } from './helpers/debugger';

test.describe('Debugger panel', () => {
  test('supports stepping controls and keyboard navigation', async ({ page }) => {
    await gotoApp(page);

    const controls = stepControls(page);
    const stepStatus = page.getByRole('button', { name: /^Step:\s+\d+\/\d+$/ });

    await expect(controls.prev).toBeDisabled();
    await expect(controls.first).toBeDisabled();
    await expect(stepStatus).toBeVisible();

    await controls.next.click();
    await expect(controls.prev).toBeEnabled();
    await expect(stepStatus).toBeVisible();

    await controls.last.click();
    await expect(controls.next).toBeDisabled();
    await expect(controls.last).toBeDisabled();
    await expect(stepStatus).toBeVisible();

    await controls.input.fill('1');
    await controls.input.press('Enter');
    await expect(controls.prev).toBeDisabled();
    await expect(controls.first).toBeDisabled();
    await expect(stepStatus).toBeVisible();

    await debuggerPanel(page).focus();
    await page.keyboard.press('Meta+ArrowRight');
    await expect(controls.next).toBeDisabled();
    await expect(controls.last).toBeDisabled();
    await expect(stepStatus).toBeVisible();

    await page.keyboard.press('Meta+ArrowLeft');
    await expect(controls.prev).toBeDisabled();
    await expect(controls.first).toBeDisabled();
    await expect(stepStatus).toBeVisible();
  });

  test('supports drag and persists position after close/reopen', async ({ page }) => {
    await gotoApp(page);

    const dialog = debuggerPanel(page);
    const dragHandle = page.getByRole('button', { name: 'Drag debugger panel' });

    const before = await dialog.boundingBox();
    expect(before).not.toBeNull();
    if (!before) return;

    const handleBox = await dragHandle.boundingBox();
    expect(handleBox).not.toBeNull();
    if (!handleBox) return;

    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    const deltaX = 72;
    const deltaY = 48;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY);
    await page.mouse.up();

    const after = await dialog.boundingBox();
    expect(after).not.toBeNull();
    if (!after) return;

    expect(Math.round(after.x) !== Math.round(before.x) || Math.round(after.y) !== Math.round(before.y))
      .toBeTruthy();

    await page.getByRole('button', { name: 'Close debugger' }).click({ force: true });
    await expect(dialog).not.toBeVisible();

    await page.getByRole('button', { name: 'Open debugger' }).click({ force: true });
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(260);

    const reopened = await dialog.boundingBox();
    expect(reopened).not.toBeNull();
    if (!reopened) return;

    expect(Math.round(reopened.x)).toBe(Math.round(after.x));
    expect(Math.round(reopened.y)).toBe(Math.round(after.y));
  });

  test('keeps panel inside mobile viewport', async ({ page }) => {
    await gotoApp(page);

    const dialog = debuggerPanel(page);
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (!viewport) return;

    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  });
});
