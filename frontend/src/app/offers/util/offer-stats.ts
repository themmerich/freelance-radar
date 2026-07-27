/**
 * Reine Aggregationen für KPI-Kacheln und Charts. Alle Funktionen erwarten die
 * bereits auf primäre Einträge gefilterte Liste — Kopien anderer Agenten zählen
 * in keiner Auswertung doppelt (wie in v1).
 */

/**
 * Feste Reihenfolge der Quellen. Einzige Quelle der Wahrheit: `countBySource`
 * liefert die Zahlen in dieser Folge, Chart-Labels und Spaltenfilter müssen
 * dieselbe benutzen — sonst zeigt das Doughnut-Chart Zahlen unter falschen Labels.
 */
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

type StatsOffer = {
  receivedAt: string;
  sourceType: SourceType;
  agentName: string | null;
  remote: RemoteType | null;
  matchScore: number | null;
  skills: { name: string; gap: boolean }[];
};

export type DailyCounts = { labels: string[]; counts: number[] };
export type NamedCount = { name: string; count: number };
/** Ø Match-Score pro Suchagent — nur analysierte Angebote fließen ein. */
export type AgentScore = { name: string; averageScore: number };
/** Ø Match-Score pro Tag; Tage ohne analysierte Angebote sind `null` (Lücke im Linien-Chart). */
export type DailyAverages = { labels: string[]; averages: (number | null)[] };
export type Kpis = {
  today: number;
  last7Days: number;
  last30Days: number;
  /** Ø Match-Score über analysierte Angebote; null solange nichts analysiert ist. */
  averageScore: number | null;
  /** Anteil 🟢 (Score ≥ Schwelle) in Prozent; null solange nichts analysiert ist. */
  greenShare: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Index des Angebots im Tagesfenster ab `start`; außerhalb liegende Werte fallen aus [0, days). */
function dayIndex(offer: StatsOffer, start: number): number {
  return Math.floor((startOfDay(new Date(offer.receivedAt)).getTime() - start) / DAY_MS);
}

function dayLabels(start: number, days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start + i * DAY_MS);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
  });
}

/** Angebote pro Tag über die letzten `days` Tage (älteste zuerst, Lücken = 0). */
export function offersPerDay(offers: StatsOffer[], days: number, today: Date): DailyCounts {
  const start = startOfDay(today).getTime() - (days - 1) * DAY_MS;
  const counts = new Array<number>(days).fill(0);
  for (const offer of offers) {
    const index = dayIndex(offer, start);
    if (index >= 0 && index < days) {
      counts[index] += 1;
    }
  }
  return { labels: dayLabels(start, days), counts };
}

/** Ø Match-Score pro Tag über die letzten `days` Tage (älteste zuerst, gerundet). */
export function averageScorePerDay(offers: StatsOffer[], days: number, today: Date): DailyAverages {
  const start = startOfDay(today).getTime() - (days - 1) * DAY_MS;
  const sums = new Array<number>(days).fill(0);
  const counts = new Array<number>(days).fill(0);
  for (const offer of offers) {
    if (offer.matchScore === null) {
      continue;
    }
    const index = dayIndex(offer, start);
    if (index >= 0 && index < days) {
      sums[index] += offer.matchScore;
      counts[index] += 1;
    }
  }
  const averages = counts.map((count, i) => (count === 0 ? null : Math.round(sums[i] / count)));
  return { labels: dayLabels(start, days), averages };
}

/** Verteilung Agent/Privat/Newsletter/Sonstiges in fester Reihenfolge. */
export function countBySource(offers: StatsOffer[]): number[] {
  return SOURCE_TYPE_ORDER.map((source) => offers.filter((offer) => offer.sourceType === source).length);
}

/** Verteilung Remote/Hybrid/Vor Ort in fester Reihenfolge; letzter Eintrag = nicht erkannt. */
export function countByRemote(offers: StatsOffer[]): number[] {
  const counts = REMOTE_ORDER.map((remote) => offers.filter((offer) => offer.remote === remote).length);
  return [...counts, offers.filter((offer) => offer.remote === null).length];
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
    averageScore,
    greenShare,
  };
}
