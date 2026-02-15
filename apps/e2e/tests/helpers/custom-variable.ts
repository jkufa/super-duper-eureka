import { expect, type Locator, type Page } from '@playwright/test';

export async function gotoApp(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

export function customVariableAccordionTrigger(page: Page): Locator {
  return page.getByRole('button', { name: 'Custom Variables' }).first();
}

export function customVariableForm(page: Page): Locator {
  return page.locator('h3:has-text("Add custom variable"):visible').first();
}

function activeCustomVariableSection(page: Page): Locator {
  return customVariableNameInput(page).locator('xpath=ancestor::section[1]').first();
}

export function customVariableNameInput(page: Page): Locator {
  return page
    .locator('[role="dialog"] #custom-variable-name:visible, #custom-variable-name:visible')
    .first();
}

export function customVariableAmountInput(page: Page): Locator {
  return page
    .locator('[role="dialog"] #custom-variable-amount:visible, #custom-variable-amount:visible')
    .first();
}

export function addCustomVariableButton(page: Page): Locator {
  return activeCustomVariableSection(page).getByRole('button', { name: 'Add new variable' });
}

export async function openCustomVariablesAccordion(page: Page) {
  const trigger = customVariableAccordionTrigger(page);
  await expect(trigger).toBeVisible();
  const state = await trigger.getAttribute('data-state');
  if (state !== 'open') {
    await trigger.click();
  }
}
