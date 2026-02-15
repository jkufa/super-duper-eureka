import { expect, test, type Page } from '@playwright/test';
import {
  addCustomVariableButton,
  customVariableAmountInput,
  customVariableNameInput,
  gotoApp,
} from './helpers/custom-variable';

const CONFIG_STORAGE_KEY = 'retirement_webapp_retirement_config';

const SEEDED_CONFIG = {
  currentBalance: 1000,
  timeHorizonYears: 40,
  startDate: '2026-01-20T00:00:00.000Z',
  interest: {
    annualRate: 0.06,
    variance: 0.02,
    compounding: 'monthly',
  },
  salary: {
    annualBase: 45000,
    annualRaiseRate: 0.03,
  },
  contributions: [],
};

async function addEvery16thCustomVariable(page: Page) {
  await customVariableNameInput(page).fill('Every 16th E2E');
  await customVariableAmountInput(page).fill('100');

  const visibleTimingInput = page
    .locator('[role="dialog"] #custom-variable-timing-natural:visible, #custom-variable-timing-natural:visible')
    .first();
  await visibleTimingInput.fill('every 16th');
  await visibleTimingInput.blur();
  await page.waitForTimeout(500);

  await addCustomVariableButton(page).click({ force: true });
}

function firstYearAnnualContributionCell(page: Page) {
  return page.locator('[data-slot="table-body"] [data-slot="table-row"]').first().getByRole('cell').nth(2);
}

test.describe('Custom variable start-date gating', () => {
  test('default startDate is today', async ({ page }) => {
    await gotoApp(page);
    await addEvery16thCustomVariable(page);
    const expectedDate = await page.evaluate(() => {
      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}T00:00:00.000Z`;
    });

    await expect.poll(async () => {
      return await page.evaluate((storageKey) => {
        const browserGlobal = globalThis as unknown as { localStorage: { getItem: (key: string) => string | null } };
        const raw = browserGlobal.localStorage.getItem(storageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { startDate?: string };
        return parsed.startDate ?? null;
      }, CONFIG_STORAGE_KEY);
    }).toBe(expectedDate);
  });

  test('startDate on January 20 skips January for "every 16th"', async ({ page }) => {
    await page.addInitScript(({ key, config }) => {
      const browserGlobal = globalThis as unknown as { localStorage: { setItem: (storageKey: string, value: string) => void } };
      browserGlobal.localStorage.setItem(key, JSON.stringify(config));
    }, { key: CONFIG_STORAGE_KEY, config: SEEDED_CONFIG });

    await gotoApp(page);
    await addEvery16thCustomVariable(page);

    await expect(firstYearAnnualContributionCell(page)).toHaveText('$1,100');
  });
});
