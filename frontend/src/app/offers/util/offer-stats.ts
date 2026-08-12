/**
 * Reine Aggregationen für KPI-Kacheln und Charts. Alle Funktionen erwarten die
 * bereits auf primäre Einträge gefilterte Liste — Kopien anderer Agenten zählen
 * in keiner Auswertung doppelt (wie in v1).
 */

/** Feste Reihenfolge der Quellen — der Spaltenfilter der Angebotstabelle baut darauf auf. */
export const SOURCE_TYPE_ORDER = ['AGENT', 'PRIVATE', 'NEWSLETTER', 'OTHER'] as const;

export type SourceType = (typeof SOURCE_TYPE_ORDER)[number];

/** Feste Reihenfolge der Remote-Stufen — gleiche Regel wie `SOURCE_TYPE_ORDER`. */
export const REMOTE_ORDER = ['REMOTE', 'HYBRID', 'ONSITE'] as const;

export type RemoteType = (typeof REMOTE_ORDER)[number];

/** Feste Reihenfolge der Seniority-Stufen — die fünf Werte, die der Analyse-Prompt vorgibt (`ClaudeOfferAnalyzer`). */
export const SENIORITY_ORDER = ['junior', 'mid', 'senior', 'lead', 'architect'] as const;

/** Ländergruppen des Einsatzland-Charts — der DACH-Markt ist das Zielgebiet, alles andere zählt als „Andere". */
export const COUNTRY_GROUPS = ['DE', 'AT', 'CH'] as const;

/** Ampel-Stufe eines Match-Scores (🟢/🟡/🔴) — Tabelle und Histogramm teilen die Regel. */
export type ScoreTier = 'good' | 'warning' | 'critical';

export function scoreTier(score: number, greenThreshold: number, yellowThreshold: number): ScoreTier {
  if (score >= greenThreshold) {
    return 'good';
  }
  return score >= yellowThreshold ? 'warning' : 'critical';
}

/**
 * Cluster der angefragten Berufsprofile. Die Analyse liefert `role` als Freitext
 * („Senior Java Fullstack", „Full-Stack Software Engineer (React/Java)") — gemessen an
 * echten Daten ergaben 173 Angebote rund 145 verschiedene Schreibweisen, ein Ranking auf
 * den Rohwerten wäre wertlos. Deshalb Schlüsselwörter statt Rohwerte.
 *
 * Die Reihenfolge ist zugleich die Prüfreihenfolge: **der erste Treffer gewinnt**. Deshalb
 * steht ARCHITECT vor FULLSTACK („Fullstack Software-Architekt" ist eine Architektenrolle)
 * und AI_DATA vor den Stack-Clustern („Senior AI Software Engineer — Full-Stack" zählt als
 * KI-Rolle, das ist die Marktbewegung, die interessiert).
 */
const ROLE_RULES = [
  { category: 'ARCHITECT', contains: ['architekt', 'architect'] },
  { category: 'AI_DATA', contains: ['künstliche intelligenz', 'machine learning', 'copilot', 'data'], words: ['ki', 'ai', 'ml', 'llm'] },
  { category: 'FULLSTACK', contains: ['fullstack', 'full stack'] },
  { category: 'FRONTEND', contains: ['frontend', 'front end', 'angular', 'react', 'vue'] },
  { category: 'BACKEND', contains: ['backend', 'back end'] },
  { category: 'DEVOPS_CLOUD', contains: ['devops', 'cloud', 'plattform', 'platform', 'kubernetes', 'administrator'] },
  { category: 'TEST_QA', contains: ['test', 'quality'], words: ['qa', 'sdet'] },
  { category: 'UX_DESIGN', contains: ['design'], words: ['ux', 'ui'] },
  { category: 'MOBILE_EMBEDDED', contains: ['android', 'ios', 'mobile', 'embedded', 'flutter'] },
  { category: 'MANAGEMENT', contains: ['projektleit', 'product owner', 'manager', 'management', 'scrum', 'moderation', 'trainer'] },
  { category: 'CONSULTANT', contains: ['consultant', 'berater', 'spezialist', 'expert'] },
  { category: 'DEVELOPMENT', contains: ['entwickl', 'developer', 'engineer', 'software'] },
] as const;

/** Alle Cluster inklusive der Auffangkategorie für alles, was keine Regel trifft. */
export type RoleCategory = (typeof ROLE_RULES)[number]['category'] | 'OTHER';

