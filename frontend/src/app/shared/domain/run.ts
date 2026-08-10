/**
 * Protokoll eines Laufs wie vom Backend geliefert (`/api/runs`, `RunResponse`) —
 * Abruf-Läufe wie Re-Analyse-Läufe. Liegt im Shared Kernel, weil beide Kontexte
 * (offers, profiles) denselben Vertrag lesen.
 */
export type Run = {
  id: number;
  ranAt: string;
  newOffers: number;
  totalSeen: number;
  analyzedOffers: number;
  /** Abgerufene Projekt-Detailseiten; ein Lauf ohne neue Mails arbeitet oft nur diese Warteschlange ab. */
  detailsFetched: number;
  detailsFailed: number;
  inputTokens: number;
  outputTokens: number;
  note: string | null;
};
