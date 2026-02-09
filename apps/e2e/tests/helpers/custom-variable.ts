import { expect, type Locator, type Page } from '@playwright/test';

export async function gotoApp(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

export function customVariableAccordionTrigger(page: Page): Locator {
  return page.getByRole('button', { name: 'Custom Variables' }).first();
}

export function customVariableForm(page: Page): Locator {
  return page.getByRole('heading', { name: 'Add custom variable' }).first();
}

export function customVariableNameInput(page: Page): Locator {
  return page.locator('#custom-variable-name').first();
}

export function customVariableAmountInput(page: Page): Locator {
  return page.locator('#custom-variable-amount').first();
}

export function addCustomVariableButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Add new variable' }).first();
}

export async function openCustomVariablesAccordion(page: Page) {
  const trigger = customVariableAccordionTrigger(page);
  await expect(trigger).toBeVisible();
  const state = await trigger.getAttribute('data-state');
  if (state !== 'open') {
    await trigger.click();
  }
}
