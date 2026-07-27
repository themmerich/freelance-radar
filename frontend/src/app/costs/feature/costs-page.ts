import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { CostsStore } from '../data-access/costs-store';
import { runCostCents } from '../../shared/util/run-cost';
import { CostRow, CostTable } from '../ui/cost-table';

const LAST_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-costs-page',
  imports: [DecimalPipe, TranslocoDirective, CardModule, ProgressSpinnerModule, CostTable],
  template: `
    <main class="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <ng-container *transloco="let t">
        <p-card>
          <div class="flex flex-col gap-6">
            @if (store.isLoading()) {
              <p-progress-spinner [style]="{ width: '2rem', height: '2rem' }" [ariaLabel]="t('costs.title')" />
            } @else if (store.hasError()) {
              <p class="text-red-500">{{ t('offers.loadError') }}</p>
            } @else {
              <div class="flex flex-wrap gap-4">
                <div class="flex min-w-40 flex-col gap-1 rounded-lg border border-surface-200 p-4 dark:border-surface-700">
                  <span class="text-sm text-surface-600 dark:text-surface-300">{{ t('costs.total') }}</span>
                  <span class="text-xl font-semibold">≈{{ totalCostCents() | number: '1.1-2' }} ct</span>
                </div>
                <div class="flex min-w-40 flex-col gap-1 rounded-lg border border-surface-200 p-4 dark:border-surface-700">
                  <span class="text-sm text-surface-600 dark:text-surface-300">{{ t('costs.last7Days') }}</span>
                  <span class="text-xl font-semibold">≈{{ last7DaysCostCents() | number: '1.1-2' }} ct</span>
                </div>
              </div>

              <app-cost-table [runs]="rows()" />
            }
          </div>
        </p-card>
      </ng-container>
    </main>
  `,
})
export class CostsPage {
  protected readonly store = inject(CostsStore);

  protected readonly rows = computed<CostRow[]>(() =>
    this.store.runs().map((run) => ({
      id: run.id,
      ranAt: run.ranAt,
      analyzedOffers: run.analyzedOffers,
      inputTokens: run.inputTokens,
      outputTokens: run.outputTokens,
      costCents: runCostCents(run.inputTokens, run.outputTokens),
    })),
  );

  protected readonly totalCostCents = computed(() => this.rows().reduce((sum, row) => sum + row.costCents, 0));

  protected readonly last7DaysCostCents = computed(() => {
    const cutoff = Date.now() - LAST_DAYS * MS_PER_DAY;
    return this.rows()
      .filter((row) => new Date(row.ranAt).getTime() >= cutoff)
      .reduce((sum, row) => sum + row.costCents, 0);
  });
}
