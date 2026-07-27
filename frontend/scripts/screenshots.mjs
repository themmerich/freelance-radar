/**
 * Erzeugt die README-Screenshots aus *synthetischen* Daten.
 *
 * Bewusst nicht gegen die echte Datenbank: dort stehen reale Firmennamen und
 * Projektausschreibungen aus dem Postfach — die haben in einem öffentlichen Repo
 * nichts zu suchen. Stattdessen wird die API im Browser gemockt (wie in den e2e-
 * Tests), damit die Bilder reproduzierbar und unbedenklich sind.
 *
 *   pnpm screenshots            # gegen einen laufenden Dev-Server auf :4200
 *   SCREENSHOT_URL=http://localhost:4300 pnpm screenshots
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const BASE_URL = process.env.SCREENSHOT_URL ?? 'http://localhost:4200';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'screenshots');
const VIEWPORT = { width: 1440, height: 900 };

const AGENTS = ['Angular', 'Java Spring', 'AI', 'Architekt', 'Design System'];
const COMPANIES = ['Nordlicht Software GmbH', 'Baltic Digital AG', 'Rheinwerk Consulting', 'Alpenblick IT', 'Hansa Systems GmbH'];
const TITLES = [
  'Senior Angular Entwickler',
  'Frontend Architekt Design System',
  'Java Backend Entwickler (Spring Boot)',
  'Fullstack Entwickler Angular/Java',
  'KI-Engineer LLM-Integration',
  'Angular Entwickler Barrierefreiheit',
  'Solution Architect Cloud',
  'Frontend Lead Enterprise Portal',
];
const SKILLS = ['Angular', 'TypeScript', 'Java', 'Spring Boot', 'Kubernetes', 'AWS', 'NgRx', 'Kotlin', 'Docker', 'REST'];
const GAP_SKILLS = ['C#', 'OpenShift', 'React', 'Python', '.NET'];
const LOCATIONS = ['Hamburg', 'München', 'Berlin', 'Frankfurt', 'Wien', 'Zürich'];
const REMOTE = ['REMOTE', 'HYBRID', 'ONSITE'];
const COUNTRIES = ['DE', 'DE', 'DE', 'AT', 'CH'];

/** Deterministischer PRNG — gleiche Eingabe, gleiche Bilder. */
function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildOffers() {
  const random = mulberry32(42);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const offers = [];

  for (let i = 0; i < 64; i++) {
    // Über die letzten 30 Tage streuen, mit Schwerpunkt auf den jüngeren Tagen.
    const daysAgo = Math.floor(random() * random() * 30);
    const receivedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - Math.floor(random() * 12) * 3600 * 1000);
    // Die Suchagenten dominieren, daneben ein paar Direktanfragen und Rauschen —
    // sonst ist das Quellen-Donut einfarbig.
    const sourceType = pick(['AGENT', 'AGENT', 'AGENT', 'AGENT', 'AGENT', 'AGENT', 'PRIVATE', 'PRIVATE', 'NEWSLETTER', 'OTHER']);
    const agentName = sourceType === 'AGENT' ? pick(AGENTS) : null;
    // Der eigene Stack trifft besser als Fremd-Stacks — gibt dem Score je Agent Kontur.
    const affinity = agentName === 'Angular' || agentName === 'Design System' ? 20 : 0;
    const matchScore = Math.min(100, Math.max(5, Math.round(30 + affinity + random() * 50)));

    offers.push({
      id: i + 1,
      receivedAt: receivedAt.toISOString(),
      fromAddr: sourceType === 'AGENT' ? 'office@freelancermap.de' : 'kontakt@recruiting.de',
      subject: agentName === null ? 'Projektanfrage' : `${agentName} - Anzahl neue Projekte: 1`,
      sourceType,
      agentName,
      projectTitle: pick(TITLES),
      company: pick(COMPANIES),
      role: 'Entwickler',
      location: pick(LOCATIONS),
      country: pick(COUNTRIES),
      remote: pick(REMOTE),
      rate: random() > 0.8 ? `${85 + Math.floor(random() * 30)},00 €/h` : null,
      startDate: '09/2026',
      duration: random() > 0.5 ? '6 Monate' : null,
      projectUrl: `https://www.freelancermap.de/nproj/30269${i}.html`,
      matchScore,
      matchReason:
        matchScore >= 70
          ? 'Kern-Stack trifft das Profil, remote-freundliches Enterprise-Umfeld.'
          : 'Teilweise passend — Schwerpunkt liegt neben dem Profil.',
      seniority: random() > 0.4 ? 'senior' : 'mid',
      industry: random() > 0.7 ? 'Banking' : 'unbekannt',
      primary: random() > 0.2,
      dupCount: random() > 0.75 ? 2 : 1,
      status: 'ANALYZED',
      skills: [
        { name: pick(SKILLS), gap: false },
        { name: pick(SKILLS), gap: false },
        { name: pick(GAP_SKILLS), gap: true },
      ],
    });
  }
  return offers.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

