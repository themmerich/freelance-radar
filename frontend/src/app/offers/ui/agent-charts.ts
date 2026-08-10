import { Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ChartModule } from 'primeng/chart';

import {
  AVERAGE_KEY_PER_BUCKET,
  axisOptions,
  axisOptionsWithLegend,
  PALETTE,
  SCORE_TREND_KEY_PER_BUCKET,
  TITLE_KEY_PER_BUCKET,
} from './chart-theme';
import { Bucket, BucketedAverages, BucketedCounts, NamedCount, scoreTier } from '../util/offer-stats';

/**
 * Die 5 Auswertungs-Charts der Agenten-Analyse — alle Daten sind bereits auf den gewählten
 * Suchagenten und den gewählten Zeitraum gefiltert. Das Histogramm nutzt die Status-Farben
 * der Score-Ampel; die beiden Zeitreihen tragen ihre Auflösung im Titel.
 */
@Component({
  selector: 'app-agent-charts',
  imports: [TranslocoDirective, ChartModule],
  template: `
    <ng-container *transloco="let t">
      <div class="grid gap-4 md:grid-cols-2">
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t(countsTitleKey()) }}</figcaption>
          <p-chart type="bar" [data]="countsData()" [options]="countsOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t(scoreTrendTitleKey()) }}</figcaption>
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
  readonly counts = input.required<BucketedCounts>();
  /** Auflösung beider Zeitreihen — bestimmt Titel und Legende, die Daten kommen fertig gebucketet. */
  readonly bucket = input.required<Bucket>();
  readonly scoreTrend = input.required<BucketedAverages>();
  readonly skills = input.required<NamedCount[]>();
  readonly gaps = input.required<NamedCount[]>();
  readonly histogram = input.required<number[]>();
  readonly greenThreshold = input.required<number>();
  readonly yellowThreshold = input.required<number>();
  /** Von der Seite durchgereicht (ThemeStore) — reine Präsentationskomponente, kein eigener Service. */
  readonly dark = input.required<boolean>();

  private readonly transloco = inject(TranslocoService);

  private readonly palette = computed(() => (this.dark() ? PALETTE.dark : PALETTE.light));

  protected readonly countsTitleKey = computed(() => TITLE_KEY_PER_BUCKET[this.bucket()]);
  protected readonly scoreTrendTitleKey = computed(() => SCORE_TREND_KEY_PER_BUCKET[this.bucket()]);

  // Balken je Bucket plus gestrichelte Linie auf dem Schnitt — die Legende benennt beide.
  protected readonly countsData = computed(() => {
    const palette = this.palette();
    const counts = this.counts();
    return {
      labels: counts.labels,
      datasets: [
        {
          type: 'bar' as const,
          label: this.transloco.translate('offers.charts.offersLegend'),
          data: counts.counts,
          backgroundColor: palette.series1,
          borderRadius: 4,
        },
        {
          type: 'line' as const,
          label: this.transloco.translate(AVERAGE_KEY_PER_BUCKET[this.bucket()]),
          data: counts.counts.map(() => counts.average),
          borderColor: palette.series2,
          borderDash: [6, 4],
          pointRadius: 0,
        },
      ],
    };
  });

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
          // Buckets ohne analysierte Angebote sind null — die Linie überbrückt sie statt abzureißen.
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
  protected readonly countsOptions = computed(() => axisOptionsWithLegend(this.palette(), 'x'));
  // Der Score-Trend bekommt eine feste 0–100-Werteachse, damit die Linie nicht relativ überzeichnet.
  protected readonly scoreTrendOptions = computed(() => axisOptions(this.palette(), 'x', 100));
}
