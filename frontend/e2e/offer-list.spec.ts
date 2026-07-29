import { expect, test, Page } from '@playwright/test';

const OFFER = {
  id: 1,
  // Dynamisch, damit die KPI-Zeitfenster (heute/7/30 Tage) nicht vom realen Datum wegdriften.
  receivedAt: new Date().toISOString(),
  fromAddr: 'office@freelancermap.de',
  subject: 'Angular - Anzahl neue Projekte: 1',
  sourceType: 'AGENT',
  agentName: 'Angular',
  projectTitle: 'Senior Angular Entwickler',
  company: 'softwareXperts GmbH',
  role: 'Angular Entwickler',
  location: 'Hamburg',
  country: 'AT',
  remote: 'REMOTE',
  rate: null,
  startDate: '09/2026',
  duration: null,
  projectUrl: 'https://www.freelancermap.de/nproj/3026991.html',
  matchScore: 85,
  matchReason: 'Kern-Stack Angular, remote — passt sehr gut zum Profil.',
  seniority: 'senior',
  industry: 'unbekannt',
  primary: true,
  dupCount: 2,
  status: 'ANALYZED',
  skills: [
    { name: 'Angular', gap: false },
    { name: 'Kotlin', gap: true },
  ],
};

// Dieselbe freelancermap-Projekt-ID über einen zweiten Agenten: nicht primär,
// darf in der Tabelle nicht als eigene Zeile auftauchen.
const DUPLICATE_OFFER = {
  ...OFFER,
  id: 2,
  subject: 'Java Spring - Anzahl neue Projekte: 1',
  agentName: 'Java Spring',
  primary: false,
  dupCount: 1,
};

const RUN = {
  id: 1,
  ranAt: '2026-07-22T10:00:00Z',
  newOffers: 1,
  totalSeen: 1,
  analyzedOffers: 1,
  inputTokens: 12000,
  outputTokens: 800,
  note: 'since=2026-07-22',
};

const PROFILES = [{ id: 1, name: 'Standard', active: true }];

async function mockApi(page: Page, offers: unknown[] = []): Promise<void> {
  await page.route('**/api/profiles', (route) => route.fulfill({ json: PROFILES }));
  await page.route('**/api/offers', (route) => route.fulfill({ json: offers }));
  await page.route('**/api/runs/latest', (route) => (offers.length > 0 ? route.fulfill({ json: RUN }) : route.fulfill({ status: 204 })));
}

