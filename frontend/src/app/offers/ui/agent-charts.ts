import { Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { ChartModule } from 'primeng/chart';

import { axisOptions, PALETTE } from './chart-theme';
import { DailyAverages, NamedCount, scoreTier } from '../util/offer-stats';

/**
 * Die 4 Auswertungs-Charts der Agenten-Analyse — alle Daten sind bereits auf den
 * gewählten Suchagenten gefiltert. Das Histogramm nutzt die Status-Farben der Score-Ampel.
 */
@Component({
  selector: 'app-agent-charts',
  imports: [TranslocoDirective, ChartModule],
  template: `
    <ng-container *transloco="let t">
      <div class="grid gap-4 md:grid-cols-2">
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.scoreTrend') }}</figcaption>
          <p-chart type="line" [data]="scoreTrendData()" [options]="scoreTrendOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.scores') }}</figcaption>
          <p-chart type="bar" [data]="histogramData()" [options]="barOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.topSkills') }}</figcaption>
          <p-chart type="bar" [data]="skillData()" [options]="horizontalBarOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.topGaps') }}</figcaption>
          <p-chart type="bar" [data]="gapData()" [options]="horizontalBarOptions()" height="16rem" />
        </figure>
      </div>
    </ng-container>
  `,
})
export class AgentCharts {
  readonly scoreTrend = input.required<DailyAverages>();
  readonly skills = input.required<NamedCount[]>();
  readonly gaps = input.required<NamedCount[]>();
  readonly histogram = input.required<number[]>();
  readonly greenThreshold = input.required<number>();
  readonly yellowThreshold = input.required<number>();
  /** Von der Seite durchgereicht (ThemeStore) — reine Präsentationskomponente, kein eigener Service. */
  readonly dark = input.required<boolean>();

  private readonly palette = computed(() => (this.dark() ? PALETTE.dark : PALETTE.light));

  protected readonly scoreTrendData = computed(() => {
    const palette = this.palette();
    return {
      labels: this.scoreTrend().labels,
      datasets: [
        {
          data: this.scoreTrend().averages,
          borderColor: palette.series1,
          backgroundColor: palette.series1,
          pointRadius: 3,
          tension: 0.3,
          // Tage ohne analysierte Angebote sind null — die Linie überbrückt sie statt abzureißen.
          spanGaps: true,
        },
      ],
    };
  });

  protected readonly skillData = computed(() => ({
    labels: this.skills().map((skill) => skill.name),
    datasets: [{ data: this.skills().map((skill) => skill.count), backgroundColor: this.palette().series1, borderRadius: 4 }],
  }));

  protected readonly gapData = computed(() => ({
    labels: this.gaps().map((gap) => gap.name),
    datasets: [{ data: this.gaps().map((gap) => gap.count), backgroundColor: this.palette().series2, borderRadius: 4 }],
  }));

  // Buckets tragen die Ampel-Semantik: Status-Farben nach der jeweiligen Schwelle.
  protected readonly histogramData = computed(() => {
    const palette = this.palette();
    const colors = Array.from({ length: 10 }, (_, i) => palette[scoreTier(i * 10, this.greenThreshold(), this.yellowThreshold())]);
    return {
      labels: Array.from({ length: 10 }, (_, i) => `${i * 10}–${i === 9 ? 100 : i * 10 + 9}`),
      datasets: [{ data: this.histogram(), backgroundColor: colors, borderRadius: 4 }],
    };
  });

  protected readonly barOptions = computed(() => axisOptions(this.palette(), 'x'));
  protected readonly horizontalBarOptions = computed(() => axisOptions(this.palette(), 'y'));
  // Der Score-Trend bekommt eine feste 0–100-Werteachse, damit die Linie nicht relativ überzeichnet.
  protected readonly scoreTrendOptions = computed(() => axisOptions(this.palette(), 'x', 100));
}
