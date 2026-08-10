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
  startDate: '09/2026',
  budgetEur: 85,
  budgetKind: 'HOURLY',
  durationMonths: 6,
  utilizationPercent: 100,
  remotePercent: 80,
  startMonth: null,
  startImmediate: false,
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

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Zeitgerüst für die Trend-Deltas der Kachel-Zeile: eines im laufenden 7-Tage-Fenster
 * (vor 2 Tagen, zusammen mit OFFER also zwei), eines in dessen Vorperiode (vor 10 Tagen)
 * und eines davor (vor 20 Tagen), das die Vorperiode überhaupt erst abdeckt.
 * Alle drei ohne Score und ohne Budget, damit Gesamt, Ø Score, 🟢-Anteil und die
 * Marktkennzahlen unberührt bleiben.
 */
const TREND_OFFERS = [2, 10, 20].map((days, index) => ({
  ...OFFER,
  id: 10 + index,
  receivedAt: daysAgo(days),
  projectUrl: `https://www.freelancermap.de/nproj/40000${index}.html`,
  matchScore: null,
  matchReason: null,
  status: 'NEW',
  budgetEur: null,
  budgetKind: null,
  durationMonths: null,
  remotePercent: null,
  skills: [],
  dupCount: 1,
}));

const RUN = {
  id: 1,
  ranAt: '2026-07-22T10:00:00Z',
  newOffers: 1,
  totalSeen: 1,
  analyzedOffers: 1,
  detailsFetched: 2,
  detailsFailed: 0,
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
  await page.route('**/api/offers', (route) => route.fulfill({ json: collected ? [OFFER, DUPLICATE_OFFER, ...TREND_OFFERS] : [] }));
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
    // „Last run" sitzt jetzt hinter der Glocke in der Topbar, nicht mehr direkt sichtbar.
    await page.getByRole('button', { name: 'Messages' }).click();
    await expect(page.getByText('No run yet — fetch mails now.')).toBeVisible();
  });

  test('the messages popover shows the last run and closes on Escape', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch & analyze mails' }).click();
    await expect(page.getByText('1 new offers imported from 1 mails · 1 analyzed · 2 detail pages fetched')).toBeVisible();

    const bell = page.getByRole('button', { name: 'Messages' });
    await bell.click();
    await expect(page.getByText('Last run: 1 new of 1 seen, 2 detail pages')).toBeVisible();
    await expect(bell).toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(page.getByText('Last run: 1 new of 1 seen, 2 detail pages')).toBeHidden();
    await expect(bell).toHaveAttribute('aria-expanded', 'false');
  });

  test('a run reports the import numbers via the success toast', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch & analyze mails' }).click();

    // Der Erfolgs-Toast meldet die Importzahlen; die Kosten haben jetzt ihre eigene Seite (/kosten).
    await expect(page.getByText('1 new offers imported from 1 mails · 1 analyzed · 2 detail pages fetched')).toBeVisible();
  });

  test('shows the kpi tiles and splits the twelve charts across both tabs', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch & analyze mails' }).click();

    await expect(page.getByText('Avg match score (30 days)')).toBeVisible();
    // Ein analysiertes Angebot mit Score 85 bei Schwelle 70 → Anteil 🟢 = 100 %.
    // Auf die Kachel eingegrenzt, seit „+100 %" auch als Trend-Delta vorkommen kann.
    await expect(page.locator('dl > div').filter({ hasText: 'Share 🟢' })).toContainText('100 %');
    // Gesamt zählt ohne Zeitfenster; die Kopie des zweiten Agenten bleibt außen vor.
    await expect(page.locator('dl > div').filter({ hasText: 'Total' })).toContainText('1');

    // Die KPI-Kacheln stehen über beiden Tabs; die 7 globalen Charts liegen im Auftakt-Tab.
    await expect(page.getByRole('tabpanel').locator('canvas')).toHaveCount(7);
    // Die Marktkennzahlen nennen ihre Fallzahl — hier das eine analysierte Angebot.
    const rateStat = page.locator('app-market-stats div').filter({ hasText: 'Avg hourly rate' });
    await expect(rateStat).toContainText('85 €/h');
    await expect(rateStat).toContainText('from 1 offers');

    await page.getByRole('tab', { name: 'Agent analysis' }).click();

    await expect(page.getByRole('tabpanel').locator('canvas')).toHaveCount(5);
    await expect(page.getByText('Avg match score (30 days)')).toBeVisible();
  });

  test('the kpi tiles compare against the previous period, or say why they cannot', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch & analyze mails' }).click();

    // Am Anfang verankert: „(30 days)" steht seit der Umdeutung auch in den beiden Qualitätskacheln.
    const sevenDays = page.locator('dl > div').filter({ hasText: /^7 days/ });
    const thirtyDays = page.locator('dl > div').filter({ hasText: /^30 days/ });

    // Siehe TREND_OFFERS: im 7-Tage-Fenster stehen 2 Angebote gegen 1 in der Vorperiode.
    await expect(sevenDays).toContainText('+100 %');
    await expect(sevenDays).toContainText('versus previous period');

    // Die Vorperiode der 30-Tage-Kachel liegt vor dem ältesten Angebot — kein ehrlicher Vergleich.
    await expect(thirtyDays).toContainText('no comparison');
  });

  test('the time range switches the resolution and survives a reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch & analyze mails' }).click();

    // Auftakt sind 30 Tage — Tagesbalken.
    await expect(page.getByText('Offers per day')).toBeVisible();

    // Das Radio liegt visuell verborgen unter seinem Label — geklickt wird, wie im Browser, das Label.
    await page.getByText('90 days', { exact: true }).click();

    await expect(page.getByText('Offers per week')).toBeVisible();
    await expect(page.getByText('Offers per day')).toBeHidden();

    // Das Fenster liegt im localStorage, überlebt also den Reload.
    await page.reload();

    await expect(page.getByRole('radio', { name: '90 days' })).toBeChecked();
    await expect(page.getByText('Offers per week')).toBeVisible();
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
