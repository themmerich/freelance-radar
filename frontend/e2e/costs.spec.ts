import { expect, test, Page } from '@playwright/test';

const PROFILES = [{ id: 1, name: 'Standard', active: true }];

// 1.6 ct: 12 000 Input- + 800 Output-Tokens auf Haiku (siehe run-cost.ts).
const RUN_RECENT = {
  id: 2,
  ranAt: new Date().toISOString(),
  newOffers: 1,
  totalSeen: 1,
  analyzedOffers: 1,
  inputTokens: 12000,
  outputTokens: 800,
  note: null,
};

// 10 ct, aber außerhalb der letzten 7 Tage — darf nur in der Gesamtsumme auftauchen.
const RUN_OLD = {
  id: 1,
  ranAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  newOffers: 3,
  totalSeen: 5,
  analyzedOffers: 3,
  inputTokens: 100000,
  outputTokens: 0,
  note: null,
};

async function mockApi(page: Page, runs: unknown[] = []): Promise<void> {
  await page.route('**/api/profiles', (route) => route.fulfill({ json: PROFILES }));
  await page.route('**/api/offers', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/runs/latest', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/runs', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: runs });
    }
    return route.continue();
  });
}

test.describe('Costs overview e2e', () => {
  test('the sidebar links to the costs page', async ({ page }) => {
    await mockApi(page, []);
    await page.goto('/');

    await page.getByRole('link', { name: 'Costs' }).click();

    await expect(page).toHaveURL(/\/kosten$/);
    await expect(page.getByText('No runs yet.')).toBeVisible();
  });

  test('shows total and last-7-days cost summaries, and a per-run table', async ({ page }) => {
    await mockApi(page, [RUN_OLD, RUN_RECENT]);
    await page.goto('/kosten');

    // Gesamt: 10 ct (alt) + 1.6 ct (aktuell); letzte 7 Tage: nur die 1.6 ct. Über die
    // umschließenden Kacheln-Divs skopiert, sonst kollidiert „≈1.6 ct" mit der Tabellenzeile.
    await expect(page.locator('div', { hasText: 'Total costs' }).last()).toContainText('≈11.6 ct');
    await expect(page.locator('div', { hasText: 'Costs (last 7 days)' }).last()).toContainText('≈1.6 ct');

    await expect(page.getByRole('cell', { name: '100000' })).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(3); // header + 2 data rows
  });
});
