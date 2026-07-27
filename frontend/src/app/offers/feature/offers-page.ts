import { Component, computed, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { OffersStore } from '../data-access/offers-store';
import { SettingsStore } from '../data-access/settings-store';
import { runCostCents } from '../../shared/util/run-cost';
import { ThemeStore } from '../../shared/data-access/theme-store';
import { countBySource, kpis, offersPerDay, scoreHistogram, topSkills, triggersPerAgent } from '../util/offer-stats';
import { KpiTiles } from '../ui/kpi-tiles';
import { OfferCharts } from '../ui/offer-charts';

const TOP_SKILL_LIMIT = 10;

@Component({
  selector: 'app-offers-page',
  imports: [DatePipe, DecimalPipe, TranslocoDirective, CardModule, ProgressSpinnerModule, KpiTiles, OfferCharts],
  template: `
    <main class="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <ng-container *transloco="let t">
        <p-card>
          <div class="flex flex-col gap-6">
            <!-- „Last run: neu von gesehen" sitzt jetzt hinter der Glocke in der Topbar; diese
                 Zeile bleibt vorerst hier — folgt als eigener Schritt. -->
            @if (store.latestRun(); as run) {
              <span class="text-sm text-surface-600 dark:text-surface-300">
                {{ t('offers.lastRunAnalyzed', { analyzed: run.analyzedOffers }) }}
                @if (run.inputTokens > 0) {
                  · ≈{{ costCents(run.inputTokens, run.outputTokens) | number: '1.1-2' }} ct
                }
                ({{ run.ranAt | date: 'dd.MM.yyyy HH:mm' }})
              </span>
            }

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
}
