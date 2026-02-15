import { expect, test, type Page } from '@playwright/test';
import {
  addCustomVariableButton,
  customVariableAccordionTrigger,
  customVariableAmountInput,
  customVariableForm,
  customVariableNameInput,
  gotoApp,
  openCustomVariablesAccordion,
} from './helpers/custom-variable';

function customVariableSection(page: Page) {
  return customVariableNameInput(page).locator('xpath=ancestor::section[1]').first();
}

function customVariableGrowthSection(page: Page) {
  return customVariableSection(page);
}

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

    await addCustomVariableButton(page).click({ force: true });
    await expect(page.getByText('Variable name is required.')).toBeVisible();

    await customVariableNameInput(page).fill('Annual Bonus');
    await customVariableAmountInput(page).fill('-1');
    await addCustomVariableButton(page).click({ force: true });

    await expect(page.getByText('Amount must be 0 or greater.')).toBeVisible();
  });

  test('adds a custom variable and renders it in the Custom Variables list', async ({ page }) => {
    await gotoApp(page);

    const customVariableName = 'E2E Variable 9f4a2';

    await customVariableNameInput(page).fill(customVariableName);
    await customVariableAmountInput(page).fill('7');
    await addCustomVariableButton(page).click({ force: true });

    await openCustomVariablesAccordion(page);
    const customVariableLabel = page.locator('label', { hasText: customVariableName }).first();
    await expect(customVariableLabel).toBeVisible();

    const customVariableInputId = await customVariableLabel.getAttribute('for');
    expect(customVariableInputId).toBeTruthy();
    if (!customVariableInputId) {
      throw new Error('Expected custom variable input id.');
    }

    await expect(page.locator(`#${customVariableInputId}`)).toHaveValue('7');
  });

  test('updates an existing custom variable from inline edit mode', async ({ page }) => {
    await gotoApp(page);

    const originalName = 'E2E Editable Variable';
    const updatedName = 'E2E Edited Variable';

    await customVariableNameInput(page).fill(originalName);
    await customVariableAmountInput(page).fill('11');
    await addCustomVariableButton(page).click({ force: true });

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

  test('shows optional growth controls', async ({ page }) => {
    await gotoApp(page);

    await customVariableSection(page).getByRole('button', { name: 'Growth (optional)' }).click();
    await expect(customVariableSection(page).getByText('Growth (optional)').first()).toBeVisible();
    await expect(customVariableSection(page).locator('input[name="customVariableDraft.growthAmount"]:visible')).toBeVisible();
    await expect(customVariableGrowthSection(page).getByRole('radio', { name: 'Amount $' }).last()).toBeVisible();
    await expect(customVariableGrowthSection(page).getByRole('radio', { name: 'Annually' })).toBeVisible();
  });

  test('keeps Raise by icon and input padding aligned when switching growth type', async ({ page }) => {
    await gotoApp(page);

    await customVariableSection(page).getByRole('button', { name: 'Growth (optional)' }).click();
    const growthAmountInput = page.locator('input[name="customVariableDraft.growthAmount"]:visible').first();
    await expect(growthAmountInput).toBeVisible();

    const growthInputWrapper = growthAmountInput.locator('xpath=ancestor::div[contains(@class,"relative")]').first();
    await expect(growthInputWrapper.locator('span.right-3')).toHaveText('%');

    await customVariableSection(page).getByRole('radio', { name: 'Amount $' }).last().click({ force: true });
    await growthAmountInput.fill('123');

    await expect(growthInputWrapper.locator('span.left-3')).toHaveText('$');
    await expect(growthInputWrapper.locator('span.right-3')).toHaveCount(0);
    await expect(growthAmountInput).toHaveClass(/pl-7/);

    await expect(growthAmountInput).toHaveCSS('padding-left', /([2-9]\d|[1-9]\d{2,})px/);
  });

  test('does not clear selected type when clicking the active option', async ({ page }) => {
    test.skip(
      test.info().project.name.includes('mobile'),
      'Custom variable type toggles are out of viewport in mobile layout.',
    );

    await gotoApp(page);

    const editor = customVariableSection(page);
    const amountType = editor.getByRole('radio', { name: 'Amount $' }).first();
    const percentType = editor.getByRole('radio', { name: 'Percent %' }).first();
    await editor.scrollIntoViewIfNeeded();

    await expect(amountType).toHaveAttribute('aria-checked', 'true');
    await expect(percentType).toHaveAttribute('aria-checked', 'false');

    await amountType.click();

    await expect(amountType).toHaveAttribute('aria-checked', 'true');
    await expect(percentType).toHaveAttribute('aria-checked', 'false');
  });
});
