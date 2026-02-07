import { expect, test } from '@playwright/test';

test.describe('Retirement config form behavior', () => {
  test('repopulates numeric input on blur after being cleared', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const currentBalanceInput = page.locator('input[name="currentBalance"]');

    await expect(currentBalanceInput).not.toHaveValue('');

    await currentBalanceInput.focus();
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await expect(currentBalanceInput).toHaveValue('');

    await currentBalanceInput.fill('0');
    await expect(currentBalanceInput).toHaveValue('0');

    await currentBalanceInput.focus();
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await expect(currentBalanceInput).toHaveValue('');

    await currentBalanceInput.blur();
    await expect(currentBalanceInput).toHaveValue('0');
  });

  test('updates chart output on blur, not on input change', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const yearsToRetirementInput = page.locator('input[name="yearsToRetirement"]');
    const tableRows = page.locator('[data-slot="table-body"] [data-slot="table-row"]');
    const initialRowCount = await tableRows.count();
    expect(initialRowCount).toBeGreaterThan(1);

    await yearsToRetirementInput.focus();
    await yearsToRetirementInput.fill('1');
    await expect(tableRows).toHaveCount(initialRowCount);

    await yearsToRetirementInput.blur();
    await expect(yearsToRetirementInput).toHaveValue('1');

    await expect(tableRows).toHaveCount(1);
  });
});
