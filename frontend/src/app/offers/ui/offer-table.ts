import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

/** The shape `offer-table` needs to render — a presentational contract, domain-free. */
export type OfferRow = {
  id: number;
  receivedAt: string;
  sourceType: 'AGENT' | 'PRIVATE' | 'NEWSLETTER' | 'OTHER';
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

@Component({
  selector: 'app-offer-table',
  imports: [DatePipe, TranslocoDirective, ButtonModule, TableModule, TagModule],
  template: `
    <ng-container *transloco="let t">
      <p-table [value]="offers()" [sortField]="'receivedAt'" [sortOrder]="-1" dataKey="id">
        <ng-template #header>
          <tr>
            <th scope="col" class="w-12">
              <span class="sr-only">{{ t('offers.table.details') }}</span>
            </th>
            <th pSortableColumn="receivedAt" scope="col">{{ t('offers.table.received') }} <p-sort-icon field="receivedAt" /></th>
            <th pSortableColumn="matchScore" scope="col">{{ t('offers.table.score') }} <p-sort-icon field="matchScore" /></th>
            <th pSortableColumn="sourceType" scope="col">{{ t('offers.table.source') }} <p-sort-icon field="sourceType" /></th>
            <th pSortableColumn="agentName" scope="col">{{ t('offers.table.agent') }} <p-sort-icon field="agentName" /></th>
            <th scope="col">{{ t('offers.table.title') }}</th>
            <th scope="col">{{ t('offers.table.company') }}</th>
            <th pSortableColumn="country" scope="col">{{ t('offers.table.country') }} <p-sort-icon field="country" /></th>
            <th scope="col">{{ t('offers.table.location') }}</th>
            <th scope="col">{{ t('offers.table.remote') }}</th>
            <th scope="col">{{ t('offers.table.status') }}</th>
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

  protected severity(sourceType: OfferRow['sourceType']): 'info' | 'success' | 'secondary' {
    return SOURCE_SEVERITY[sourceType];
  }

  protected scoreSeverity(score: number): 'success' | 'warn' | 'danger' {
    if (score >= this.greenThreshold()) {
      return 'success';
    }
    return score >= this.yellowThreshold() ? 'warn' : 'danger';
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
