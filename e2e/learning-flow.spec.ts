import { expect, test, type Page } from '@playwright/test';

/** Answers whatever task is on screen and waits until the player moves on; correctness does not matter here. */
async function answerCurrentTask(page: Page) {
  const task = page.locator('.workspace__task');
  const progress = await page.locator('.focus__progress').textContent();
  if (await task.getByRole('button', { name: 'Пропустить без штрафа' }).count()) {
    await task.getByRole('button', { name: 'Пропустить без штрафа' }).click();
  } else if (await task.locator('.tiles:not(.tiles--answer) .tile').count()) {
    const tiles = task.locator('.tiles:not(.tiles--answer) .tile');
    while (await tiles.count()) await tiles.first().click();
  } else if (await task.locator('.options__item').count()) {
    await task.locator('.options__item').first().click();
  } else {
    await task.locator('input.input, textarea').first().fill('test');
  }
  await task.locator('.task-actions .btn--primary').click();
  await expect
    .poll(async () => (await page.locator('.feedback, .summary').count()) > 0 || (await page.locator('.focus__progress').textContent()) !== progress)
    .toBe(true);
}

async function playUntilSummary(page: Page) {
  for (let step = 0; step < 80; step++) {
    if (await page.locator('.summary').count()) return;
    const next = page.locator('.feedback .btn--primary');
    if (await next.count()) {
      await next.click();
      continue;
    }
    if (await page.locator('.workspace__task').count()) await answerCurrentTask(page);
    else await page.waitForTimeout(200);
  }
  await expect(page.locator('.summary')).toBeVisible();
}

test('a new learner registers, takes the placement test, completes a lesson and sees the cabinet', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/register');
  await page.locator('input[autocomplete=given-name]').fill('Айгерим');
  await page.locator('input[type=email]').fill(`e2e-${Date.now()}@example.com`);
  await page.locator('input[autocomplete=new-password]').fill('Secret123');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/onboarding');

  await page.getByText('Deutsch').click();
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByText('Путешествия').click();
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.getByText('15 мин в день').click();
  await page.getByRole('button', { name: 'Далее' }).click();
  await page.locator('button[role=radio]', { hasText: 'Пройти входной тест' }).click();
  await page.locator('.onboarding__actions .btn--primary').click();
  await page.waitForURL('**/learn/**');
  await expect(page.locator('.workspace__context')).toContainText('Тема');

  await playUntilSummary(page);
  await expect(page.getByRole('heading', { name: 'Уровень определён' })).toBeVisible();

  await page.goto('/today');
  await expect(page.getByRole('heading', { name: 'План на сегодня' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Что видит система' })).toBeVisible();
  await expect(page.locator('.reason-list li').first()).toBeVisible();

  await page.goto('/path');
  await expect(page.getByRole('heading', { name: 'Программа курса' })).toBeVisible();
  await page.locator('a.syllabus__title').first().click();
  await page.waitForURL('**/lessons/**');
  // Words are voiced by prepared recordings, so this works even in a browser without speech voices.
  const recording = page.waitForRequest((r) => /\/audio\/de\/[0-9a-f]+\.mp3$/.test(r.url()));
  await page.locator('.word-row .speak-btn').first().click();
  await recording;
  await page.locator('.lesson-head .btn--primary').click();
  await page.waitForURL('**/learn/**');
  await expect(page.locator('.workspace__task')).toBeVisible();

  await answerCurrentTask(page);
  await expect(page.locator('.feedback')).toBeVisible();
  await expect(page.locator('.feedback')).toContainText(/Верно|Почти верно|Неверно|Пропущено/);
  await playUntilSummary(page);
  await expect(page.getByRole('heading', { name: 'Результаты по темам' })).toBeVisible();

  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: 'Личный кабинет' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Языки и уровни' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'План на сегодня и рекомендации' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('the administrator opens the dashboard and the lesson list', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type=email]').fill('admin@linguapath.local');
  await page.locator('input[autocomplete=current-password]').fill(process.env.SEED_ADMIN_PASSWORD ?? 'LinguaAdmin2026');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/admin');
  await expect(page.getByRole('heading', { name: 'Управление платформой' })).toBeVisible();
  await page.getByRole('link', { name: 'Курсы и уроки' }).click();
  await expect(page.locator('table').first()).toBeVisible();
});
