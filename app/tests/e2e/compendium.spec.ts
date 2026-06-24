import { expect, test, type Page } from '@playwright/test';

async function openSpell(page: Page, name: string) {
  await page.locator('.level-tabs').getByRole('button', { name: 'All' }).click();
  await page.getByLabel('Search spells').fill(name);
  await page.locator('.sigil-cell', { hasText: name }).first().click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Gorilla's field guide" })).toBeVisible();
  await expect(page.getByLabel('Search spells')).toBeVisible();
});

test('supports source and version switching for shared spells', async ({ page }) => {
  await page.getByRole('button', { name: '3.5' }).click();
  await openSpell(page, 'Acid Splash');

  await expect(page.getByRole('button', { name: '2024 Rules' })).toBeVisible();
  await expect(page.getByRole('button', { name: '2014 Rules' })).toBeVisible();
  await expect(page.getByRole('button', { name: '3.5 Rules' })).toBeVisible();

  await page.getByRole('button', { name: '3.5 Rules' }).click();
  await expect(page.locator('.source')).toContainText('D&D 3.5 SRD');
});

test('switches renderer by selected class system', async ({ page }) => {
  await page.getByLabel('Filter by class').selectOption('Warlock');
  await openSpell(page, 'Dispel Magic');
  await expect(page.locator('.warlock-svg')).toBeVisible();

  await page.getByRole('button', { name: 'Back to spell list' }).click();
  await page.getByLabel('Filter by class').selectOption('Druid');
  await openSpell(page, 'Cure Wounds');
  await expect(page.locator('.spokes-svg')).toBeVisible();
});

test('flags incomplete notation instead of silently pretending it is supported', async ({ page }) => {
  await page.getByRole('button', { name: '3.5' }).click();
  await openSpell(page, 'Acid Splash');
  await page.getByRole('button', { name: '3.5 Rules' }).click();

  const warning = page.getByTestId('notation-warning');
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('Area');
});

test('keeps fully supported notation quiet for canonical spells', async ({ page }) => {
  await openSpell(page, 'Fireball');
  await expect(page.getByTestId('notation-warning')).toHaveCount(0);
});
