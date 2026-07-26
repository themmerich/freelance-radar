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
  matchScore: number | null;
  skills: { name: string; gap: boolean }[];
};

export type DailyCounts = { labels: string[]; counts: number[] };
export type NamedCount = { name: string; count: number };
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

/** Angebote pro Tag über die letzten `days` Tage (älteste zuerst, Lücken = 0). */
export function offersPerDay(offers: StatsOffer[], days: number, today: Date): DailyCounts {
  const start = startOfDay(today).getTime() - (days - 1) * DAY_MS;
  const counts = new Array<number>(days).fill(0);
  for (const offer of offers) {
    const index = Math.floor((startOfDay(new Date(offer.receivedAt)).getTime() - start) / DAY_MS);
    if (index >= 0 && index < days) {
      counts[index] += 1;
    }
  }
  const labels = Array.from({ length: days }, (_, i) => {
    const d = new Date(start + i * DAY_MS);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
  });
  return { labels, counts };
}

/** Verteilung Agent/Privat/Newsletter/Sonstiges in fester Reihenfolge. */
export function countBySource(offers: StatsOffer[]): number[] {
  return SOURCE_TYPE_ORDER.map((source) => offers.filter((offer) => offer.sourceType === source).length);
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
