import { Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ChartModule } from 'primeng/chart';

import { AgentScore, DailyAverages, DailyCounts, NamedCount, REMOTE_ORDER, RoleCount, scoreTier } from '../util/offer-stats';

/**
 * Die 9 Auswertungs-Charts (Kern an v1 orientiert). Farben aus einer validierten
 * Dataviz-Palette, jeweils für helle und dunkle Oberfläche gestuft; das
 * Histogramm nutzt die Status-Farben der Score-Ampel.
 */
const PALETTE = {
  light: {
    series1: '#2a78d6',
    series2: '#eb6834',
    series3: '#1baf7a',
    series4: '#eda100',
    good: '#0ca30c',
    warning: '#fab219',
    critical: '#d03b3b',
    ink: '#52514e',
    muted: '#898781',
    grid: '#e1e0d9',
  },
  dark: {
    series1: '#3987e5',
    series2: '#d95926',
    series3: '#199e70',
    series4: '#c98500',
    good: '#0ca30c',
    warning: '#fab219',
    critical: '#d03b3b',
    ink: '#c3c2b7',
    muted: '#898781',
    grid: '#2c2c2a',
  },
} as const;

@Component({
  selector: 'app-offer-charts',
  imports: [TranslocoDirective, ChartModule],
  template: `
    <ng-container *transloco="let t">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.perDay') }}</figcaption>
          <p-chart type="bar" [data]="perDayData()" [options]="barOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.scoreTrend') }}</figcaption>
          <p-chart type="line" [data]="scoreTrendData()" [options]="scoreTrendOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.remote') }}</figcaption>
          <p-chart type="doughnut" [data]="remoteData()" [options]="doughnutOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.agents') }}</figcaption>
          <p-chart type="bar" [data]="agentData()" [options]="barOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.agentScores') }}</figcaption>
          <p-chart type="bar" [data]="agentScoreData()" [options]="agentScoreOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.roles') }}</figcaption>
          <p-chart type="bar" [data]="roleData()" [options]="horizontalBarOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.topSkills') }}</figcaption>
          <p-chart type="bar" [data]="skillData()" [options]="horizontalBarOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.topGaps') }}</figcaption>
          <p-chart type="bar" [data]="gapData()" [options]="horizontalBarOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.scores') }}</figcaption>
          <p-chart type="bar" [data]="histogramData()" [options]="barOptions()" height="16rem" />
        </figure>
      </div>
    </ng-container>
  `,
})
export class OfferCharts {
  readonly perDay = input.required<DailyCounts>();
  readonly scoreTrend = input.required<DailyAverages>();
  /** Zählung in `REMOTE_ORDER` plus letztem Eintrag für „nicht erkannt“. */
  readonly remote = input.required<number[]>();
  readonly agents = input.required<NamedCount[]>();
  readonly agentScores = input.required<AgentScore[]>();
  /** Angefragte Berufsprofile, bereits geclustert und sortiert. */
  readonly roles = input.required<RoleCount[]>();
  readonly skills = input.required<NamedCount[]>();
  readonly gaps = input.required<NamedCount[]>();
  readonly histogram = input.required<number[]>();
  readonly greenThreshold = input.required<number>();
  readonly yellowThreshold = input.required<number>();
  /** Von der Seite durchgereicht (ThemeStore) — reine Präsentationskomponente, kein eigener Service. */
  readonly dark = input.required<boolean>();

  private readonly transloco = inject(TranslocoService);

  private readonly palette = computed(() => (this.dark() ? PALETTE.dark : PALETTE.light));

  protected readonly perDayData = computed(() => ({
    labels: this.perDay().labels,
    datasets: [{ data: this.perDay().counts, backgroundColor: this.palette().series1, borderRadius: 4 }],
  }));

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

  protected readonly remoteData = computed(() => {
    const palette = this.palette();
    return {
      labels: [
        ...REMOTE_ORDER.map((remote) => this.transloco.translate(`offers.remote.${remote}`)),
        this.transloco.translate('offers.charts.remoteUnknown'),
      ],
      datasets: [
        {
          data: this.remote(),
          backgroundColor: [palette.series1, palette.series2, palette.series3, palette.muted],
          borderWidth: 0,
        },
      ],
    };
  });

  protected readonly agentData = computed(() => ({
    labels: this.agents().map((agent) => agent.name),
    datasets: [{ data: this.agents().map((agent) => agent.count), backgroundColor: this.palette().series1, borderRadius: 4 }],
  }));

  protected readonly agentScoreData = computed(() => ({
    labels: this.agentScores().map((agent) => agent.name),
    datasets: [{ data: this.agentScores().map((agent) => agent.averageScore), backgroundColor: this.palette().series3, borderRadius: 4 }],
  }));

  protected readonly roleData = computed(() => ({
    labels: this.roles().map((role) => this.transloco.translate(`offers.roleCategory.${role.category}`)),
    datasets: [{ data: this.roles().map((role) => role.count), backgroundColor: this.palette().series4, borderRadius: 4 }],
  }));

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

  protected readonly barOptions = computed(() => this.axisOptions('x'));
  protected readonly horizontalBarOptions = computed(() => this.axisOptions('y'));
  // Score-Charts bekommen eine feste 0–100-Werteachse, damit Balken/Linie nicht relativ überzeichnen.
  protected readonly agentScoreOptions = computed(() => this.axisOptions('y', 100));
  protected readonly scoreTrendOptions = computed(() => this.axisOptions('x', 100));

  protected readonly doughnutOptions = computed(() => ({
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: this.palette().ink } } },
  }));

  /** `valueMax` fixiert die Werteachse (die zur `indexAxis` orthogonale) auf 0–`valueMax`. */
  private axisOptions(indexAxis: 'x' | 'y', valueMax?: number): object {
    const palette = this.palette();
    const axis = { ticks: { color: palette.muted, precision: 0 }, grid: { color: palette.grid } };
    const valueBounds = valueMax === undefined ? {} : { min: 0, max: valueMax };
    return {
      indexAxis,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ...axis, ...(indexAxis === 'y' ? valueBounds : {}) },
        y: { ...axis, ...(indexAxis === 'x' ? valueBounds : {}) },
      },
    };
  }
}
