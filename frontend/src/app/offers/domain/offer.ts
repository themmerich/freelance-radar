/** Über welchen Kanal die Mail hereinkam — Suchagent, private Anfrage oder Rauschen. */
export type SourceType = 'AGENT' | 'PRIVATE' | 'NEWSLETTER' | 'OTHER';

/** Remote-Anteil des Angebots, sofern aus der Mail erkennbar. */
export type Remote = 'REMOTE' | 'HYBRID' | 'ONSITE';

/**
 * Wie die Budget-Angabe eines Projekts zu lesen ist. Die Projektseite beziffert das Budget
 * ohne Einheit; unterschieden wird an der Größenordnung, deshalb zählen Auswertungen über
 * Stundensätze ausschließlich `HOURLY`.
 */
export type BudgetKind = 'HOURLY' | 'DAILY' | 'TOTAL';

/** Verarbeitungsstatus: NEW wartet auf die Claude-Analyse. */
export type OfferStatus = 'NEW' | 'ANALYZED' | 'ERROR';

/** Ein nachgefragtes Skill; `gap` = fehlt im Profil. */
export type OfferSkill = {
  name: string;
  gap: boolean;
};

/** Ein Projektangebot, wie es das Backend unter `/api/offers` liefert. */
export type Offer = {
  id: number;
  receivedAt: string;
  fromAddr: string | null;
  subject: string | null;
  sourceType: SourceType;
  agentName: string | null;
  projectTitle: string | null;
  company: string | null;
  role: string | null;
  location: string | null;
  /** ISO-3166-Code des Einsatzlandes (DE/AT/CH, ...), von der Analyse abgeleitet. */
  country: string | null;
  remote: Remote | null;
  /** Rohtext der Startangabe aus der Mail — einzige Quelle, wenn die Projektseite keine nennt. */
  startDate: string | null;
  projectUrl: string | null;
  /** Rohwert des Budget-Badges der Projektseite; wie er zu lesen ist, sagt `budgetKind`. */
  budgetEur: number | null;
  budgetKind: BudgetKind | null;
  durationMonths: number | null;
  utilizationPercent: number | null;
  remotePercent: number | null;
  startMonth: string | null;
  startImmediate: boolean;
  matchScore: number | null;
  matchReason: string | null;
  seniority: string | null;
  industry: string | null;
  primary: boolean;
  dupCount: number;
  status: OfferStatus;
  skills: OfferSkill[];
};
