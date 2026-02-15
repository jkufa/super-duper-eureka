import { test } from '@playwright/test';

test('records a human-paced demo flow for form + debugger', async ({ page }) => {
  const pause = async (ms: number) => page.waitForTimeout(ms);

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await pause(1200);

  const currentBalance = page.locator('input[name="currentBalance"]').first();
  await currentBalance.click();
  await page.keyboard.press('Meta+A');
  await page.keyboard.type('75000', { delay: 120 });
  await pause(700);
  await currentBalance.blur();
  await pause(1000);

  const yearsToRetirement = page.locator('input[name="yearsToRetirement"]').first();
  await yearsToRetirement.click();
  await page.keyboard.press('Meta+A');
  await page.keyboard.type('20', { delay: 160 });
  await pause(700);
  await yearsToRetirement.blur();
  await pause(1200);

  const projectionTable = page.locator('table').first();
  await projectionTable.scrollIntoViewIfNeeded();
  await pause(900);
  await page.mouse.wheel(0, 900);
  await pause(900);
  await page.mouse.wheel(0, 900);
  await pause(900);
  await page.mouse.wheel(0, -1200);
  await pause(1000);

  await page.getByRole('button', { name: 'Open debugger' }).click({ force: true });
  await pause(900);

  const nextStep = page.getByRole('button', { name: 'Step forward' });
  await nextStep.click();
  await pause(700);
  await nextStep.click();
  await pause(700);

  await page.getByRole('button', { name: 'Jump to last step' }).click();
  await pause(900);
  await page.getByRole('button', { name: 'Jump to first step' }).click();
  await pause(900);

  const dragHandle = page.getByRole('button', { name: 'Drag debugger panel' });
  const handleBox = await dragHandle.boundingBox();
  if (handleBox) {
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 160, startY + 80, { steps: 24 });
    await page.mouse.up();
    await pause(900);
  }

  await page.getByRole('button', { name: 'Close debugger' }).click({ force: true });
  await pause(700);
  await page.getByRole('button', { name: 'Open debugger' }).click({ force: true });
  await pause(1400);
});