/** Alle Cluster in Regelreihenfolge — die Filter-Auswahl der Angebotstabelle baut darauf auf. */
export const ROLE_CATEGORY_ORDER: readonly RoleCategory[] = [...ROLE_RULES.map((rule) => rule.category), 'OTHER'];

export type RoleCount = { category: RoleCategory; count: number };

type StatsOffer = {
  receivedAt: string;
  sourceType: SourceType;
  agentName: string | null;
  remote: RemoteType | null;
  role: string | null;
  /** Seniority-Stufe aus der Analyse; erwartet werden die Werte aus `SENIORITY_ORDER`. */
  seniority: string | null;
  /** ISO-3166-Code des Einsatzlandes (DE/AT/CH, ...), von der Analyse abgeleitet. */
  country: string | null;
  matchScore: number | null;
  skills: { name: string; gap: boolean }[];
  /** Rohwert des Budget-Badges der Projektseite; nur mit `budgetKind` zu lesen. */
  budgetEur: number | null;
  budgetKind: BudgetKind | null;
  durationMonths: number | null;
  remotePercent: number | null;
};

/** Einordnung des Budget-Betrags; Stundensatz-Auswertungen zählen ausschließlich `HOURLY`. */
export type BudgetKind = 'HOURLY' | 'DAILY' | 'TOTAL';

/** Kennzahl samt der Fallzahl, auf der sie steht — ohne die wäre ein Ø über 31 Werte irreführend. */
export type AverageWithCount = { average: number | null; count: number };

/** Auswertungsfenster des Dashboards — der Umschalter über den Tabs setzt es. */
export type TimeRange = '30d' | '90d' | '12m' | 'all';
/** Auflösung der Zeitreihen; hängt fest am Fenster, siehe `BUCKET_PER_RANGE`. */
export type Bucket = 'day' | 'week' | 'month';
/** Zählung je Bucket plus deren Schnitt über das gesamte Fenster (eine Nachkommastelle). */
export type BucketedCounts = { labels: string[]; counts: number[]; average: number };
/** Ø Match-Score je Bucket; Buckets ohne analysierte Angebote sind `null` (Lücke im Linien-Chart). */
export type BucketedAverages = { labels: string[]; averages: (number | null)[] };

export type NamedCount = { name: string; count: number };
/** Ø Match-Score pro Suchagent — nur analysierte Angebote fließen ein. */
export type AgentScore = { name: string; averageScore: number };
/**
 * Kennzahl samt Veränderung zur gleich langen Vorperiode.
 *
 * `value` ist null, wenn das Fenster keine Grundlage hat (nichts analysiert); `delta` ist null,
 * wenn kein ehrlicher Vergleich möglich ist — die drei Fälle stehen bei `trend`.
 */
export type Trend = { value: number | null; delta: number | null };

/**
 * Was gemessen wird, plus die Einheit der Differenz: Zählungen liest man relativ („+12 %"),
 * Score und Anteil absolut (Punkte bzw. Prozentpunkte). Ein „+10 %" auf einen Prozentwert
 * wäre zweideutig — Anteil der Angebote oder Anteil des Anteils?
 */
export type Metric = { measure: (offers: StatsOffer[]) => number | null; delta: 'relative' | 'absolute' };

export type Kpis = {
  today: number;
  last7Days: Trend;
  last30Days: Trend;
  /** Alle analysierten Angebote ohne Zeitfenster — Kopien anderer Agenten zählen wie überall nicht mit. */
  total: number;
  /** Ø Match-Score der letzten 30 Tage; null solange darin nichts analysiert ist. */
  averageScore: Trend;
  /** Anteil 🟢 (Score ≥ Schwelle) der letzten 30 Tage in Prozent; null solange darin nichts analysiert ist. */
  greenShare: Trend;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const BUCKET_PER_RANGE: Record<TimeRange, Bucket> = { '30d': 'day', '90d': 'week', '12m': 'month', all: 'month' };

export function bucketFor(range: TimeRange): Bucket {
  return BUCKET_PER_RANGE[range];
}

/** Wochen beginnen montags — `getDay()` zählt ab Sonntag, deshalb der Versatz. */
function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7));
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfBucket(date: Date, bucket: Bucket): Date {
  if (bucket === 'week') {
    return startOfWeek(date);
  }
  return bucket === 'month' ? startOfMonth(date) : startOfDay(date);
}

