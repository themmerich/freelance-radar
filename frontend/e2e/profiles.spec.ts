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
  // PUT geht an /api/profiles/{id}, nicht an /api/profiles selbst — ohne eigene Route
  // landet der Request auf dem SPA-Fallback (Produktions-Build), der Editor bliebe stumm.
  await page.route('**/api/profiles/*', (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ json: { ...STANDARD, ...route.request().postDataJSON() } });
    }
    return route.fulfill({ json: STANDARD });
  });
  await page.route('**/api/analyses/preview**', (route) =>
    route.fulfill({ json: { candidates: 5, estimatedInputTokens: 4000, estimatedOutputTokens: 850 } }),
  );
  await page.route('**/api/analyses', (route) => route.fulfill({ status: 201, json: REANALYSIS_RUN }));
  // Die App-Shell (Glocke, Profil-Umschalter) hängt global an OffersStore und läuft auf
  // JEDER Seite mit — ohne Mock landen diese Requests auf dem SPA-Fallback (Produktions-
  // Build) statt auf JSON, httpResource wirft dann beim Lesen und reißt die ganze Seite mit.
  await page.route('**/api/offers', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/runs/latest', (route) => route.fulfill({ status: 204 }));
}

test.describe('Profiles page e2e', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await page.getByRole('link', { name: 'Profiles' }).click();
  });

  test('lists the profiles and opens one in the editor', async ({ page }) => {
    // Nicht getByText('Standard'): der globale Profil-Umschalter in der Topbar
    // listet denselben Namen als <option>, das wäre mehrdeutig.
    await expect(page.getByRole('button', { name: /^Standard/ })).toBeVisible();

    // Anker am Zeilenanfang: „Copy profile Standard" enthält den Namen ebenfalls.
    await page.getByRole('button', { name: /^Standard/ }).click();

    await expect(page.getByLabel('Name')).toHaveValue('Standard');
    await expect(page.getByText('Angular (2-22)')).toBeVisible();
    await expect(page.getByText('React')).toBeVisible();
  });

  test('locks deletion of the last profile and deletes any other', async ({ page }) => {
    // Nur ein Profil vorhanden: Löschen bleibt gesperrt, es muss immer eines geben.
    await expect(page.getByRole('button', { name: 'Delete profile Standard' })).toBeDisabled();

    // Mit einem zweiten Profil ist auch das aktive löschbar — das Backend aktiviert dann ein anderes.
    await page.route('**/api/profiles', (route) =>
      route.fulfill({ json: [STANDARD, { ...STANDARD, id: 2, name: 'Fullstack', active: false }] }),
    );
    await page.goto('/profil');

    const deleted = page.waitForRequest((request) => request.url().endsWith('/api/profiles/1') && request.method() === 'DELETE');
    await page.getByRole('button', { name: 'Delete profile Standard' }).click();

    await deleted;
  });

  test('shows the cost preview and scores the entire backlog after a warning', async ({ page }) => {
    await page.getByRole('button', { name: 'Score offers against profile Standard' }).click();

    const dialog = page.getByRole('dialog', { name: 'Score · Standard' });
    // 4000 Input- + 850 Output-Tokens auf Haiku ≈ 0,83 ct
    await expect(dialog.getByText('5 offers open')).toBeVisible();
    await expect(dialog.getByText('≈0.83 ct')).toBeVisible();

    // Der gesamte Bestand ist vorausgewählt und läuft ohne Kostendeckel — erst die Warnung.
    await dialog.getByRole('button', { name: 'Score' }).click();
    const confirmation = page.getByRole('dialog', { name: 'Score the entire backlog?' });
    await expect(confirmation.getByText('All 5 open offers')).toBeVisible();

    const scored = page.waitForRequest((request) => request.url().endsWith('/api/analyses') && request.method() === 'POST');
    await confirmation.getByRole('button', { name: 'Score' }).click();
    const request = await scored;

    expect(request.postDataJSON()).toMatchObject({ profileId: 1, days: null, force: false });
    await expect(page.getByText('12 offers re-scored')).toBeVisible();
  });

  test('scores a time window without the warning', async ({ page }) => {
    await page.getByRole('button', { name: 'Score offers against profile Standard' }).click();

    const dialog = page.getByRole('dialog', { name: 'Score · Standard' });
    await dialog.getByLabel('Range').selectOption('30');

    const scored = page.waitForRequest((request) => request.url().endsWith('/api/analyses') && request.method() === 'POST');
    await dialog.getByRole('button', { name: 'Score' }).click();
    const request = await scored;

    // Ein Zeitfenster bleibt gedeckelt, deshalb ohne Rückfrage.
    expect(request.postDataJSON()).toMatchObject({ profileId: 1, days: 30, force: false });
    await expect(page.getByRole('dialog', { name: 'Score the entire backlog?' })).toBeHidden();
  });

  test('marks the editor mode as editing, new, or copy', async ({ page }) => {
    // Das Formular lebt jetzt in einem Dialog — nur einer ist je Modus offen, davor schließen.
    const dialog = page.getByRole('dialog');

    // Bearbeiten: Kopfzeile trägt den Profilnamen, Button speichert.
    await page.getByRole('button', { name: /^Standard/ }).click();
    await expect(dialog.getByRole('heading', { name: 'Standard' })).toBeVisible();
    await expect(dialog.getByText('Editing')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    // Leeres Anlegen.
    await page.getByRole('button', { name: 'New profile' }).click();
    await expect(dialog.getByRole('heading', { name: 'New profile' })).toBeVisible();
    await expect(dialog.getByText('New', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    // Kopie: Kopfzeile nennt die Vorlage.
    await page.getByRole('button', { name: 'Copy profile Standard' }).click();
    await expect(dialog.getByRole('heading', { name: 'Copy of Standard' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create' })).toBeVisible();
  });

  test('copies a profile as a template and saves it as a new one', async ({ page }) => {
    await page.getByRole('button', { name: 'Copy profile Standard' }).click();

    // Der Editor steht auf einer Kopie: freier Name, Inhalte des Originals.
    await expect(page.getByLabel('Name')).toHaveValue('Standard (copy)');
    await expect(page.getByText('Angular (2-22)')).toBeVisible();
    await expect(page.getByText('React')).toBeVisible();

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

  test('discards edits when cancel is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /^Standard/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Focus').fill('Temporary edit');

    const putCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/api/profiles/1') && request.method() === 'PUT') {
        putCalls.push(request.url());
      }
    });
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    // Cancel schließt den Dialog, ohne zu speichern — kein PUT, und beim erneuten Öffnen der alte Stand.
    await expect(dialog).toBeHidden();
    expect(putCalls).toHaveLength(0);

    await page.getByRole('button', { name: /^Standard/ }).click();
    await expect(dialog.getByLabel('Focus')).toHaveValue('Agentic UI / AI Engineering');
  });

  test('prompts to re-score offers after saving a profile change, and toasts the result', async ({ page }) => {
    await page.getByRole('button', { name: /^Standard/ }).click();
    await page.getByLabel('Focus').fill('Agentic UI / AI Engineering, updated');

    await page.getByRole('button', { name: 'Save' }).click();

    // Skopiert auf den Dialog: die persistente Kachel darunter hat ebenfalls einen "Score"-Button.
    const dialog = page.getByRole('dialog', { name: 'Re-score offers?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('The profile changed.')).toBeVisible();

    // Der Dialog fragt per force nach ALLEN Angeboten, nicht nur unbewerteten — 5 laut Mock.
    await dialog.getByRole('button', { name: 'Score' }).click();

    await expect(page.getByText('Re-analysis completed')).toBeVisible();
    await expect(page.getByText('12 offers re-scored')).toBeVisible();
  });

  test('skipping the re-score dialog does not trigger a reanalysis', async ({ page }) => {
    await page.getByRole('button', { name: /^Standard/ }).click();
    await page.getByLabel('Focus').fill('Agentic UI / AI Engineering, updated');
    await page.getByRole('button', { name: 'Save' }).click();

    const dialog = page.getByRole('dialog', { name: 'Re-score offers?' });
    await expect(dialog).toBeVisible();

    const reanalyzeCalls: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('/api/analyses') && request.method() === 'POST') {
        reanalyzeCalls.push(request.url());
      }
    });
    await dialog.getByRole('button', { name: 'Skip' }).click();

    await expect(dialog).toBeHidden();
    expect(reanalyzeCalls).toHaveLength(0);
  });

  test('creates a new profile with a skill chip', async ({ page }) => {
    await page.getByRole('button', { name: 'New profile' }).click();
    // Dialog-Öffnen-Transition abwarten, sonst kann der PrimeNG-Fokus-Trap den
    // gerade fokussierten Input beim Eintreffen des Enter-Keydowns wieder verdrängen.
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.getByLabel('Name').fill('Fullstack');
    await page.getByLabel('Frontend', { exact: true }).fill('Angular');
    await page.getByLabel('Frontend', { exact: true }).press('Enter');

    const created = page.waitForRequest((request) => request.url().endsWith('/api/profiles') && request.method() === 'POST');
    await page.getByRole('button', { name: 'Create' }).click();
    const request = await created;

    expect(request.postDataJSON()).toMatchObject({ name: 'Fullstack', skills: { frontend: ['Angular'] } });
  });
});
