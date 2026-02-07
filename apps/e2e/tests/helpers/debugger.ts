import { expect, type Locator, type Page } from '@playwright/test';

export function debuggerPanel(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Debugger' });
}

export async function gotoApp(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(debuggerPanel(page)).toBeVisible();
}

export function stepControls(page: Page) {
  return {
    first: page.getByRole('button', { name: 'Jump to first step' }),
    prev: page.getByRole('button', { name: 'Step backward' }),
    input: page.getByRole('textbox', { name: 'Enter step number' }),
    next: page.getByRole('button', { name: 'Step forward' }),
    last: page.getByRole('button', { name: 'Jump to last step' }),
  };
}
