import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { TableModule } from 'primeng/table';

/** The shape `cost-table` needs to render — a presentational contract, domain-free. */
export type CostRow = {
  id: number;
  ranAt: string;
  analyzedOffers: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
};

const ROWS_PER_PAGE = 10;
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

@Component({
  selector: 'app-cost-table',
  imports: [DatePipe, DecimalPipe, TranslocoDirective, TableModule],
  template: `
    <ng-container *transloco="let t">
      <p-table
        [value]="runs()"
        [sortField]="'ranAt'"
        [sortOrder]="-1"
        dataKey="id"
        [paginator]="true"
        [rows]="rowsPerPage"
        [rowsPerPageOptions]="rowsPerPageOptions"
        [showCurrentPageReport]="true"
        [currentPageReportTemplate]="t('offers.table.pageReport')"
      >
        <ng-template #header>
          <tr>
            <th pSortableColumn="ranAt" scope="col">{{ t('costs.table.ranAt') }} <p-sort-icon field="ranAt" /></th>
            <th pSortableColumn="analyzedOffers" scope="col">{{ t('costs.table.analyzed') }} <p-sort-icon field="analyzedOffers" /></th>
            <th pSortableColumn="inputTokens" scope="col">{{ t('costs.table.inputTokens') }} <p-sort-icon field="inputTokens" /></th>
            <th pSortableColumn="outputTokens" scope="col">{{ t('costs.table.outputTokens') }} <p-sort-icon field="outputTokens" /></th>
            <th pSortableColumn="costCents" scope="col">{{ t('costs.table.cost') }} <p-sort-icon field="costCents" /></th>
          </tr>
        </ng-template>
        <ng-template #body let-run>
          <tr>
            <td class="whitespace-nowrap">{{ run.ranAt | date: 'dd.MM.yyyy HH:mm' }}</td>
            <td>{{ run.analyzedOffers }}</td>
            <td>{{ run.inputTokens }}</td>
            <td>{{ run.outputTokens }}</td>
            <td>≈{{ run.costCents | number: '1.1-2' }} ct</td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="5">{{ t('costs.empty') }}</td>
          </tr>
        </ng-template>
      </p-table>
    </ng-container>
  `,
})
export class CostTable {
  readonly runs = input.required<CostRow[]>();

  protected readonly rowsPerPage = ROWS_PER_PAGE;
  protected readonly rowsPerPageOptions = ROWS_PER_PAGE_OPTIONS;
}
