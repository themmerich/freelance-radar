import { Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { AverageWithCount } from '../util/offer-stats';

/**
 * Marktkennzahlen des gewählten Zeitraums: Ø Stundensatz, Ø Laufzeit, Ø Remote-Anteil.
 *
 * Jede Zahl trägt ihre Fallzahl. Nicht jedes Projekt nennt einen Satz — ein „Ø 83 €" ohne
 * „aus 31 Angeboten" würde eine Marktaussage vortäuschen, die die Datenlage nicht hergibt.
 * Ohne Werte steht hier „—" und keine 0.
 *
 * Anders als die KPI-Kacheln folgt diese Zeile dem Zeitraum-Umschalter.
 */
@Component({
  selector: 'app-market-stats',
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <dl class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        @for (stat of stats(); track stat.label) {
          <div class="flex flex-col gap-1 rounded border border-surface-200 p-3 dark:border-surface-700">
            <dt class="text-sm text-surface-600 dark:text-surface-300">{{ t(stat.label) }}</dt>
            <dd class="flex items-baseline gap-2">
              <span class="text-xl font-semibold">{{ stat.value }}</span>
              @if (stat.count > 0) {
                <span class="text-sm text-surface-500 dark:text-surface-400">{{ t('offers.market.basis', { count: stat.count }) }}</span>
              }
            </dd>
          </div>
        }
      </dl>
    </ng-container>
  `,
})
export class MarketStats {
  readonly rate = input.required<AverageWithCount>();
  readonly duration = input.required<AverageWithCount>();
  readonly remote = input.required<AverageWithCount>();

  private readonly transloco = inject(TranslocoService);

  protected readonly stats = computed(() => [
    {
      label: 'offers.market.rate',
      value: format(this.rate(), (value) => this.transloco.translate('offers.table.ratePerHour', { rate: Math.round(value) })),
      count: this.rate().count,
    },
    {
      label: 'offers.market.duration',
      // Eine Nachkommastelle, deutsches Dezimalkomma — 8,8 statt 8.8.
      value: format(this.duration(), (value) =>
        this.transloco.translate('offers.table.durationMonths', { months: value.toFixed(1).replace('.', ',') }),
      ),
      count: this.duration().count,
    },
    { label: 'offers.market.remote', value: format(this.remote(), (value) => `${Math.round(value)} %`), count: this.remote().count },
  ]);
}

function format(stat: AverageWithCount, render: (value: number) => string): string {
  return stat.average === null ? '—' : render(stat.average);
}
