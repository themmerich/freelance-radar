import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { ROLE_CATEGORY_ORDER, RoleCategory, SOURCE_TYPE_ORDER, SourceType, scoreTier } from '../util/offer-stats';

/** The shape `offer-table` needs to render — a presentational contract, domain-free. */
export type OfferRow = {
  id: number;
  receivedAt: string;
  sourceType: SourceType;
  agentName: string | null;
  title: string | null;
  /** Rollenbezeichnung, wie die Analyse sie aus der Mail gezogen hat. */
  role: string | null;
  /** Cluster der Rollenbezeichnung; null, wenn keine Rolle erkannt wurde. */
  roleCategory: RoleCategory | null;
  company: string | null;
  location: string | null;
  /** ISO-3166-Code des Einsatzlandes (DE/AT/CH, ...). */
  country: string | null;
  remote: 'REMOTE' | 'HYBRID' | 'ONSITE' | null;
  /** Wie viele Agenten dasselbe Projekt eingefangen haben (1 = keine Kopien). */
  dupCount: number;
  projectUrl: string | null;
  matchScore: number | null;
  matchReason: string | null;
  /** Rohtext der Startangabe aus der Mail — Rückfall, wenn die Projektseite keine nennt. */
  startDate: string | null;
  /** Rohwert des Budget-Badges; die Satz-Spalte zeigt ihn nur bei `budgetKind === 'HOURLY'`. */
  budgetEur: number | null;
  budgetKind: 'HOURLY' | 'DAILY' | 'TOTAL' | null;
  durationMonths: number | null;
  utilizationPercent: number | null;
  remotePercent: number | null;
  startMonth: string | null;
  startImmediate: boolean;
  skills: { name: string; gap: boolean }[];
  status: 'NEW' | 'ANALYZED' | 'ERROR';
};

const SOURCE_SEVERITY = {
  AGENT: 'info',
  PRIVATE: 'success',
  NEWSLETTER: 'secondary',
  OTHER: 'secondary',
} as const;

const TIER_SEVERITY = {
  good: 'success',
  warning: 'warn',
  critical: 'danger',
} as const;

const REMOTE_MODES: NonNullable<OfferRow['remote']>[] = ['REMOTE', 'HYBRID', 'ONSITE'];
const STATUSES: OfferRow['status'][] = ['NEW', 'ANALYZED', 'ERROR'];

const ROWS_PER_PAGE = 10;
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

@Component({
  selector: 'app-offer-table',
  imports: [DatePipe, TranslocoDirective, ButtonModule, TableModule, TagModule],
  templateUrl: './offer-table.html',
})
export class OfferTable {
  readonly offers = input.required<OfferRow[]>();
  /** Ampel-Schwellen (v1-Defaults 🟢 ≥ 70, 🟡 ≥ 40), im Dashboard einstellbar. */
  readonly greenThreshold = input(70);
  readonly yellowThreshold = input(40);

  protected readonly rowsPerPage = ROWS_PER_PAGE;
  protected readonly rowsPerPageOptions = ROWS_PER_PAGE_OPTIONS;
  protected readonly sourceTypes = SOURCE_TYPE_ORDER;
  protected readonly roleCategories = ROLE_CATEGORY_ORDER;
  protected readonly remoteModes = REMOTE_MODES;
  protected readonly statuses = STATUSES;

  /** Auswahl des Länderfilters — nur Länder, die in den Angeboten vorkommen. */
  protected readonly countries = computed(() =>
    [...new Set(this.offers().flatMap((offer) => (offer.country ? [offer.country] : [])))].sort((a, b) => a.localeCompare(b)),
  );

  /**
   * Wert eines Filter-`<select>` für PrimeNG aufbereiten: „Alle" ist ein leerer
   * Options-Wert, muss aber als `null` zurückgehen — auf `''` würde PrimeNG
   * sonst alle Zeilen wegfiltern, statt den Filter zu entfernen.
   */
  protected selectedFilter(event: Event): string | null {
    const value = (event.target as HTMLSelectElement).value;
    return value === '' ? null : value;
  }

  protected severity(sourceType: OfferRow['sourceType']): 'info' | 'success' | 'secondary' {
    return SOURCE_SEVERITY[sourceType];
  }

  /** Ampel-Stufe → PrimeNG-Severity; die Schwellen-Regel selbst liegt in `offer-stats`. */
  protected scoreSeverity(score: number): 'success' | 'warn' | 'danger' {
    return TIER_SEVERITY[scoreTier(score, this.greenThreshold(), this.yellowThreshold())];
  }

  /** DE neutral, AT/CH als DACH-Nachbarn hervorgehoben, alles andere deutlich markiert. */
  protected countrySeverity(country: string): 'secondary' | 'info' | 'warn' {
    if (country === 'DE') {
      return 'secondary';
    }
    return country === 'AT' || country === 'CH' ? 'info' : 'warn';
  }

  /** ISO-Code → Flaggen-Emoji über die Unicode-Regionalindikatoren (DE → 🇩🇪). */
  protected flag(country: string): string {
    return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  }
}
