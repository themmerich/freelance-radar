/** Über welchen Kanal die Mail hereinkam — Suchagent, private Anfrage oder Rauschen. */
export type SourceType = 'AGENT' | 'PRIVATE' | 'NEWSLETTER' | 'OTHER';

/** Remote-Anteil des Angebots, sofern aus der Mail erkennbar. */
export type Remote = 'REMOTE' | 'HYBRID' | 'ONSITE';

/** Verarbeitungsstatus: NEW wartet auf die Claude-Analyse (Phase 2). */
export type OfferStatus = 'NEW' | 'ANALYZED' | 'ERROR';

/** Ein Projektangebot, wie es das Backend unter `/api/offers` liefert. */
export type Offer = {
  id: number;
  receivedAt: string;
  fromAddr: string | null;
  subject: string | null;
  sourceType: SourceType;
  agentName: string | null;
  projectTitle: string | null;
  role: string | null;
  location: string | null;
  remote: Remote | null;
  rate: string | null;
  startDate: string | null;
  duration: string | null;
  matchScore: number | null;
  matchReason: string | null;
  seniority: string | null;
  industry: string | null;
  primary: boolean;
  dupCount: number;
  status: OfferStatus;
};

/** Protokoll eines Abruf-Laufs (`/api/runs`); Token-Felder werden ab Phase 2 befüllt. */
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
