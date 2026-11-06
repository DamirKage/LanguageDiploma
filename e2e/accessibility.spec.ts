import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Automated WCAG 2.1 A/AA audit (axe-core) of public and learner pages in every colour theme. */
async function audit(page: Page, label: string) {
  // Entrance animations fade elements in; the audit must see the final colours, not a frame half-way through.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(150);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = serious.map((v) => `${label}: ${v.id} (${v.impact}) — ${v.help}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(', ')}`);
  expect(report, report.join('\n')).toEqual([]);
}

test('public pages have no serious accessibility violations', async ({ page }) => {
  for (const path of ['/', '/login', '/register', '/about']) {
    await page.goto(path);
    await audit(page, path);
  }
});

test('learner pages have no serious accessibility violations in all themes', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/login');
  await page.locator('input[type=email]').fill('demo@linguapath.local');
  await page.locator('input[autocomplete=current-password]').fill(process.env.SEED_DEMO_PASSWORD ?? 'LinguaDemo2026');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/today');
  for (const theme of ['night', 'day', 'paper']) {
    await page.evaluate((t) => localStorage.setItem('linguapath.theme', t), theme);
    for (const path of ['/today', '/path', '/review', '/vocabulary', '/progress', '/profile']) {
      await page.goto(path);
      await audit(page, `${theme} ${path}`);
    }
  }
  await page.evaluate(() => localStorage.setItem('linguapath.theme', 'night'));
  await page.goto('/path');
  await page.locator('a[href*="/lessons/"]').nth(5).click();
  await page.waitForURL('**/lessons/**');
  await audit(page, 'lesson page');
  await page.getByRole('button', { name: /начать|повторить|продолжить/i }).first().click();
  await page.waitForURL('**/learn/**');
  await page.locator('.workspace__task').waitFor();
  await audit(page, 'lesson player');
});
