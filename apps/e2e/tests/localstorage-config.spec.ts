import { expect, test } from '@playwright/test';

const CONFIG_STORAGE_KEY = 'retirement_webapp_retirement_config';

test.describe('Retirement config localStorage sync', () => {
  test('stores updated config and reapplies it after refresh', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const yearsToRetirementInput = page.locator('input[name="yearsToRetirement"]').first();

    const initialStoredYears = await page.evaluate<number | null, string>((storageKey) => {
      const hasTimeHorizonYears = (value: unknown): value is { timeHorizonYears: number } => {
        return (
          typeof value === 'object'
          && value !== null
          && 'timeHorizonYears' in value
          && typeof value.timeHorizonYears === 'number'
        );
      };

      const browserGlobal = globalThis as unknown as { localStorage: { getItem: (key: string) => string | null } };
      const raw = browserGlobal.localStorage.getItem(storageKey);
      if (!raw) return null;

      const parsed: unknown = JSON.parse(raw);
      return hasTimeHorizonYears(parsed) ? parsed.timeHorizonYears : null;
    }, CONFIG_STORAGE_KEY);

    expect(initialStoredYears).not.toBeNull();
    const initialYears = initialStoredYears ?? 0;
    const nextYears = Math.max(1, Math.min(80, initialYears === 1 ? 2 : initialYears - 1));

    await yearsToRetirementInput.fill(String(nextYears));
    await yearsToRetirementInput.blur();

    await expect.poll(async () => {
      return await page.evaluate<number | null, string>(
        (storageKey) => {
          const hasTimeHorizonYears = (value: unknown): value is { timeHorizonYears: number } => {
            return (
              typeof value === 'object'
              && value !== null
              && 'timeHorizonYears' in value
              && typeof value.timeHorizonYears === 'number'
            );
          };

          const browserGlobal = globalThis as unknown as { localStorage: { getItem: (key: string) => string | null } };
          const raw = browserGlobal.localStorage.getItem(storageKey);
          if (!raw) return null;

          const parsed: unknown = JSON.parse(raw);
          return hasTimeHorizonYears(parsed) ? parsed.timeHorizonYears : null;
        },
        CONFIG_STORAGE_KEY,
      );
    }).toBe(nextYears);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[name="yearsToRetirement"]').first()).toHaveValue(String(nextYears));
  });
});
