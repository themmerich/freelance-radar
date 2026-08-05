import { Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ChartModule } from 'primeng/chart';

import { axisOptions, PALETTE } from './chart-theme';
import { AgentScore, DailyCounts, NamedCount, REMOTE_ORDER, RoleCount } from '../util/offer-stats';

/**
 * Die 5 globalen Auswertungs-Charts über alle Angebote (Kern an v1 orientiert) —
 * insbesondere die Agenten-Vergleiche. Die agentenspezifischen Charts liegen in `AgentCharts`.
 */
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
          <figcaption class="text-sm font-medium">{{ t('offers.charts.agents') }}</figcaption>
          <p-chart type="bar" [data]="agentData()" [options]="barOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.agentScores') }}</figcaption>
          <p-chart type="bar" [data]="agentScoreData()" [options]="agentScoreOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.remote') }}</figcaption>
          <p-chart type="doughnut" [data]="remoteData()" [options]="doughnutOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.roles') }}</figcaption>
          <p-chart type="bar" [data]="roleData()" [options]="horizontalBarOptions()" height="16rem" />
        </figure>
      </div>
    </ng-container>
  `,
})
export class OfferCharts {
  readonly perDay = input.required<DailyCounts>();
  /** Zählung in `REMOTE_ORDER` plus letztem Eintrag für „nicht erkannt“. */
  readonly remote = input.required<number[]>();
  readonly agents = input.required<NamedCount[]>();
  readonly agentScores = input.required<AgentScore[]>();
  /** Angefragte Berufsprofile, bereits geclustert und sortiert. */
  readonly roles = input.required<RoleCount[]>();
  /** Von der Seite durchgereicht (ThemeStore) — reine Präsentationskomponente, kein eigener Service. */
  readonly dark = input.required<boolean>();

  private readonly transloco = inject(TranslocoService);

  private readonly palette = computed(() => (this.dark() ? PALETTE.dark : PALETTE.light));

  protected readonly perDayData = computed(() => ({
    labels: this.perDay().labels,
    datasets: [{ data: this.perDay().counts, backgroundColor: this.palette().series1, borderRadius: 4 }],
  }));

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

  protected readonly barOptions = computed(() => axisOptions(this.palette(), 'x'));
  protected readonly horizontalBarOptions = computed(() => axisOptions(this.palette(), 'y'));
  // Der Agenten-Vergleich bekommt eine feste 0–100-Werteachse, damit Balken nicht relativ überzeichnen.
  protected readonly agentScoreOptions = computed(() => axisOptions(this.palette(), 'y', 100));

  protected readonly doughnutOptions = computed(() => ({
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { color: this.palette().ink } } },
  }));
}