/**
 * Beginn des ältesten Buckets im Fenster. Der laufende Tag/die laufende Woche/der laufende
 * Monat zählt mit, ist also angeschnitten — dieselbe Konvention wie bei den KPI-Fenstern.
 * Datumsarithmetik statt Millisekunden, damit Sommerzeitwechsel nicht um eine Stunde verrutschen.
 */
function rangeStart(offers: StatsOffer[], range: TimeRange, today: Date): Date {
  switch (range) {
    case '30d': {
      const day = startOfDay(today);
      return new Date(day.getFullYear(), day.getMonth(), day.getDate() - 29);
    }
    case '90d': {
      const week = startOfWeek(today);
      return new Date(week.getFullYear(), week.getMonth(), week.getDate() - 12 * 7);
    }
    case '12m':
      return new Date(today.getFullYear(), today.getMonth() - 11, 1);
    case 'all': {
      const oldest = offers.reduce<number | null>((min, offer) => {
        const time = new Date(offer.receivedAt).getTime();
        return min === null || time < min ? time : min;
      }, null);
      // Ohne Angebote bleibt der laufende Monat als einziger Bucket stehen.
      return startOfMonth(oldest === null ? today : new Date(oldest));
    }
  }
}

function bucketCount(start: Date, range: TimeRange, today: Date): number {
  switch (range) {
    case '30d':
      return 30;
    case '90d':
      return 13;
    case '12m':
      return 12;
    case 'all':
      return (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()) + 1;
  }
}

/** Index des Angebots im Fenster; außerhalb liegende Werte fallen aus [0, count). */
function bucketIndex(offer: StatsOffer, start: Date, bucket: Bucket): number {
  const received = startOfBucket(new Date(offer.receivedAt), bucket);
  if (bucket === 'month') {
    return (received.getFullYear() - start.getFullYear()) * 12 + (received.getMonth() - start.getMonth());
  }
  // Gerundet, weil ein Tag über den Sommerzeitwechsel 23 bzw. 25 Stunden hat.
  return Math.round((received.getTime() - start.getTime()) / DAY_MS / (bucket === 'week' ? 7 : 1));
}

function bucketLabels(start: Date, count: number, bucket: Bucket): string[] {
  return Array.from({ length: count }, (_, i) => {
    if (bucket === 'month') {
      const month = new Date(start.getFullYear(), start.getMonth() + i, 1);
      return `${String(month.getMonth() + 1).padStart(2, '0')}.${String(month.getFullYear()).slice(2)}`;
    }
    // Wochen tragen das Datum ihres Montags — die Auflösung steht im Chart-Titel.
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * (bucket === 'week' ? 7 : 1));
    return `${String(day.getDate()).padStart(2, '0')}.${String(day.getMonth() + 1).padStart(2, '0')}.`;
  });
}

/**
 * Schneidet die Angebote auf das Fenster zu — der eine Filter, aus dem alle Charts rechnen.
 * Benutzt denselben Start wie die Buckets, sonst widersprächen sich Verteilungen und Zeitreihe.
 */
export function withinRange(offers: StatsOffer[], range: TimeRange, today: Date): StatsOffer[] {
  if (range === 'all') {
    return offers;
  }
  const start = rangeStart(offers, range, today).getTime();
  return offers.filter((offer) => new Date(offer.receivedAt).getTime() >= start);
}

/** Angebote je Bucket über das Fenster (ältester zuerst, Lücken = 0) samt Schnitt je Bucket. */
export function offersPerBucket(offers: StatsOffer[], range: TimeRange, today: Date): BucketedCounts {
  const bucket = bucketFor(range);
  const start = rangeStart(offers, range, today);
  const count = bucketCount(start, range, today);
  const counts = new Array<number>(count).fill(0);
  for (const offer of offers) {
    const index = bucketIndex(offer, start, bucket);
    if (index >= 0 && index < count) {
      counts[index] += 1;
    }
  }
  const total = counts.reduce((sum, value) => sum + value, 0);
  return { labels: bucketLabels(start, count, bucket), counts, average: Math.round((total / count) * 10) / 10 };
}

/**
 * Ø eines Angebotswerts je Bucket über das Fenster (ältester zuerst, gerundet) — der Wert
 * kommt über den Selektor: Match-Score im Agenten-Tab, Remote-Prozent im Remote-Trend.
 * Buckets ohne Werte bleiben `null` (Lücke im Linien-Chart).
 */
