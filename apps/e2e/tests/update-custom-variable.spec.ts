import { expect, test, type Page } from '@playwright/test';
import {
  addCustomVariableButton,
  customVariableAmountInput,
  customVariableNameInput,
  gotoApp,
  openCustomVariablesAccordion
} from './helpers/custom-variable';

function variableRow(page: Page, name: string) {
  const label = page.locator('label', { hasText: name }).first();
  return page.locator('div.group').filter({ has: label }).first();
}

async function openEditForVariable(page: Page, name: string) {
  const row = variableRow(page, name);
  await expect(row).toBeVisible();
  await row.hover();
  await row.getByRole('button', { name: 'Edit' }).click({ force: true });
  await expect(page.getByRole('heading', { name: 'Edit custom variable' })).toBeVisible();
}

function editForm(page: Page) {
  return page.locator('#edit-custom-variable-name').locator('xpath=ancestor::section[1]');
}

async function fillIfPresent(scope: ReturnType<typeof editForm>, selector: string, value: string) {
  const field = scope.locator(selector);
  if (await field.count()) {
    await field.fill(value);
    return true;
  }
  return false;
}

test.describe('Update custom variable form', () => {
  test('persists updates for type, timing, and year range', async ({ page }) => {
    await gotoApp(page);

    const originalName = 'E2E Update Source';
    const updatedName = 'E2E Update Persisted';

    await customVariableNameInput(page).fill(originalName);
    await customVariableAmountInput(page).fill('12');
    await addCustomVariableButton(page).click();

    await openCustomVariablesAccordion(page);
    await openEditForVariable(page, originalName);

    const editor = editForm(page);

    await editor.locator('#edit-custom-variable-name').fill(updatedName);
    await editor.getByRole('radio', { name: 'Percent %' }).click();
    await editor.locator('#edit-custom-variable-amount').fill('19');
    await editor.locator('#edit-custom-variable-timing-natural').fill('every feb 13');
    await editor.locator('#edit-custom-variable-timing-natural').blur();
    const hasYearStart = await fillIfPresent(editor, '#edit-custom-variable-year-start', '3');
    const hasYearEnd = await fillIfPresent(editor, '#edit-custom-variable-year-end', '11');
    await editor.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('heading', { name: 'Edit custom variable' })).toHaveCount(0);
    await openCustomVariablesAccordion(page);

    const updatedLabel = page.locator('label', { hasText: updatedName }).first();
    await expect(updatedLabel).toBeVisible();

    const updatedInputId = await updatedLabel.getAttribute('for');
    expect(updatedInputId).toBeTruthy();
    await expect(page.locator(`#${updatedInputId}`)).toHaveValue('19');

    await openEditForVariable(page, updatedName);
    const reopenedEditor = editForm(page);
    await expect(reopenedEditor.locator('#edit-custom-variable-name')).toHaveValue(updatedName);
    await expect(reopenedEditor.locator('#edit-custom-variable-amount')).toHaveValue('19');
    await expect(reopenedEditor.getByRole('radio', { name: 'Percent %' })).toHaveAttribute('aria-checked', 'true');
    await expect(reopenedEditor.locator('#edit-custom-variable-timing-natural')).toHaveValue('every feb 13');
    if (hasYearStart) {
      await expect(reopenedEditor.locator('#edit-custom-variable-year-start')).toHaveValue('3');
    }
    if (hasYearEnd) {
      await expect(reopenedEditor.locator('#edit-custom-variable-year-end')).toHaveValue('11');
    }
  });

  test('cancel keeps previous values unchanged', async ({ page }) => {
    await gotoApp(page);

    const variableName = 'E2E Cancel Variable';

    await customVariableNameInput(page).fill(variableName);
    await customVariableAmountInput(page).fill('8');
    await addCustomVariableButton(page).click();

    await openCustomVariablesAccordion(page);
    await openEditForVariable(page, variableName);

    const editor = editForm(page);
    await editor.locator('#edit-custom-variable-name').fill('Should Not Save');
    await editor.locator('#edit-custom-variable-amount').fill('99');
    await editor.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('heading', { name: 'Edit custom variable' })).toHaveCount(0);
    await openCustomVariablesAccordion(page);

    const label = page.locator('label', { hasText: variableName }).first();
    await expect(label).toBeVisible();

    const inputId = await label.getAttribute('for');
    expect(inputId).toBeTruthy();
    await expect(page.locator(`#${inputId}`)).toHaveValue('8');
    await expect(page.locator('label', { hasText: 'Should Not Save' })).toHaveCount(0);
  });
});
