import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { SOURCE_TYPE_ORDER, SourceType, scoreTier } from '../util/offer-stats';

/** The shape `offer-table` needs to render — a presentational contract, domain-free. */
export type OfferRow = {
  id: number;
  receivedAt: string;
  sourceType: SourceType;
  agentName: string | null;
  title: string | null;
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
  rate: string | null;
  startDate: string | null;
  duration: string | null;
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
  template: `
    <ng-container *transloco="let t">
      <!-- scrollable + tableStyleClass: die 11 Spalten passen nicht in den Container, deshalb horizontal scrollen. -->
      <p-table
        [value]="offers()"
        [sortField]="'receivedAt'"
        [sortOrder]="-1"
        dataKey="id"
        [scrollable]="true"
        tableStyleClass="min-w-[80rem]"
        [paginator]="true"
        [rows]="rowsPerPage"
        [rowsPerPageOptions]="rowsPerPageOptions"
        [showCurrentPageReport]="true"
        [currentPageReportTemplate]="t('offers.table.pageReport')"
      >
        <ng-template #header>
          <tr>
            <th scope="col" class="w-12">
              <span class="sr-only">{{ t('offers.table.details') }}</span>
            </th>
            <th pSortableColumn="receivedAt" scope="col">{{ t('offers.table.received') }} <p-sort-icon field="receivedAt" /></th>

            <th pSortableColumn="matchScore" scope="col">
              <div class="flex items-center gap-1">
                <span>{{ t('offers.table.score') }}</span>
                <p-sort-icon field="matchScore" />
                <p-column-filter
                  type="numeric"
                  field="matchScore"
                  display="menu"
                  matchMode="gte"
                  [showOperator]="false"
                  [showAddButton]="false"
                  [placeholder]="t('offers.table.filterLabel', { column: t('offers.table.score') })"
                />
              </div>
            </th>

            <th pSortableColumn="sourceType" scope="col">
              <div class="flex items-center gap-1">
                <span>{{ t('offers.table.source') }}</span>
                <p-sort-icon field="sourceType" />
                <p-column-filter
                  field="sourceType"
                  display="menu"
                  matchMode="equals"
                  [showMatchModes]="false"
                  [showOperator]="false"
                  [showAddButton]="false"
                  [showApplyButton]="false"
                >
                  <ng-template #filter let-value let-filter="filterCallback">
                    <select
                      class="w-full rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                      [attr.aria-label]="t('offers.table.filterLabel', { column: t('offers.table.source') })"
                      [value]="value ?? ''"
                      (change)="filter(selectedFilter($event))"
                    >
                      <option value="">{{ t('offers.table.filterAll') }}</option>
                      @for (sourceType of sourceTypes; track sourceType) {
                        <option [value]="sourceType">{{ t('offers.source.' + sourceType) }}</option>
                      }
                    </select>
                  </ng-template>
                </p-column-filter>
              </div>
            </th>

            <th pSortableColumn="agentName" scope="col">
              <div class="flex items-center gap-1">
                <span>{{ t('offers.table.agent') }}</span>
                <p-sort-icon field="agentName" />
                <p-column-filter
                  type="text"
                  field="agentName"
                  display="menu"
                  [showOperator]="false"
                  [showAddButton]="false"
                  [placeholder]="t('offers.table.filterLabel', { column: t('offers.table.agent') })"
                />
              </div>
            </th>

            <!-- Die wichtigste Spalte bekommt Mindestbreite, sonst bricht jeder Titel auf drei Zeilen. -->
            <th scope="col" class="min-w-56">
              <div class="flex items-center gap-1">
                <span>{{ t('offers.table.title') }}</span>
                <p-column-filter
                  type="text"
                  field="title"
                  display="menu"
                  [showOperator]="false"
                  [showAddButton]="false"
                  [placeholder]="t('offers.table.filterLabel', { column: t('offers.table.title') })"
                />
              </div>
            </th>

            <th scope="col">
              <div class="flex items-center gap-1">
                <span>{{ t('offers.table.company') }}</span>
                <p-column-filter
                  type="text"
                  field="company"
                  display="menu"
                  [showOperator]="false"
                  [showAddButton]="false"
                  [placeholder]="t('offers.table.filterLabel', { column: t('offers.table.company') })"
                />
              </div>
            </th>

            <th pSortableColumn="country" scope="col">
              <div class="flex items-center gap-1">
                <span>{{ t('offers.table.country') }}</span>
                <p-sort-icon field="country" />
                <p-column-filter
                  field="country"
                  display="menu"
                  matchMode="equals"
                  [showMatchModes]="false"
                  [showOperator]="false"
                  [showAddButton]="false"
                  [showApplyButton]="false"
                >
                  <!-- Länder kommen aus den Daten, nicht aus einer Enum — nur was da ist, ist wählbar. -->
                  <ng-template #filter let-value let-filter="filterCallback">
                    <select
                      class="w-full rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                      [attr.aria-label]="t('offers.table.filterLabel', { column: t('offers.table.country') })"
                      [value]="value ?? ''"
                      (change)="filter(selectedFilter($event))"
                    >
                      <option value="">{{ t('offers.table.filterAll') }}</option>
                      @for (country of countries(); track country) {
                        <option [value]="country">{{ flag(country) }} {{ country }}</option>
                      }
                    </select>
                  </ng-template>
                </p-column-filter>
              </div>
            </th>

            <th scope="col">
              <div class="flex items-center gap-1">
                <span>{{ t('offers.table.location') }}</span>
                <p-column-filter
                  type="text"
                  field="location"
                  display="menu"
                  [showOperator]="false"
                  [showAddButton]="false"
                  [placeholder]="t('offers.table.filterLabel', { column: t('offers.table.location') })"
                />
              </div>
            </th>

            <th scope="col">
              <div class="flex items-center gap-1">
                <span>{{ t('offers.table.remote') }}</span>
                <p-column-filter
                  field="remote"
                  display="menu"
                  matchMode="equals"
                  [showMatchModes]="false"
                  [showOperator]="false"
                  [showAddButton]="false"
                  [showApplyButton]="false"
                >
                  <ng-template #filter let-value let-filter="filterCallback">
                    <select
                      class="w-full rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                      [attr.aria-label]="t('offers.table.filterLabel', { column: t('offers.table.remote') })"
                      [value]="value ?? ''"
                      (change)="filter(selectedFilter($event))"
                    >
                      <option value="">{{ t('offers.table.filterAll') }}</option>
                      @for (remoteMode of remoteModes; track remoteMode) {
                        <option [value]="remoteMode">{{ t('offers.remote.' + remoteMode) }}</option>
                      }
                    </select>
                  </ng-template>
                </p-column-filter>
              </div>
            </th>

            <th scope="col">
              <div class="flex items-center gap-1">
                <span>{{ t('offers.table.status') }}</span>
                <p-column-filter
                  field="status"
                  display="menu"
                  matchMode="equals"
                  [showMatchModes]="false"
                  [showOperator]="false"
                  [showAddButton]="false"
                  [showApplyButton]="false"
                >
                  <ng-template #filter let-value let-filter="filterCallback">
                    <select
                      class="w-full rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                      [attr.aria-label]="t('offers.table.filterLabel', { column: t('offers.table.status') })"
                      [value]="value ?? ''"
                      (change)="filter(selectedFilter($event))"
                    >
                      <option value="">{{ t('offers.table.filterAll') }}</option>
                      @for (status of statuses; track status) {
                        <option [value]="status">{{ t('offers.status.' + status) }}</option>
                      }
                    </select>
                  </ng-template>
                </p-column-filter>
              </div>
            </th>
          </tr>
        </ng-template>
        <ng-template #body let-offer let-expanded="expanded">
          <tr>
            <td>
              <p-button
                type="button"
                [pRowToggler]="offer"
                [text]="true"
                [rounded]="true"
                [icon]="expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
                [ariaLabel]="t('offers.table.details')"
              />
            </td>
            <td class="whitespace-nowrap">{{ offer.receivedAt | date: 'dd.MM.yyyy HH:mm' }}</td>
            <td>
              @if (offer.matchScore !== null) {
                <p-tag [value]="'' + offer.matchScore" [severity]="scoreSeverity(offer.matchScore)" />
              } @else {
                —
              }
            </td>
            <td><p-tag [value]="t('offers.source.' + offer.sourceType)" [severity]="severity(offer.sourceType)" /></td>
            <td>{{ offer.agentName ?? '—' }}</td>
            <td>
              @if (offer.projectUrl) {
                <a [href]="offer.projectUrl" target="_blank" rel="noopener" class="text-primary hover:underline">
                  {{ offer.title ?? '—' }}
                </a>
              } @else {
                {{ offer.title ?? '—' }}
              }
              @if (offer.dupCount > 1) {
                <p-tag class="ml-2" severity="warn" [value]="t('offers.dupBadge', { count: offer.dupCount })" />
              }
            </td>
            <td>{{ offer.company ?? '—' }}</td>
            <td>
              @if (offer.country) {
                <p-tag [value]="flag(offer.country) + ' ' + offer.country" [severity]="countrySeverity(offer.country)" />
              } @else {
                —
              }
            </td>
            <td>{{ offer.location ?? '—' }}</td>
            <td>{{ offer.remote ? t('offers.remote.' + offer.remote) : '—' }}</td>
            <td>{{ t('offers.status.' + offer.status) }}</td>
          </tr>
        </ng-template>
        <ng-template #expandedrow let-offer>
          <tr>
            <td colspan="11">
              <div class="flex flex-col gap-3 p-3">
                @if (offer.matchReason) {
                  <p>{{ offer.matchReason }}</p>
                } @else {
                  <p class="text-surface-500">{{ t('offers.detail.notAnalyzed') }}</p>
                }
                @if (offer.skills.length > 0) {
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-medium">{{ t('offers.detail.skills') }}:</span>
                    @for (skill of offer.skills; track skill.name) {
                      <p-tag [value]="skill.name" [severity]="skill.gap ? 'danger' : 'secondary'" />
                    }
                  </div>
                }
                <dl class="flex flex-wrap gap-x-6 gap-y-1 text-sm text-surface-600 dark:text-surface-300">
                  @if (offer.rate) {
                    <div class="flex gap-1">
                      <dt class="font-medium">{{ t('offers.detail.rate') }}:</dt>
                      <dd>{{ offer.rate }}</dd>
                    </div>
                  }
                  @if (offer.startDate) {
                    <div class="flex gap-1">
                      <dt class="font-medium">{{ t('offers.detail.start') }}:</dt>
                      <dd>{{ offer.startDate }}</dd>
                    </div>
                  }
                  @if (offer.duration) {
                    <div class="flex gap-1">
                      <dt class="font-medium">{{ t('offers.detail.duration') }}:</dt>
                      <dd>{{ offer.duration }}</dd>
                    </div>
                  }
                </dl>
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="11">{{ t('offers.empty') }}</td>
          </tr>
        </ng-template>
      </p-table>
    </ng-container>
  `,
})
export class OfferTable {
  readonly offers = input.required<OfferRow[]>();
  /** Ampel-Schwellen (v1-Defaults 🟢 ≥ 70, 🟡 ≥ 40), im Dashboard einstellbar. */
  readonly greenThreshold = input(70);
  readonly yellowThreshold = input(40);

  protected readonly rowsPerPage = ROWS_PER_PAGE;
  protected readonly rowsPerPageOptions = ROWS_PER_PAGE_OPTIONS;
  protected readonly sourceTypes = SOURCE_TYPE_ORDER;
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
