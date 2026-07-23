import { expect, test, Page } from '@playwright/test';

const OFFER = {
  id: 1,
  receivedAt: '2026-07-22T09:15:00Z',
  fromAddr: 'office@freelancermap.de',
  subject: 'Neues Projekt passend zu Ihrem Suchprofil "Angular"',
  sourceType: 'AGENT',
  agentName: 'Angular',
  projectTitle: 'Senior Angular Entwickler',
  role: null,
  location: 'Hamburg',
  remote: 'REMOTE',
  rate: null,
  startDate: null,
  duration: null,
  matchScore: null,
  matchReason: null,
  seniority: null,
  industry: null,
  primary: true,
  dupCount: 1,
  status: 'NEW',
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
  await page.route('**/api/offers', (route) => route.fulfill({ json: collected ? [OFFER] : [] }));
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

  test('shows an error message when the collect run fails', async ({ page }) => {
    await page.unroute('**/api/runs');
    await page.route('**/api/runs', (route) => route.fulfill({ status: 502, json: { detail: 'IMAP-Abruf fehlgeschlagen' } }));

    await page.getByRole('button', { name: 'Fetch mails' }).click();

    await expect(page.getByRole('alert')).toContainText('Fetching failed');
  });
});