export function averagePerBucket(
  offers: StatsOffer[],
  value: (offer: StatsOffer) => number | null,
  range: TimeRange,
  today: Date,
): BucketedAverages {
  const bucket = bucketFor(range);
  const start = rangeStart(offers, range, today);
  const count = bucketCount(start, range, today);
  const sums = new Array<number>(count).fill(0);
  const counts = new Array<number>(count).fill(0);
  for (const offer of offers) {
    const offerValue = value(offer);
    if (offerValue === null) {
      continue;
    }
    const index = bucketIndex(offer, start, bucket);
    if (index >= 0 && index < count) {
      sums[index] += offerValue;
      counts[index] += 1;
    }
  }
  return {
    labels: bucketLabels(start, count, bucket),
    averages: counts.map((countInBucket, i) => (countInBucket === 0 ? null : Math.round(sums[i] / countInBucket))),
  };
}

/**
 * Klassengrenzen der drei Verteilungen. Die Randklassen sind bewusst offen, damit kein Wert
 * lautlos herausfällt — `upTo: null` bedeutet „alles darüber".
 */
const DURATION_CLASSES = [
  { label: '≤ 3', upTo: 3 },
  { label: '4–6', upTo: 6 },
  { label: '7–12', upTo: 12 },
  { label: '> 12', upTo: null },
] as const;

const RATE_CLASSES = [
  { label: '< 60', upTo: 59 },
  { label: '60–79', upTo: 79 },
  { label: '80–99', upTo: 99 },
  { label: '100–119', upTo: 119 },
  { label: '≥ 120', upTo: null },
] as const;

const REMOTE_CLASSES = [
  { label: '0 %', upTo: 0 },
  { label: '1–49 %', upTo: 49 },
  { label: '50–99 %', upTo: 99 },
  { label: '100 %', upTo: null },
] as const;

/** Stundensätze der Angebote — Tagessätze und Gesamtbudgets bleiben bewusst außen vor. */
export function hourlyRates(offers: StatsOffer[]): number[] {
  return offers.filter((offer) => offer.budgetKind === 'HOURLY' && offer.budgetEur !== null).map((offer) => offer.budgetEur ?? 0);
}

export function durations(offers: StatsOffer[]): number[] {
  return offers.filter((offer) => offer.durationMonths !== null).map((offer) => offer.durationMonths ?? 0);
}

export function remotePercents(offers: StatsOffer[]): number[] {
  return offers.filter((offer) => offer.remotePercent !== null).map((offer) => offer.remotePercent ?? 0);
}

/** Schnitt samt Fallzahl; ohne Werte `null` statt `0` — eine 0 wäre eine Aussage, die niemand getroffen hat. */
export function averageWithCount(values: number[]): AverageWithCount {
  if (values.length === 0) {
    return { average: null, count: 0 };
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return { average: sum / values.length, count: values.length };
}

function classify(values: number[], classes: readonly { label: string; upTo: number | null }[]): NamedCount[] {
  const counts = classes.map((entry) => ({ name: entry.label, count: 0 }));
  for (const value of values) {
    const index = classes.findIndex((entry) => entry.upTo === null || value <= entry.upTo);
    counts[index].count += 1;
  }
  return counts;
}

export function durationBuckets(offers: StatsOffer[]): NamedCount[] {
  return classify(durations(offers), DURATION_CLASSES);
}

export function rateBuckets(offers: StatsOffer[]): NamedCount[] {
  return classify(hourlyRates(offers), RATE_CLASSES);
}

export function remotePercentBuckets(offers: StatsOffer[]): NamedCount[] {
  return classify(remotePercents(offers), REMOTE_CLASSES);
}

/**
 * Verteilung der Seniority-Stufen in fester Reihenfolge; letzter Eintrag = unbekannt.
 * Werte außerhalb der Prompt-Liste zählen ebenfalls als unbekannt, statt still
 * herauszufallen — sollte der Prompt je abweichen, wird das im Chart sichtbar.
 */
export function countBySeniority(offers: StatsOffer[]): number[] {
  const counts = SENIORITY_ORDER.map((level) => offers.filter((offer) => offer.seniority === level).length);
  const known = counts.reduce((sum, count) => sum + count, 0);
  return [...counts, offers.length - known];
}

/** Verteilung DE/AT/CH/Andere/Unbekannt — feste Gruppen, damit Exoten mit einem Treffer keinen langen Schwanz bilden. */
export function countByCountryGroup(offers: StatsOffer[]): number[] {
  const counts = COUNTRY_GROUPS.map((code) => offers.filter((offer) => offer.country === code).length);
  const unknown = offers.filter((offer) => offer.country === null).length;
  const other = offers.length - unknown - counts.reduce((sum, count) => sum + count, 0);
  return [...counts, other, unknown];
}

/**
 * Rollenbezeichnung auf Vergleichbares reduzieren: klein schreiben und alles außer
 * Buchstaben/Ziffern zu Leerzeichen — so werden „Full-Stack", „Full Stack" und
 * „Fullstack (m/w/d)" vergleichbar.
 */
function normalizeRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/[^a-zäöüß0-9]+/g, ' ')
    .trim();
}

