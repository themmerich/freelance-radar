/** Lauf-Protokoll wie vom Backend geliefert (auch Re-Analyse-Läufe landen hier). */
export type Run = {
  id: number;
  ranAt: string;
  newOffers: number;
  totalSeen: number;
  analyzedOffers: number;
  inputTokens: number;
  outputTokens: number;
  note: string | null;
};
