import { expect, test, Page } from '@playwright/test';

const OFFER = {
  id: 1,
  receivedAt: '2026-07-22T09:15:00Z',
  fromAddr: 'office@freelancermap.de',
  subject: 'Angular - Anzahl neue Projekte: 1',
  sourceType: 'AGENT',
  agentName: 'Angular',
  projectTitle: 'Senior Angular Entwickler',
  company: 'softwareXperts GmbH',
  role: null,
  location: 'Hamburg',
  remote: 'REMOTE',
  rate: null,
  startDate: null,
  duration: null,
  projectUrl: 'https://www.freelancermap.de/nproj/3026991.html',
  matchScore: null,
  matchReason: null,
  seniority: null,
  industry: null,
  primary: true,
  dupCount: 2,
  status: 'NEW',
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
  analyzedOffers: 0,
  inputTokens: 0,
  outputTokens: 0,
  note: 'since=2026-07-22',
};

// The backend is mocked at the network edge so the e2e suite needs no Spring
// Boot instance: before a run the API is empty, afterwards it returns one offer.
async function mockApi(page: Page): Promise<{ collected: () => boolean }> {
  let collected = false;
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
    await expect(page.getByText('Freelance Radar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fetch mails' })).toBeVisible();
  });

  test('shows the empty state before the first run', async ({ page }) => {
    await expect(page.getByText('No run yet — fetch mails now.')).toBeVisible();
    await expect(page.getByText('No offers yet. Fetch mails with the button above.')).toBeVisible();
  });

  test('fetching mails fills the table and updates the last run', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch mails' }).click();

    await expect(page.getByRole('cell', { name: 'Senior Angular Entwickler' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Hamburg' })).toBeVisible();
    await expect(page.getByText('Last run: 1 new of 1 seen')).toBeVisible();
  });

  test('collapses the same project caught by two agents into one badged row', async ({ page }) => {
    await page.getByRole('button', { name: 'Fetch mails' }).click();

    // Only the primary row is rendered — with the spread badge instead of a duplicate line.
    await expect(page.getByRole('cell', { name: /Senior Angular Entwickler/ })).toHaveCount(1);
    await expect(page.getByText('spread 2×')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Java Spring' })).toHaveCount(0);
  });

  test('shows an error message when the collect run fails', async ({ page }) => {
    await page.unroute('**/api/runs');
    await page.route('**/api/runs', (route) => route.fulfill({ status: 502, json: { detail: 'IMAP-Abruf fehlgeschlagen' } }));

    await page.getByRole('button', { name: 'Fetch mails' }).click();

    await expect(page.getByRole('alert')).toContainText('Fetching failed');
  });
});