const OFFERS = buildOffers();

const PROFILES = [
  { id: 1, name: 'Frontend Architect & Angular Lead', role: 'Frontend Architect / Angular Lead / Coach', active: true },
  { id: 2, name: 'Senior Angular Frontend', role: 'Senior Frontend Entwickler', active: false },
  { id: 3, name: 'Java & Spring Backend', role: 'Backend Entwickler', active: false },
].map((profile) => ({
  ...profile,
  focus: 'Agentic UI / AI Engineering',
  industries: 'Banking, Insurance',
  region: 'DACH, remote',
  languages: 'Deutsch, Englisch',
  skills: { frontend: ['Angular (2-22)', 'TypeScript'], backend: ['Java', 'Spring Boot'], ai_agentic: ['Spring AI'] },
  strongSignals: ['Angular', 'Agentic'],
  weakSignals: ['React'],
}));

const LATEST_RUN = {
  id: 12,
  ranAt: new Date().toISOString(),
  newOffers: 7,
  totalSeen: 9,
  analyzedOffers: 7,
  inputTokens: 9800,
  outputTokens: 1400,
  note: null,
};

const RUNS = [
  LATEST_RUN,
  { id: 11, ranAt: daysAgo(2), newOffers: 12, totalSeen: 14, analyzedOffers: 12, inputTokens: 16400, outputTokens: 2300, note: null },
  { id: 10, ranAt: daysAgo(5), newOffers: 9, totalSeen: 11, analyzedOffers: 9, inputTokens: 12100, outputTokens: 1750, note: null },
  { id: 9, ranAt: daysAgo(12), newOffers: 21, totalSeen: 24, analyzedOffers: 21, inputTokens: 28900, outputTokens: 4100, note: null },
];

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function mockApi(page) {
  await page.route('**/api/profiles', (route) => route.fulfill({ json: PROFILES }));
  await page.route('**/api/profiles/*', (route) => route.fulfill({ json: PROFILES[0] }));
  await page.route('**/api/offers', (route) => route.fulfill({ json: OFFERS }));
  await page.route('**/api/runs/latest', (route) => route.fulfill({ json: LATEST_RUN }));
  await page.route('**/api/runs', (route) => route.fulfill({ json: RUNS }));
  await page.route('**/api/analyses/preview**', (route) =>
    route.fulfill({ json: { candidates: 18, estimatedInputTokens: 14400, estimatedOutputTokens: 3060 } }),
  );
}

/** Chart.js animiert beim ersten Zeichnen — kurz warten, sonst sind die Balken halb hoch. */
async function shoot(page, path, { fullPage = false, viewport } = {}) {
  if (viewport) {
    await page.setViewportSize(viewport);
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT_DIR, path), fullPage });
  console.log(`✓ ${path}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: 'light', deviceScaleFactor: 2 });
  const page = await context.newPage();
  await mockApi(page);

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  } catch (error) {
    await browser.close();
    console.error(`Dev-Server unter ${BASE_URL} nicht erreichbar — erst \`pnpm start\` starten.`);
    throw error;
  }

  await page.waitForSelector('canvas');
  await shoot(page, 'dashboard.png', { fullPage: true });

  // Breiter, damit die Tabelle nicht mitten in den Spalten abgeschnitten wird.
  await page.getByRole('link', { name: 'Offers' }).click();
  await page.waitForSelector('table');
  await shoot(page, 'offers.png', { viewport: { width: 1920, height: 1000 } });

  // Flacher: unter dem Dialog stünde sonst die halbe Seite leer.
  await page.getByRole('link', { name: 'Profiles' }).click();
  await page.getByRole('button', { name: 'Score offers against profile Frontend Architect & Angular Lead' }).click();
  await page.waitForSelector('[role="dialog"]');
  await shoot(page, 'profiles.png', { viewport: { width: 1440, height: 680 } });

  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Costs' }).click();
  await page.waitForSelector('table');
  await shoot(page, 'costs.png', { viewport: { width: 1440, height: 640 } });

  await browser.close();
}

await main();
