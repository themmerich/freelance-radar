import { Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { OffersStore } from '../data-access/offers-store';
import { SettingsStore } from '../data-access/settings-store';
import { runCostCents } from '../../shared/util/run-cost';
import { ThemeStore } from '../../shared/data-access/theme-store';
import { countBySource, kpis, offersPerDay, scoreHistogram, topSkills, triggersPerAgent } from '../util/offer-stats';
import { KpiTiles } from '../ui/kpi-tiles';
import { OfferCharts } from '../ui/offer-charts';
import { OfferTable, OfferRow } from '../ui/offer-table';

const TOP_SKILL_LIMIT = 10;

@Component({
  selector: 'app-offers-page',
  imports: [DatePipe, DecimalPipe, TranslocoDirective, ButtonModule, CardModule, ProgressSpinnerModule, KpiTiles, OfferCharts, OfferTable],
  template: `
    <main class="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <ng-container *transloco="let t">
        <p-card>
          <div class="flex flex-col gap-6">
            <div class="flex flex-wrap items-center gap-4">
              <p-button
                type="button"
                icon="pi pi-inbox"
                [label]="t('offers.collect')"
                [loading]="store.isCollecting()"
                (onClick)="store.collect()"
              />
              @if (store.latestRun(); as run) {
                <span class="text-sm text-surface-600 dark:text-surface-300">
                  {{ t('offers.lastRun', { newOffers: run.newOffers, totalSeen: run.totalSeen }) }}
                  · {{ t('offers.lastRunAnalyzed', { analyzed: run.analyzedOffers }) }}
                  @if (run.inputTokens > 0) {
                    · ≈{{ costCents(run.inputTokens, run.outputTokens) | number: '1.1-2' }} ct
                  }
                  ({{ run.ranAt | date: 'dd.MM.yyyy HH:mm' }})
                </span>
              } @else {
                <span class="text-sm text-surface-600 dark:text-surface-300">{{ t('offers.noRunYet') }}</span>
              }
            </div>

            @if (store.isLoading()) {
              <p-progress-spinner [style]="{ width: '2rem', height: '2rem' }" [ariaLabel]="t('offers.title')" />
            } @else if (store.hasError()) {
              <p class="text-red-500">{{ t('offers.loadError') }}</p>
            } @else {
              <app-kpi-tiles [kpis]="pageKpis()" />

              <app-offer-charts
                [perDay]="perDay()"
                [sources]="sources()"
                [agents]="agents()"
                [skills]="skills()"
                [gaps]="gaps()"
                [histogram]="histogram()"
                [greenThreshold]="settings.greenThreshold()"
                [yellowThreshold]="settings.yellowThreshold()"
                [dark]="theme.dark()"
              />

              <div class="flex flex-wrap items-center gap-6 text-sm">
                <label class="flex items-center gap-2">
                  <span>🟢 {{ t('offers.settings.greenFrom') }}</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    class="w-20 rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                    [value]="settings.greenThreshold()"
                    (change)="onGreenChange($event)"
                  />
                </label>
                <label class="flex items-center gap-2">
                  <span>🟡 {{ t('offers.settings.yellowFrom') }}</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    class="w-20 rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                    [value]="settings.yellowThreshold()"
                    (change)="onYellowChange($event)"
                  />
                </label>
                <label class="flex items-center gap-2">
                  <input type="checkbox" [checked]="settings.collapseDuplicates()" (change)="onCollapseChange($event)" />
                  <span>{{ t('offers.settings.collapseDuplicates') }}</span>
                </label>
              </div>

              <app-offer-table
                [offers]="rows()"
                [greenThreshold]="settings.greenThreshold()"
                [yellowThreshold]="settings.yellowThreshold()"
              />
            }
          </div>
        </p-card>
      </ng-container>
    </main>
  `,
})
export class OffersPage {
  protected readonly store = inject(OffersStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly theme = inject(ThemeStore);
  protected readonly costCents = runCostCents;

  /** Kopien anderer Agenten: Auswertungen zählen immer nur primäre Einträge (wie v1). */
  private readonly primaryOffers = computed(() => this.store.offers().filter((offer) => offer.primary));

  protected readonly pageKpis = computed(() => kpis(this.primaryOffers(), this.settings.settings().greenThreshold, new Date()));
  protected readonly perDay = computed(() => offersPerDay(this.primaryOffers(), 30, new Date()));
  protected readonly sources = computed(() => countBySource(this.primaryOffers()));
  protected readonly agents = computed(() => triggersPerAgent(this.primaryOffers()));
  protected readonly skills = computed(() => topSkills(this.primaryOffers(), TOP_SKILL_LIMIT, false));
  protected readonly gaps = computed(() => topSkills(this.primaryOffers(), TOP_SKILL_LIMIT, true));
  protected readonly histogram = computed(() => scoreHistogram(this.primaryOffers()));

  // Duplikat-Toggle: zusammengefasst (nur primäre, mit Badge) oder alle Zeilen.
  protected readonly rows = computed<OfferRow[]>(() => {
    const offers = this.settings.settings().collapseDuplicates ? this.primaryOffers() : this.store.offers();
    return offers.map((offer) => ({
      id: offer.id,
      receivedAt: offer.receivedAt,
      sourceType: offer.sourceType,
      agentName: offer.agentName,
      title: offer.projectTitle ?? offer.subject,
      company: offer.company,
      location: offer.location,
      country: offer.country,
      remote: offer.remote,
      dupCount: offer.dupCount,
      projectUrl: offer.projectUrl,
      matchScore: offer.matchScore,
      matchReason: offer.matchReason,
      rate: offer.rate,
      startDate: offer.startDate,
      duration: offer.duration,
      skills: offer.skills,
      status: offer.status,
    }));
  });

  protected onGreenChange(event: Event): void {
    this.settings.setGreenThreshold(Number((event.target as HTMLInputElement).value));
  }

  protected onYellowChange(event: Event): void {
    this.settings.setYellowThreshold(Number((event.target as HTMLInputElement).value));
  }

  protected onCollapseChange(event: Event): void {
    this.settings.setCollapseDuplicates((event.target as HTMLInputElement).checked);
  }
}
