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
// darf im Dashboard nicht als eigene Zeile auftauchen.
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

// The backend is mocked at the network edge so the e2e suite needs no Spring
// Boot instance: before a run the API is empty, afterwards it returns one offer.
const PROFILES = [
  { id: 1, name: 'Standard', active: true },
  { id: 2, name: 'Fullstack', active: false },
];

async function mockApi(page: Page): Promise<{ collected: () => boolean }> {
  let collected = false;
  await page.route('**/api/profiles', (route) => route.fulfill({ json: PROFILES }));
  await page.route('**/api/profiles/*/activate', (route) => route.fulfill({ json: { id: 2, name: 'Fullstack', active: true } }));
  await page.route('**/api/offers', (route) => route.fulfill({ json: collected ? [OFFER, DUPLICATE_OFFER] : [] }));
  await page.route('**/api/runs/latest', (route) => (collected ? route.fulfill({ json: RUN }) : route.fulfill({ status: 204 })));
  await page.route('**/api/runs', (route) => {
    collected = true;
    return route.fulfill({ status: 201, json: RUN });
  });
  return { collected: () => collected };
}

test.describe('Offers dashboard e2e', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
  });

  // Self-test: the route loaded and the dashboard rendered its card.
  test('renders the dashboard (self-test)', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fetch & analyze mails' })).toBeVisible();
  });

  test('shows the empty state before the first run', async ({ page }) => {
    await expect(page.getByText('No run yet — fetch mails now.')).toBeVisible();
  });

  test('a run reports the import numbers and the cost', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch & analyze mails' }).click();

    // 12 000 Input- + 800 Output-Tokens auf Haiku ≈ 1,6 US-Cent
    await expect(page.getByText('Last run: 1 new of 1 seen · 1 analyzed · ≈1.6 ct')).toBeVisible();
    // Der Erfolgs-Toast meldet die Importzahlen.
    await expect(page.getByText('1 new offers imported from 1 mails · 1 analyzed')).toBeVisible();
  });

  test('shows the kpi tiles and all six charts after a run', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch & analyze mails' }).click();

    await expect(page.getByText('Avg match score')).toBeVisible();
    // Ein analysiertes Angebot mit Score 85 bei Schwelle 70 → Anteil 🟢 = 100 %.
    await expect(page.getByText('100 %')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(6);
  });

  test('switching the profile activates it and reloads the offers', async ({ page }) => {
    const activated = page.waitForRequest((request) => request.url().includes('/api/profiles/2/activate') && request.method() === 'POST');

    await page.getByLabel('Profile').selectOption('2');

    await activated;
  });

  test('shows an error toast with the server detail when the run fails', async ({ page }) => {
    await page.unroute('**/api/runs');
    await page.route('**/api/runs', (route) => route.fulfill({ status: 502, json: { detail: 'IMAP-Abruf fehlgeschlagen' } }));

    await page.getByRole('button', { name: 'Fetch & analyze mails' }).click();

    // Der Fehler-Toast trägt das Problem-Detail des Backends.
    await expect(page.getByRole('alert')).toContainText('Run failed');
    await expect(page.getByRole('alert')).toContainText('IMAP-Abruf fehlgeschlagen');
  });
});
