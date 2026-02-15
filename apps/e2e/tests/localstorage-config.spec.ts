import { expect, test } from '@playwright/test';

const CONFIG_STORAGE_KEY = 'retirement_webapp_retirement_config';

test.describe('Retirement config localStorage sync', () => {
  test('stores updated config and reapplies it after refresh', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const yearsToRetirementInput = page.locator('input[name="yearsToRetirement"]').first();

    const initialStored = await page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    }, CONFIG_STORAGE_KEY);

    expect(initialStored).not.toBeNull();
    const initialYears = Number(initialStored?.timeHorizonYears ?? 0);
    const nextYears = Math.max(1, Math.min(80, initialYears === 1 ? 2 : initialYears - 1));

    await yearsToRetirementInput.fill(`${nextYears}`);
    await yearsToRetirementInput.blur();

    await expect.poll(async () => {
      return await page.evaluate(
        (storageKey) => {
          const raw = window.localStorage.getItem(storageKey);
          if (!raw) return null;
          return JSON.parse(raw).timeHorizonYears ?? null;
        },
        CONFIG_STORAGE_KEY,
      );
    }).toBe(nextYears);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[name="yearsToRetirement"]').first()).toHaveValue(`${nextYears}`);
  });
});
