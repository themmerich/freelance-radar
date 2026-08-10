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
  matchScore: number | null;
  skills: { name: string; gap: boolean }[];
};

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
export type Kpis = {
  today: number;
  last7Days: number;
  last30Days: number;
  /** Alle analysierten Angebote ohne Zeitfenster — Kopien anderer Agenten zählen wie überall nicht mit. */
  total: number;
  /** Ø Match-Score über analysierte Angebote; null solange nichts analysiert ist. */
  averageScore: number | null;
  /** Anteil 🟢 (Score ≥ Schwelle) in Prozent; null solange nichts analysiert ist. */
  greenShare: number | null;
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

/** Ø Match-Score je Bucket über das Fenster (ältester zuerst, gerundet). */
export function averageScorePerBucket(offers: StatsOffer[], range: TimeRange, today: Date): BucketedAverages {
  const bucket = bucketFor(range);
  const start = rangeStart(offers, range, today);
  const count = bucketCount(start, range, today);
  const sums = new Array<number>(count).fill(0);
  const counts = new Array<number>(count).fill(0);
  for (const offer of offers) {
    if (offer.matchScore === null) {
      continue;
    }
    const index = bucketIndex(offer, start, bucket);
    if (index >= 0 && index < count) {
      sums[index] += offer.matchScore;
      counts[index] += 1;
    }
  }
  return {
    labels: bucketLabels(start, count, bucket),
    averages: counts.map((value, i) => (value === 0 ? null : Math.round(sums[i] / value))),
  };
}

/** Verteilung Remote/Hybrid/Vor Ort in fester Reihenfolge; letzter Eintrag = nicht erkannt. */
export function countByRemote(offers: StatsOffer[]): number[] {
  const counts = REMOTE_ORDER.map((remote) => offers.filter((offer) => offer.remote === remote).length);
  return [...counts, offers.filter((offer) => offer.remote === null).length];
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

export function kpis(offers: StatsOffer[], greenThreshold: number, today: Date): Kpis {
  const todayStart = startOfDay(today).getTime();
  const inWindow = (offer: StatsOffer, days: number): boolean =>
    startOfDay(new Date(offer.receivedAt)).getTime() >= todayStart - (days - 1) * DAY_MS;

  const analyzed = offers.filter((offer) => offer.matchScore !== null);
  const averageScore =
    analyzed.length === 0 ? null : Math.round(analyzed.reduce((sum, offer) => sum + (offer.matchScore ?? 0), 0) / analyzed.length);
  const greenShare =
    analyzed.length === 0
      ? null
      : Math.round((analyzed.filter((offer) => (offer.matchScore ?? 0) >= greenThreshold).length / analyzed.length) * 100);

  return {
    today: offers.filter((offer) => inWindow(offer, 1)).length,
    last7Days: offers.filter((offer) => inWindow(offer, 7)).length,
    last30Days: offers.filter((offer) => inWindow(offer, 30)).length,
    total: analyzed.length,
    averageScore,
    greenShare,
  };
}