/**
 * Ordnet eine Rollenbezeichnung einem Cluster zu; ohne Treffer `OTHER`.
 *
 * `contains` prüft auf Teilstrings — nötig für deutsche Komposita („Plattformingenieur",
 * „Softwareentwickler"). `words` prüft nur ganze Wörter und ist den kurzen Kürzeln
 * vorbehalten, die sonst in fremden Wörtern stecken: „ai" in „Trainer", „ki" in „Skills".
 */
export function roleCategory(role: string): RoleCategory {
  const normalized = normalizeRole(role);
  const words = new Set(normalized.split(' '));
  for (const rule of ROLE_RULES) {
    const hasPart = rule.contains.some((part) => normalized.includes(part));
    const hasWord = 'words' in rule && rule.words.some((word) => words.has(word));
    if (hasPart || hasWord) {
      return rule.category;
    }
  }
  return 'OTHER';
}

/**
 * Ranking der angefragten Berufsprofile, absteigend. Angebote ohne Rollenangabe bleiben
 * außen vor — eine fehlende Rolle ist kein nachgefragtes Profil.
 */
export function countByRoleCategory(offers: StatsOffer[]): RoleCount[] {
  const counts = new Map<RoleCategory, number>();
  for (const offer of offers) {
    if (offer.role === null || offer.role.trim() === '') {
      continue;
    }
    const category = roleCategory(offer.role);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
}

/** Trigger pro Suchagent, absteigend sortiert. */
export function triggersPerAgent(offers: StatsOffer[]): NamedCount[] {
  const counts = new Map<string, number>();
  for (const offer of offers) {
    if (offer.sourceType === 'AGENT' && offer.agentName) {
      counts.set(offer.agentName, (counts.get(offer.agentName) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

/** Ø Match-Score pro Suchagent (nur analysierte Agent-Angebote), absteigend nach Score. */
export function averageScorePerAgent(offers: StatsOffer[]): AgentScore[] {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const offer of offers) {
    if (offer.sourceType === 'AGENT' && offer.agentName && offer.matchScore !== null) {
      const entry = totals.get(offer.agentName) ?? { sum: 0, count: 0 };
      entry.sum += offer.matchScore;
      entry.count += 1;
      totals.set(offer.agentName, entry);
    }
  }
  return [...totals.entries()]
    .map(([name, { sum, count }]) => ({ name, averageScore: Math.round(sum / count) }))
    .sort((a, b) => b.averageScore - a.averageScore);
}

/** Top nachgefragte Skills (alle) bzw. Top Skill-Gaps (`gapsOnly`). */
export function topSkills(offers: StatsOffer[], limit: number, gapsOnly: boolean): NamedCount[] {
  const counts = new Map<string, NamedCount>();
  for (const offer of offers) {
    for (const skill of offer.skills) {
      if (gapsOnly && !skill.gap) {
        continue;
      }
      const key = skill.name.toLowerCase();
      const entry = counts.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        counts.set(key, { name: skill.name, count: 1 });
      }
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Match-Score-Verteilung in 10er-Buckets (0–9 … 90–100; 100 zählt in den letzten). */
export function scoreHistogram(offers: StatsOffer[]): number[] {
  const buckets = new Array<number>(10).fill(0);
  for (const offer of offers) {
    if (offer.matchScore !== null) {
      buckets[Math.min(9, Math.floor(offer.matchScore / 10))] += 1;
    }
  }
  return buckets;
}

function analyzedOffers(offers: StatsOffer[]): StatsOffer[] {
  return offers.filter((offer) => offer.matchScore !== null);
}

/** Ø Match-Score, ungerundet; null solange nichts analysiert ist — eine 0 wäre eine Aussage, die niemand getroffen hat. */
function averageScoreOf(offers: StatsOffer[]): number | null {
  const analyzed = analyzedOffers(offers);
  return analyzed.length === 0 ? null : analyzed.reduce((sum, offer) => sum + (offer.matchScore ?? 0), 0) / analyzed.length;
}

/** Anteil 🟢 in Prozent, ungerundet; null nach derselben Regel wie `averageScoreOf`. */
function greenShareOf(offers: StatsOffer[], greenThreshold: number): number | null {
  const analyzed = analyzedOffers(offers);
  return analyzed.length === 0
    ? null
    : (analyzed.filter((offer) => (offer.matchScore ?? 0) >= greenThreshold).length / analyzed.length) * 100;
}

export const OFFER_COUNT: Metric = { measure: (offers) => offers.length, delta: 'relative' };

export const AVERAGE_SCORE: Metric = { measure: averageScoreOf, delta: 'absolute' };

/** Der 🟢-Anteil hängt an der einstellbaren Ampel-Schwelle und kann deshalb keine Konstante sein. */
export function greenShareMetric(greenThreshold: number): Metric {
  return { measure: (offers) => greenShareOf(offers, greenThreshold), delta: 'absolute' };
}

/** Datumsarithmetik statt Millisekunden, damit Sommerzeitwechsel die Fenstergrenze nicht verschieben. */
function shiftDays(day: Date, days: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - days);
}

/** Angebote, deren Empfangstag in [start, end] liegt — beide Grenzen zählen mit. */
function receivedBetween(offers: StatsOffer[], start: Date, end: Date): StatsOffer[] {
  return offers.filter((offer) => {
    const day = startOfDay(new Date(offer.receivedAt)).getTime();
    return day >= start.getTime() && day <= end.getTime();
  });
}

/** Tag des ältesten Angebots — der einzige Beleg dafür, ab wann überhaupt gesammelt wurde. */
function oldestDay(offers: StatsOffer[]): Date | null {
  return offers.reduce<Date | null>((oldest, offer) => {
    const day = startOfDay(new Date(offer.receivedAt));
    return oldest === null || day.getTime() < oldest.getTime() ? day : oldest;
  }, null);
}

function round(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}

/** Erst die Differenz wird gerundet — sonst summierten sich zwei Rundungsfehler im Delta. */
function deltaOf(current: number | null, previous: number | null, unit: Metric['delta']): number | null {
  if (current === null || previous === null) {
    return null;
  }
  if (unit === 'absolute') {
    return Math.round(current - previous);
  }
  return previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
}

/**
 * Kennzahl über die letzten `days` Tage samt Veränderung zur gleich langen Vorperiode
 * (heute zählt mit, wie bei allen Fenstern der Anwendung).
 *
 * Das Delta bleibt `null`, wo ein Vergleich nichts über den Markt aussagen würde:
 *
 * 1. Das älteste Angebot liegt nach dem Beginn der Vorperiode — dann misst das Delta den Aufbau
 *    der Sammlung, nicht den Markt.
 * 2. Die Vorperiode hat keine Grundlage (nichts analysiert).
 * 3. Eine relative Änderung müsste durch null teilen.
 *
 * `offers` ist der gesamte Bestand, nicht ein Fenster daraus — Fall 1 braucht ihn ungeschnitten.
 */
export function trend(offers: StatsOffer[], days: number, metric: Metric, today: Date): Trend {
  const end = startOfDay(today);
  const current = metric.measure(receivedBetween(offers, shiftDays(end, days - 1), end));
  const previousStart = shiftDays(end, 2 * days - 1);
  const oldest = oldestDay(offers);

  if (oldest === null || oldest.getTime() > previousStart.getTime()) {
    return { value: round(current), delta: null };
  }

  const previous = metric.measure(receivedBetween(offers, previousStart, shiftDays(end, days)));
  return { value: round(current), delta: deltaOf(current, previous, metric.delta) };
}

export function kpis(offers: StatsOffer[], greenThreshold: number, today: Date): Kpis {
  const todayStart = startOfDay(today).getTime();

  return {
    today: offers.filter((offer) => startOfDay(new Date(offer.receivedAt)).getTime() >= todayStart).length,
    last7Days: trend(offers, 7, OFFER_COUNT, today),
    last30Days: trend(offers, 30, OFFER_COUNT, today),
    total: analyzedOffers(offers).length,
    averageScore: trend(offers, 30, AVERAGE_SCORE, today),
    greenShare: trend(offers, 30, greenShareMetric(greenThreshold), today),
  };
}
