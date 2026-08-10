import { Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ChartModule } from 'primeng/chart';

import { AVERAGE_KEY_PER_BUCKET, axisOptions, axisOptionsWithLegend, PALETTE, TITLE_KEY_PER_BUCKET } from './chart-theme';
import { AgentScore, Bucket, BucketedCounts, NamedCount, RoleCount } from '../util/offer-stats';

/**
 * Die 7 globalen Auswertungs-Charts über alle Angebote des gewählten Zeitraums — Volumen,
 * Agenten-Vergleiche und die Verteilungen aus den Projektseiten. Die agentenspezifischen
 * Charts liegen in `AgentCharts`. Die Zeitreihe trägt die Auflösung im Titel, das Fenster
 * nennt der Umschalter über den Tabs.
 *
 * Laufzeit und Stundensatz tragen ihre Fallzahl im Titel: nicht jedes Projekt nennt beides,
 * beim Satz ist es rund jedes zehnte.
 */
@Component({
  selector: 'app-offer-charts',
  imports: [TranslocoDirective, ChartModule],
  template: `
    <ng-container *transloco="let t">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t(countsTitleKey()) }}</figcaption>
          <p-chart type="bar" [data]="countsData()" [options]="countsOptions()" height="16rem" />
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
          <figcaption class="text-sm font-medium">{{ t('offers.charts.remoteShare') }}</figcaption>
          <p-chart type="bar" [data]="remoteShareData()" [options]="barOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.durations', { count: durationCount() }) }}</figcaption>
          <p-chart type="bar" [data]="durationData()" [options]="barOptions()" height="16rem" />
        </figure>
        <figure class="flex flex-col gap-2 rounded border border-surface-200 p-3 dark:border-surface-700">
          <figcaption class="text-sm font-medium">{{ t('offers.charts.rates', { count: rateCount() }) }}</figcaption>
          <p-chart type="bar" [data]="rateData()" [options]="barOptions()" height="16rem" />
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
  readonly counts = input.required<BucketedCounts>();
  /** Auflösung der Zeitreihe — bestimmt Titel und Legende, die Daten kommen fertig gebucketet. */
  readonly bucket = input.required<Bucket>();
  /** Verteilung über den Remote-Prozentwert der Projektseite (0 %, 1–49 %, 50–99 %, 100 %). */
  readonly remoteShare = input.required<NamedCount[]>();
  /** Laufzeit-Klassen in Monaten. */
  readonly durations = input.required<NamedCount[]>();
  /** Stundensatz-Klassen; nur Angebote mit `budgetKind === 'HOURLY'`. */
  readonly rates = input.required<NamedCount[]>();
  readonly agents = input.required<NamedCount[]>();
  readonly agentScores = input.required<AgentScore[]>();
  /** Angefragte Berufsprofile, bereits geclustert und sortiert. */
  readonly roles = input.required<RoleCount[]>();
  /** Von der Seite durchgereicht (ThemeStore) — reine Präsentationskomponente, kein eigener Service. */
  readonly dark = input.required<boolean>();

  private readonly transloco = inject(TranslocoService);

  private readonly palette = computed(() => (this.dark() ? PALETTE.dark : PALETTE.light));

  protected readonly countsTitleKey = computed(() => TITLE_KEY_PER_BUCKET[this.bucket()]);

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

  protected readonly remoteShareData = computed(() => this.bars(this.remoteShare(), this.palette().series2));
  protected readonly durationData = computed(() => this.bars(this.durations(), this.palette().series3));
  protected readonly rateData = computed(() => this.bars(this.rates(), this.palette().series4));

  /** Fallzahlen für die Chart-Titel — bei dünner Basis gehört sie sichtbar dazu. */
  protected readonly durationCount = computed(() => total(this.durations()));
  protected readonly rateCount = computed(() => total(this.rates()));

  private bars(entries: NamedCount[], color: string) {
    return {
      labels: entries.map((entry) => entry.name),
      datasets: [{ data: entries.map((entry) => entry.count), backgroundColor: color, borderRadius: 4 }],
    };
  }

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
  protected readonly countsOptions = computed(() => axisOptionsWithLegend(this.palette(), 'x'));
  // Der Agenten-Vergleich bekommt eine feste 0–100-Werteachse, damit Balken nicht relativ überzeichnen.
  protected readonly agentScoreOptions = computed(() => axisOptions(this.palette(), 'y', 100));
}

function total(entries: NamedCount[]): number {
  return entries.reduce((sum, entry) => sum + entry.count, 0);
}
