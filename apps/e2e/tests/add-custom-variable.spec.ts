import { expect, test } from '@playwright/test';
import {
  addCustomVariableButton,
  customVariableAccordionTrigger,
  customVariableAmountInput,
  customVariableForm,
  customVariableNameInput,
  gotoApp,
  openCustomVariablesAccordion,
} from './helpers/custom-variable';

test.describe('Add custom variable form', () => {
  test('stays visible even when Custom Variables accordion is collapsed', async ({ page }) => {
    await gotoApp(page);

    const trigger = customVariableAccordionTrigger(page);
    await expect(trigger).toBeVisible();

    await trigger.click();
    await expect(customVariableForm(page)).toBeVisible();
    await expect(customVariableNameInput(page)).toBeVisible();
    await expect(addCustomVariableButton(page)).toBeVisible();
  });

  test('validates required name and non-negative amount', async ({ page }) => {
    await gotoApp(page);

    await addCustomVariableButton(page).click();
    await expect(page.getByText('Variable name is required.')).toBeVisible();

    await customVariableNameInput(page).fill('Annual Bonus');
    await customVariableAmountInput(page).fill('-1');
    await addCustomVariableButton(page).click();

    await expect(page.getByText('Amount must be 0 or greater.')).toBeVisible();
  });

  test('adds a custom variable and renders it in the Custom Variables list', async ({ page }) => {
    await gotoApp(page);

    const customVariableName = 'E2E Variable 9f4a2';

    await customVariableNameInput(page).fill(customVariableName);
    await customVariableAmountInput(page).fill('7');
    await addCustomVariableButton(page).click();

    await openCustomVariablesAccordion(page);
    const customVariableLabel = page.locator('label', { hasText: customVariableName }).first();
    await expect(customVariableLabel).toBeVisible();

    const customVariableInputId = await customVariableLabel.getAttribute('for');
    expect(customVariableInputId).toBeTruthy();

    await expect(page.locator(`#${customVariableInputId}`)).toHaveValue('7');
  });

  test('updates an existing custom variable from inline edit mode', async ({ page }) => {
    await gotoApp(page);

    const originalName = 'E2E Editable Variable';
    const updatedName = 'E2E Edited Variable';

    await customVariableNameInput(page).fill(originalName);
    await customVariableAmountInput(page).fill('11');
    await addCustomVariableButton(page).click();

    await openCustomVariablesAccordion(page);

    const originalLabel = page.locator('label', { hasText: originalName }).first();
    await expect(originalLabel).toBeVisible();

    const row = page.locator('div.group').filter({ has: originalLabel }).first();
    await row.hover();
    await row.getByRole('button', { name: 'Edit' }).click({ force: true });

    await expect(page.getByRole('heading', { name: 'Edit custom variable' })).toBeVisible();
    await page.locator('#edit-custom-variable-name').fill(updatedName);
    await page.locator('#edit-custom-variable-amount').fill('22');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('heading', { name: 'Edit custom variable' })).toHaveCount(0);
    await openCustomVariablesAccordion(page);

    const editedRow = page.locator('div.group').filter({ has: page.getByText(updatedName) }).first();
    await expect(editedRow).toBeVisible();
    await expect(editedRow.locator('input[type="number"]').first()).toHaveValue('22');
  });
});
