import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
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
  remote: 'REMOTE' | 'HYBRID' | 'ONSITE' | null;
  /** Wie viele Agenten dasselbe Projekt eingefangen haben (1 = keine Kopien). */
  dupCount: number;
  projectUrl: string | null;
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
  imports: [DatePipe, TranslocoDirective, TableModule, TagModule],
  template: `
    <ng-container *transloco="let t">
      <p-table [value]="offers()" [sortField]="'receivedAt'" [sortOrder]="-1" dataKey="id">
        <ng-template #header>
          <tr>
            <th pSortableColumn="receivedAt" scope="col">{{ t('offers.table.received') }} <p-sort-icon field="receivedAt" /></th>
            <th pSortableColumn="sourceType" scope="col">{{ t('offers.table.source') }} <p-sort-icon field="sourceType" /></th>
            <th pSortableColumn="agentName" scope="col">{{ t('offers.table.agent') }} <p-sort-icon field="agentName" /></th>
            <th scope="col">{{ t('offers.table.title') }}</th>
            <th scope="col">{{ t('offers.table.company') }}</th>
            <th scope="col">{{ t('offers.table.location') }}</th>
            <th scope="col">{{ t('offers.table.remote') }}</th>
            <th scope="col">{{ t('offers.table.status') }}</th>
          </tr>
        </ng-template>
        <ng-template #body let-offer>
          <tr>
            <td class="whitespace-nowrap">{{ offer.receivedAt | date: 'dd.MM.yyyy HH:mm' }}</td>
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
            <td>{{ offer.location ?? '—' }}</td>
            <td>{{ offer.remote ? t('offers.remote.' + offer.remote) : '—' }}</td>
            <td>{{ t('offers.status.' + offer.status) }}</td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="8">{{ t('offers.empty') }}</td>
          </tr>
        </ng-template>
      </p-table>
    </ng-container>
  `,
})
export class OfferTable {
  readonly offers = input.required<OfferRow[]>();

  protected severity(sourceType: OfferRow['sourceType']): 'info' | 'success' | 'secondary' {
    return SOURCE_SEVERITY[sourceType];
  }
}
