import { test, expect } from '@playwright/test';

test.describe('Debugger component exploratory checks', () => {
  test('desktop interactions and state transitions', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('http://127.0.0.1:4173/');
    await page.waitForLoadState('networkidle');

    const dialog = page.getByRole('dialog', { name: 'Debugger' });
    await expect(dialog).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Step: 1/3' })).toBeVisible();

    const backward = page.getByRole('button', { name: 'Step backward' });
    const forward = page.getByRole('button', { name: 'Step forward' });

    await expect(backward).toBeDisabled();
    await expect(forward).toBeEnabled();

    await forward.click();
    await expect(page.getByRole('heading', { name: 'Step: 2/3' })).toBeVisible();

    await dialog.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('heading', { name: 'Step: 3/3' })).toBeVisible();

    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('heading', { name: 'Step: 2/3' })).toBeVisible();

    await page.getByRole('button', { name: 'Close debugger' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Open debugger' })).toBeVisible();

    await page.getByRole('button', { name: 'Open debugger' }).click();
    await expect(dialog).toBeVisible();

    expect(errors, `page errors: ${errors.join('\n')}`).toEqual([]);
  });

  test('mobile viewport panel fits inside screen and keeps controls visible', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 780 } });
    const page = await context.newPage();

    await page.goto('http://127.0.0.1:4173/');
    await page.waitForLoadState('networkidle');

    const dialog = page.getByRole('dialog', { name: 'Debugger' });
    await expect(dialog).toBeVisible();

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

    const forward = page.getByRole('button', { name: 'Step forward' });
    await expect(forward).toBeVisible();

    await context.close();
  });

  test('dragging does not throw and persists position after reopen', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/');
    await page.waitForLoadState('networkidle');

    const dialog = page.getByRole('dialog', { name: 'Debugger' });
    const dragHandle = page.getByRole('button', { name: 'Drag debugger panel' });

    await expect(dialog).toBeVisible();
    const before = await dialog.boundingBox();
    expect(before).not.toBeNull();
    if (!before) return;

    await dragHandle.hover();
    await page.mouse.down();
    await page.mouse.move(before.x + 40, before.y + 30);
    await page.mouse.up();

    const after = await dialog.boundingBox();
    expect(after).not.toBeNull();
    if (!after) return;

    // Some movement should occur on drag.
    expect(Math.round(after.x)).not.toBe(Math.round(before.x));

    await page.getByRole('button', { name: 'Close debugger' }).click();
    await page.getByRole('button', { name: 'Open debugger' }).click();

    const reopened = await dialog.boundingBox();
    expect(reopened).not.toBeNull();
    if (!reopened) return;

    // Position should persist after close/reopen in same session.
    expect(Math.round(reopened.x)).toBe(Math.round(after.x));
  });
});
