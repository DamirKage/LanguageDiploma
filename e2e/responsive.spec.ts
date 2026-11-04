import { expect, test } from '@playwright/test';

test('demo learner pages fit a phone screen without horizontal scrolling', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type=email]').fill('demo@linguapath.local');
  await page.locator('input[autocomplete=current-password]').fill(process.env.SEED_DEMO_PASSWORD ?? 'LinguaDemo2026');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/today');
  for (const path of ['/today', '/path', '/review', '/vocabulary', '/progress', '/profile']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
    await expect(page.locator('.tabbar')).toBeVisible();
  }
});
