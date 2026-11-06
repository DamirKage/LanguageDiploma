import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 8099);

/** Runs the whole platform with the embedded database (`npm run demo`) and drives it in Chromium. */
export default defineConfig({
  testDir: '.',
  timeout: 180_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    locale: 'ru-RU',
    ...devices['Desktop Chrome'],
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 860 } }, testMatch: /learning-flow|accessibility/ },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, testMatch: /responsive/ },
  ],
  webServer: {
    command: 'npm run demo',
    cwd: '..',
    url: `http://localhost:${port}/api/health`,
    env: { PORT: String(port) },
    timeout: 600_000,
    reuseExistingServer: true,
  },
});
