import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env['CI'];

// Locally, E2E_PORT lets the suite run beside another dev server occupying
// 4200 (ng serve honors the PORT env var). CI always serves on 4200.
const port = isCI ? 4200 : Number(process.env['E2E_PORT'] ?? 4200);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // Readable console output plus an HTML report (uploaded as a CI artifact);
  // `open: never` keeps it from launching a browser locally on failure.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Locally: start (or reuse) the dev server on 4200. In CI: serve the
  // production build instead (`serve:dist` over `dist/frontend/browser`, built
  // by the workflow beforehand) — it catches production-only bugs. Same URL
  // either way, so the specs don't care which server answers.
  webServer: {
    command: isCI ? 'pnpm serve:dist' : 'pnpm start',
    env: { ...(process.env as Record<string, string>), PORT: String(port) },
    url: `http://localhost:${port}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
