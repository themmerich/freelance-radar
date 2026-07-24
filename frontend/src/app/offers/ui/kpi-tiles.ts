import { Component, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

/** Kennzahlen für die Kachel-Zeile — vom Feature vorberechnet, hier nur Anzeige. */
export type KpiTileData = {
  today: number;
  last7Days: number;
  last30Days: number;
  averageScore: number | null;
  greenShare: number | null;
};

@Component({
  selector: 'app-kpi-tiles',
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        @for (tile of tiles(); track tile.label) {
          <div class="flex flex-col gap-1 rounded border border-surface-200 p-3 dark:border-surface-700">
            <dt class="text-sm text-surface-600 dark:text-surface-300">{{ t(tile.label) }}</dt>
            <dd class="text-2xl font-semibold">{{ tile.value }}</dd>
          </div>
        }
      </dl>
    </ng-container>
  `,
})
export class KpiTiles {
  readonly kpis = input.required<KpiTileData>();

  protected tiles(): { label: string; value: string }[] {
    const kpis = this.kpis();
    return [
      { label: 'offers.kpi.today', value: `${kpis.today}` },
      { label: 'offers.kpi.last7Days', value: `${kpis.last7Days}` },
      { label: 'offers.kpi.last30Days', value: `${kpis.last30Days}` },
      { label: 'offers.kpi.averageScore', value: kpis.averageScore === null ? '—' : `${kpis.averageScore}` },
      { label: 'offers.kpi.greenShare', value: kpis.greenShare === null ? '—' : `${kpis.greenShare} %` },
    ];
  }
}
