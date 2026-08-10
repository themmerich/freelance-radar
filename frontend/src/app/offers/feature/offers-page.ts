import { Component, computed, inject, linkedSignal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TabsModule } from 'primeng/tabs';

import { OffersStore } from '../data-access/offers-store';
import { SettingsStore } from '../data-access/settings-store';
import { ThemeStore } from '../../shared/data-access/theme-store';
import {
  averageScorePerAgent,
  averageScorePerBucket,
  averageWithCount,
  bucketFor,
  countByRoleCategory,
  durationBuckets,
  durations,
  hourlyRates,
  kpis,
  offersPerBucket,
  rateBuckets,
  remotePercentBuckets,
  remotePercents,
  scoreHistogram,
  topSkills,
  triggersPerAgent,
  withinRange,
} from '../util/offer-stats';
import { KpiTiles } from '../ui/kpi-tiles';
import { OfferCharts } from '../ui/offer-charts';
import { AgentCharts } from '../ui/agent-charts';
import { MarketStats } from '../ui/market-stats';
import { RangePicker } from '../ui/range-picker';

const TOP_SKILL_LIMIT = 10;

@Component({
  selector: 'app-offers-page',
  imports: [
    TranslocoDirective,
    CardModule,
    ProgressSpinnerModule,
    TabsModule,
    KpiTiles,
    OfferCharts,
    AgentCharts,
    RangePicker,
    MarketStats,
  ],
  template: `
    <main class="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <ng-container *transloco="let t">
        <p-card>
          <div class="flex flex-col gap-6">
            @if (store.isLoading()) {
              <p-progress-spinner [style]="{ width: '2rem', height: '2rem' }" [ariaLabel]="t('offers.title')" />
            } @else if (store.hasError()) {
              <p class="text-red-500">{{ t('offers.loadError') }}</p>
            } @else {
              <!-- Die Kacheln behalten bewusst feste Fenster: sie sind der Bezugspunkt,
                   gegen den der gewählte Zeitraum der Charts gelesen wird. -->
              <app-kpi-tiles [kpis]="pageKpis()" />

              <div class="flex justify-end">
                <app-range-picker [range]="settings.range()" (rangeChange)="settings.setRange($event)" />
              </div>

              <!-- Zwei Sichten auf dieselben Angebote: global über alle, dann je Suchagent.
                   Lazy, weil Chart.js im versteckten Panel auf 0×0 misst und danach nicht mehr nachwächst. -->
              <p-tabs value="global" [lazy]="true">
                <p-tablist>
                  <p-tab value="global">{{ t('offers.tabs.global') }}</p-tab>
                  <p-tab value="agents">{{ t('offers.tabs.agentAnalysis') }}</p-tab>
                </p-tablist>
                <p-tabpanels>
                  <p-tabpanel value="global">
                    <!-- Folgt dem Zeitraum, anders als die Kachel-Zeile — deshalb hier und nicht dort. -->
                    <app-market-stats class="mb-4 block" [rate]="averageRate()" [duration]="averageDuration()" [remote]="averageRemote()" />
                    <app-offer-charts
                      [counts]="counts()"
                      [bucket]="bucket()"
                      [remoteShare]="remoteShare()"
                      [durations]="durationClasses()"
                      [rates]="rateClasses()"
                      [agents]="agents()"
                      [agentScores]="agentScores()"
                      [roles]="roles()"
                      [dark]="theme.dark()"
                    />
                  </p-tabpanel>

                  <!-- Agenten-Analyse: Detail-Charts, gefiltert auf den gewählten Suchagenten -->
                  <p-tabpanel value="agents">
                    @if (agentNames().length === 0) {
                      <p class="text-sm text-surface-500 dark:text-surface-400">{{ t('offers.agentAnalysis.empty') }}</p>
                    } @else {
                      <div class="flex flex-col gap-4">
                        <!-- Natives Select wie der Profil-Umschalter der Shell; PrimeNGs p-select kollidiert
                             mit der FormField-Typprüfung (BaseInput erbt min/max als number-Inputs). -->
                        <label class="flex items-center justify-end gap-2 text-sm">
                          <span>{{ t('offers.agentAnalysis.agent') }}</span>
                          <select
                            class="rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                            [value]="selectedAgent()"
                            (change)="onAgentChange($event)"
                          >
                            @for (name of agentNames(); track name) {
                              <option [value]="name">{{ name }}</option>
                            }
                          </select>
                        </label>

                        <app-agent-charts
                          [counts]="agentCounts()"
                          [bucket]="bucket()"
                          [scoreTrend]="agentScoreTrend()"
                          [histogram]="agentHistogram()"
                          [skills]="agentSkills()"
                          [gaps]="agentGaps()"
                          [greenThreshold]="settings.greenThreshold()"
                          [yellowThreshold]="settings.yellowThreshold()"
                          [dark]="theme.dark()"
                        />
                      </div>
                    }
                  </p-tabpanel>
                </p-tabpanels>
              </p-tabs>
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

  /** Kopien anderer Agenten: Auswertungen zählen immer nur primäre Einträge (wie v1). */
  private readonly primaryOffers = computed(() => this.store.offers().filter((offer) => offer.primary));

  /** Die Kacheln tragen feste Fenster und hängen deshalb bewusst nicht am Zeitraum. */
  protected readonly pageKpis = computed(() => kpis(this.primaryOffers(), this.settings.settings().greenThreshold, new Date()));

  /** Einmal auf den gewählten Zeitraum geschnitten — jedes Chart rechnet aus dieser Liste. */
  private readonly rangedOffers = computed(() => withinRange(this.primaryOffers(), this.settings.range(), new Date()));

  protected readonly bucket = computed(() => bucketFor(this.settings.range()));
  protected readonly counts = computed(() => offersPerBucket(this.rangedOffers(), this.settings.range(), new Date()));
  protected readonly remoteShare = computed(() => remotePercentBuckets(this.rangedOffers()));
  protected readonly durationClasses = computed(() => durationBuckets(this.rangedOffers()));
  protected readonly rateClasses = computed(() => rateBuckets(this.rangedOffers()));

  /** Kennzahlen der Marktzeile — jede mit der Fallzahl, auf der sie steht. */
  protected readonly averageRate = computed(() => averageWithCount(hourlyRates(this.rangedOffers())));
  protected readonly averageDuration = computed(() => averageWithCount(durations(this.rangedOffers())));
  protected readonly averageRemote = computed(() => averageWithCount(remotePercents(this.rangedOffers())));
  protected readonly agents = computed(() => triggersPerAgent(this.rangedOffers()));
  protected readonly agentScores = computed(() => averageScorePerAgent(this.rangedOffers()));
  protected readonly roles = computed(() => countByRoleCategory(this.rangedOffers()));

  /** Agentennamen absteigend nach Angebotszahl — zugleich Dropdown-Optionen und Quelle der Vorauswahl. */
  protected readonly agentNames = computed(() => this.agents().map((agent) => agent.name));

  /** Vorbelegt mit dem stärksten Agenten; fällt auf diesen zurück, wenn der gewählte nach einem Reload fehlt. */
  protected readonly selectedAgent = linkedSignal<string[], string | null>({
    source: this.agentNames,
    computation: (names, previous) =>
      previous !== undefined && previous.value !== null && names.includes(previous.value) ? previous.value : (names[0] ?? null),
  });

  private readonly agentOffers = computed(() =>
    this.rangedOffers().filter((offer) => offer.sourceType === 'AGENT' && offer.agentName === this.selectedAgent()),
  );

  protected readonly agentCounts = computed(() => offersPerBucket(this.agentOffers(), this.settings.range(), new Date()));
  protected readonly agentScoreTrend = computed(() => averageScorePerBucket(this.agentOffers(), this.settings.range(), new Date()));
  protected readonly agentHistogram = computed(() => scoreHistogram(this.agentOffers()));
  protected readonly agentSkills = computed(() => topSkills(this.agentOffers(), TOP_SKILL_LIMIT, false));
  protected readonly agentGaps = computed(() => topSkills(this.agentOffers(), TOP_SKILL_LIMIT, true));

  protected onAgentChange(event: Event): void {
    this.selectedAgent.set((event.target as HTMLSelectElement).value);
  }
}
