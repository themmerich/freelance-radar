import { expect, test, Page } from '@playwright/test';

const STANDARD = {
  id: 1,
  name: 'Standard',
  role: 'Frontend Architect / Angular Lead / Coach',
  focus: 'Agentic UI / AI Engineering',
  industries: 'Banking, Insurance',
  region: 'DACH, remote',
  languages: 'Deutsch, Englisch',
  skills: {
    ai_agentic: ['Spring AI'],
    frontend: ['Angular (2-22)', 'TypeScript'],
    backend: ['Java'],
    devops_testing: ['Docker'],
    methods: ['DDD'],
  },
  strongSignals: ['Angular', 'Agentic'],
  weakSignals: ['React'],
  active: true,
};

const REANALYSIS_RUN = {
  id: 9,
  ranAt: '2026-07-24T10:00:00Z',
  newOffers: 0,
  totalSeen: 0,
  analyzedOffers: 12,
  inputTokens: 9000,
  outputTokens: 1800,
  note: 'reanalyse profil=Standard',
};

async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/profiles', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 201, json: { ...route.request().postDataJSON(), id: 2, active: false } });
    }
    return route.fulfill({ json: [STANDARD] });
  });
  await page.route('**/api/analyses/preview**', (route) =>
    route.fulfill({ json: { candidates: 5, estimatedInputTokens: 4000, estimatedOutputTokens: 850 } }),
  );
  await page.route('**/api/analyses', (route) => route.fulfill({ status: 201, json: REANALYSIS_RUN }));
}

test.describe('Profiles page e2e', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'Profiles' }).click();
  });

  test('lists the profiles and opens one in the editor', async ({ page }) => {
    await expect(page.getByText('Standard')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();

    // Anker am Zeilenanfang: „Copy profile Standard" enthält den Namen ebenfalls.
    await page.getByRole('button', { name: /^Standard/ }).click();

    await expect(page.getByLabel('Name')).toHaveValue('Standard');
    await expect(page.getByText('Angular (2-22)')).toBeVisible();
    await expect(page.getByText('React')).toBeVisible();
  });

  test('shows the cost preview and scores the backlog', async ({ page }) => {
    await page.getByRole('button', { name: /^Standard/ }).click();

    // 4000 Input- + 850 Output-Tokens auf Haiku ≈ 0,83 ct
    await expect(page.getByText('5 offers open')).toBeVisible();
    await expect(page.getByText('≈0.83 ct')).toBeVisible();

    // Nicht exact: das Button-Icon steuert ein Glyph-Zeichen zum Accessible Name bei.
    await page.getByRole('button', { name: 'Score' }).click();

    await expect(page.getByText('12 scored')).toBeVisible();
  });

  test('marks the editor mode as editing, new, or copy', async ({ page }) => {
    // Bearbeiten: Kopfzeile trägt den Profilnamen, Button speichert.
    await page.getByRole('button', { name: /^Standard/ }).click();
    await expect(page.getByRole('heading', { name: 'Standard' })).toBeVisible();
    await expect(page.getByText('Editing')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();

    // Leeres Anlegen.
    await page.getByRole('button', { name: 'New profile' }).click();
    await expect(page.getByRole('heading', { name: 'New profile' })).toBeVisible();
    await expect(page.getByText('New', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();

    // Kopie: Kopfzeile nennt die Vorlage.
    await page.getByRole('button', { name: 'Copy profile Standard' }).click();
    await expect(page.getByRole('heading', { name: 'Copy of Standard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible();
  });

  test('copies a profile as a template and saves it as a new one', async ({ page }) => {
    await page.getByRole('button', { name: 'Copy profile Standard' }).click();

    // Der Editor steht auf einer Kopie: freier Name, Inhalte des Originals.
    await expect(page.getByLabel('Name')).toHaveValue('Standard (copy)');
    await expect(page.getByText('Angular (2-22)')).toBeVisible();
    await expect(page.getByText('React')).toBeVisible();
    // Kein Re-Analyse-Panel — die Kopie existiert noch nicht.
    await expect(page.getByRole('button', { name: 'Score' })).toHaveCount(0);

    // Nur den Unterschied einspielen …
    await page.getByLabel('Name').fill('Standard ohne React');

    // … und „Anlegen" schickt POST, überschreibt nicht das Original (PUT).
    const created = page.waitForRequest((request) => request.url().endsWith('/api/profiles') && request.method() === 'POST');
    await page.getByRole('button', { name: 'Create' }).click();
    const request = await created;

    expect(request.postDataJSON()).toMatchObject({
      name: 'Standard ohne React',
      role: 'Frontend Architect / Angular Lead / Coach',
      skills: { frontend: ['Angular (2-22)', 'TypeScript'] },
      strongSignals: ['Angular', 'Agentic'],
      weakSignals: ['React'],
    });

    // Nach dem Anlegen bearbeitet der Editor das neue Profil — kein zweites Anlegen.
    await expect(page.getByRole('heading', { name: 'Standard ohne React' })).toBeVisible();
    await expect(page.getByText('Editing')).toBeVisible();
  });

  test('counts up the copy name when it is already taken', async ({ page }) => {
    // Profilnamen sind in der DB unique — der Vorschlag muss frei sein. Die spätere
    // Route verdeckt die aus mockApi; danach die Profilseite direkt aufrufen.
    await page.route('**/api/profiles', (route) =>
      route.fulfill({ json: [STANDARD, { ...STANDARD, id: 2, name: 'Standard (copy)', active: false }] }),
    );
    await page.goto('/profil');

    // Die Liste ist nach Namen sortiert, das Original steht also vor seiner Kopie.
    await page.getByRole('button', { name: 'Copy profile Standard' }).first().click();

    await expect(page.getByLabel('Name')).toHaveValue('Standard (copy 2)');
  });

  test('creates a new profile with a skill chip', async ({ page }) => {
    await page.getByRole('button', { name: 'New profile' }).click();
    await page.getByLabel('Name').fill('Fullstack');
    await page.getByLabel('Frontend', { exact: true }).fill('Angular');
    await page.getByLabel('Frontend', { exact: true }).press('Enter');

    const created = page.waitForRequest((request) => request.url().endsWith('/api/profiles') && request.method() === 'POST');
    await page.getByRole('button', { name: 'Create' }).click();
    const request = await created;

    expect(request.postDataJSON()).toMatchObject({ name: 'Fullstack', skills: { frontend: ['Angular'] } });
  });
});