test.describe('Offer list e2e', () => {
  test('the sidebar links to the offers page and shows the table there, not on the dashboard', async ({ page }) => {
    await mockApi(page, [OFFER, DUPLICATE_OFFER]);
    await page.goto('/');

    // Die Tabelle gehört jetzt der eigenen Seite, nicht mehr dem Dashboard.
    await expect(page.getByRole('table')).toHaveCount(0);

    await page.getByRole('link', { name: 'Offers' }).click();

    await expect(page).toHaveURL(/\/angebote$/);
    await expect(page.getByRole('cell', { name: 'Senior Angular Entwickler' })).toBeVisible();
  });

  test.describe('with a collected offer', () => {
    test.beforeEach(async ({ page }) => {
      await mockApi(page, [OFFER, DUPLICATE_OFFER]);
      await page.goto('/angebote');
      await expect(page.getByRole('cell', { name: 'Senior Angular Entwickler' })).toBeVisible();
    });

    test('shows the score traffic light and the country flag', async ({ page }) => {
      await expect(page.getByRole('cell', { name: '85' })).toBeVisible();
      await expect(page.getByRole('cell', { name: '🇦🇹 AT' })).toBeVisible();
    });

    test('expanding a row shows the match reason and the skill gaps', async ({ page }) => {
      await page.getByRole('button', { name: 'Details' }).click();

      await expect(page.getByText('Kern-Stack Angular, remote — passt sehr gut zum Profil.')).toBeVisible();
      await expect(page.getByText('Kotlin')).toBeVisible();
    });

    test('collapses the same project caught by two agents into one badged row', async ({ page }) => {
      // Nur die primäre Zeile wird gerendert — mit dem Spread-Badge statt einer Duplikat-Zeile.
      await expect(page.getByRole('cell', { name: /Senior Angular Entwickler/ })).toHaveCount(1);
      await expect(page.getByText('spread 2×')).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Java Spring' })).toHaveCount(0);
    });

    test('unchecking the duplicate toggle reveals the copies', async ({ page }) => {
      await expect(page.getByRole('cell', { name: 'Java Spring' })).toHaveCount(0);

      await page.getByRole('checkbox', { name: 'Collapse duplicates' }).uncheck();

      await expect(page.getByRole('cell', { name: 'Java Spring' })).toBeVisible();
    });

    test('raising the green threshold here lowers the dashboard green share', async ({ page }) => {
      // Die Schwellen-Eingaben sitzen auf dieser Seite, der Anteil selbst auf dem Dashboard —
      // beide lesen denselben SettingsStore, die Änderung muss also über die Seite hinweg wirken.
      await page.goto('/');
      await expect(page.getByText('100 %')).toBeVisible();

      await page.goto('/angebote');
      const greenInput = page.getByRole('spinbutton').first();
      await greenInput.fill('90');
      await greenInput.blur();

      await page.goto('/');
      await expect(page.getByText('0 %')).toBeVisible();
    });

    test('scrolls horizontally instead of squeezing the columns', async ({ page }) => {
      // Die 12 Spalten sind breiter als der Container, also muss er horizontal scrollen.
      const scroller = page.locator('.p-datatable-table-container');
      await expect.poll(() => scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    });

    test('shows the clustered job profile and filters by it', async ({ page }) => {
      // „Angular Entwickler" fällt ins Frontend-Cluster; der Rohtext steht in der Detailzeile.
      await expect(page.getByRole('cell', { name: 'Frontend' })).toBeVisible();

      await page.getByRole('button', { name: 'Details' }).first().click();
      await expect(page.getByText('Role per analysis:')).toBeVisible();
      await expect(page.getByText('Angular Entwickler', { exact: true })).toBeVisible();

      await page
        .getByRole('columnheader', { name: /Job profile/ })
        .getByRole('button')
        .click();
      await page.getByRole('combobox', { name: 'Filter by Job profile' }).selectOption('BACKEND');

      await expect(page.getByRole('cell', { name: 'Senior Angular Entwickler' })).toHaveCount(0);
    });

    test('filters a column down to nothing', async ({ page }) => {
      // Quelle des Angebots ist AGENT — der Filter auf PRIVATE muss die Tabelle leeren.
      await page
        .getByRole('columnheader', { name: /Source/ })
        .getByRole('button')
        .click();
      await page.getByRole('combobox', { name: 'Filter by Source' }).selectOption('PRIVATE');

      await expect(page.getByRole('cell', { name: 'Senior Angular Entwickler' })).toHaveCount(0);
      await expect(page.getByText('No offers yet. Fetch mails with the button above.')).toBeVisible();
    });
  });

  test('shows the empty state before the first run', async ({ page }) => {
    await mockApi(page, []);
    await page.goto('/angebote');

    await expect(page.getByText('No offers yet. Fetch mails with the button above.')).toBeVisible();
  });

  test('shows 10 rows per page by default', async ({ page }) => {
    // 12 primäre Angebote — mehr als eine Standardseite, um den Default zu belegen.
    const offers = Array.from({ length: 12 }, (_, index) => ({
      ...OFFER,
      id: index + 1,
      dupCount: 1,
      projectTitle: `Senior Angular Entwickler #${index + 1}`,
    }));
    await mockApi(page, offers);
    await page.goto('/angebote');

    await expect(page.getByText('1–10 of 12')).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(10);
  });
});
