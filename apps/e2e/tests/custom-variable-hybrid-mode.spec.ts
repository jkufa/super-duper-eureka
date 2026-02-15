import { expect, test } from '@playwright/test';
import { gotoApp, openCustomVariablesAccordion } from './helpers/custom-variable';

test.describe('Custom variable hybrid timing mode', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop assertions only for this flow.');

  test('create form only exposes hybrid timing controls', async ({ page }) => {
    await gotoApp(page);
    const createForm = page.getByRole('heading', { name: 'Add custom variable' }).locator('xpath=ancestor::section[1]');

    await expect(createForm.getByText('Contribution frequency')).toBeVisible();
    await expect(createForm.getByText('Timing phrase')).toHaveCount(0);
    await expect(createForm.getByText('Timing input style')).toHaveCount(0);
    await expect(createForm.getByText('When to apply contribution')).toHaveCount(0);
    await expect(createForm.getByRole('spinbutton', { name: 'Start year' })).toHaveCount(0);
    await expect(createForm.getByRole('spinbutton', { name: 'End year' })).toHaveCount(0);

    const timingInput = createForm.locator('#custom-variable-timing-natural');
    await timingInput.fill('every feb 13');
    await page.waitForTimeout(500);

    await expect(createForm.getByText('Parsed as annual')).toBeVisible();
    await expect(createForm.getByRole('spinbutton', { name: 'Start year' })).toHaveCount(0);
    await expect(createForm.getByRole('spinbutton', { name: 'End year' })).toHaveCount(0);
    await timingInput.blur();
    await expect(createForm.getByRole('spinbutton', { name: 'Start year' })).toHaveCount(0);
    await expect(createForm.getByRole('spinbutton', { name: 'End year' })).toHaveCount(0);
    await expect(createForm.getByRole('spinbutton', { name: 'Day' })).toHaveCount(0);
    await expect(createForm.getByRole('spinbutton', { name: 'Month' })).toHaveCount(0);
    await expect(createForm.getByRole('spinbutton', { name: 'Day of month' })).toHaveCount(0);

    await timingInput.fill('on 1/2/2027');
    await page.waitForTimeout(500);

    await expect(createForm.getByText('Parsed as one-time')).toBeVisible();
    await expect(createForm.getByRole('spinbutton', { name: 'Start year' })).toHaveCount(0);
    await expect(createForm.getByRole('spinbutton', { name: 'End year' })).toHaveCount(0);
    await timingInput.blur();
    await expect(createForm.getByRole('spinbutton', { name: 'Year', exact: true })).toHaveCount(0);
    await expect(createForm.getByRole('spinbutton', { name: 'Start year' })).toHaveCount(0);
    await expect(createForm.getByRole('spinbutton', { name: 'End year' })).toHaveCount(0);
  });

  test('calendar opens anchored to today by default', async ({ page }) => {
    await gotoApp(page);
    const createForm = page.getByRole('heading', { name: 'Add custom variable' }).locator('xpath=ancestor::section[1]');
    const today = await page.evaluate(() => {
      const now = new Date();
      return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    });

    await createForm.locator('#custom-variable-timing-natural-date-picker').click();
    await expect(page.locator(`[data-calendar-day][data-value="${today}"]:not([data-outside-month])`)).toBeVisible();
  });

  test('calendar pick keeps one-time parse text stable after debounce', async ({ page }) => {
    await gotoApp(page);
    const createForm = page.getByRole('heading', { name: 'Add custom variable' }).locator('xpath=ancestor::section[1]');
    const timingInput = createForm.locator('#custom-variable-timing-natural');
    const currentYear = new Date().getFullYear();

    await timingInput.fill(`on 12/20/${String(currentYear)}`);
    await page.waitForTimeout(500);

    await createForm.locator('#custom-variable-timing-natural-date-picker').click();
    await page.locator(`[data-calendar-day][data-value="${String(currentYear)}-12-21"]`).click();

    const selectedValue = await timingInput.inputValue();
    const expectedMessage = `Parsed as one-time on ${selectedValue}. Applies once in ${String(currentYear)}.`;
    await expect(createForm.getByText(expectedMessage)).toBeVisible();

    await page.waitForTimeout(600);
    await expect(createForm.getByText(expectedMessage)).toBeVisible();
  });

  test('range modifiers parse and summarize without manual year inputs', async ({ page }) => {
    await gotoApp(page);
    const createForm = page.getByRole('heading', { name: 'Add custom variable' }).locator('xpath=ancestor::section[1]');
    const timingInput = createForm.locator('#custom-variable-timing-natural');

    await timingInput.fill('every 15th for 10 years starting in 2028');
    await timingInput.blur();

    await expect(createForm.getByText('Parsed as monthly on day 15.')).toBeVisible();
    await expect(createForm.getByText('Applies in years')).toBeVisible();
    await expect(createForm.getByRole('spinbutton', { name: 'Start year' })).toHaveCount(0);
    await expect(createForm.getByRole('spinbutton', { name: 'End year' })).toHaveCount(0);
  });

  test('edit form infers frequency from timing phrase and hides old controls', async ({ page }) => {
    await gotoApp(page);
    await openCustomVariablesAccordion(page);

    const editButton = page.getByRole('button', { name: 'Edit' }).first();
    await expect(editButton).toBeVisible();
    await editButton.click({ force: true });

    const editor = page.locator('#edit-custom-variable-name').locator('xpath=ancestor::section[1]');
    await expect(editor).toBeVisible();
    await expect(editor.getByText('Contribution frequency')).toBeVisible();
    await expect(editor.getByText('Timing phrase')).toHaveCount(0);
    await expect(editor.getByText('Timing input style')).toHaveCount(0);
    await expect(editor.getByText('When to apply contribution')).toHaveCount(0);

    const timingInput = editor.locator('#edit-custom-variable-timing-natural');
    await timingInput.fill('every feb 13');
    await page.waitForTimeout(500);

    await expect(editor.getByText('Parsed as annual')).toBeVisible();
    await expect(editor.locator('#edit-custom-variable-timing-day')).toHaveCount(0);
    await expect(editor.locator('#edit-custom-variable-timing-month')).toHaveCount(0);
    await expect(editor.locator('#edit-custom-variable-timing-year')).toHaveCount(0);

    await expect(editor.locator('#edit-custom-variable-year-start')).toHaveCount(0);
    await expect(editor.locator('#edit-custom-variable-year-end')).toHaveCount(0);

    await timingInput.fill('on 1/2/2027');
    await page.waitForTimeout(500);
    await expect(editor.locator('#edit-custom-variable-year-start')).toHaveCount(0);
    await expect(editor.locator('#edit-custom-variable-year-end')).toHaveCount(0);
  });
});
