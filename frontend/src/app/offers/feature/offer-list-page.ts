import { Component, computed, inject } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { OffersStore } from '../data-access/offers-store';
import { SettingsStore } from '../data-access/settings-store';
import { OfferTable, OfferRow } from '../ui/offer-table';
import { roleCategory } from '../util/offer-stats';

@Component({
  selector: 'app-offer-list-page',
  imports: [TranslocoDirective, CardModule, ProgressSpinnerModule, OfferTable],
  template: `
    <main class="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <ng-container *transloco="let t">
        <p-card>
          <div class="flex flex-col gap-6">
            @if (store.isLoading()) {
              <p-progress-spinner [style]="{ width: '2rem', height: '2rem' }" [ariaLabel]="t('offers.listTitle')" />
            } @else if (store.hasError()) {
              <p class="text-red-500">{{ t('offers.loadError') }}</p>
            } @else {
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
export class OfferListPage {
  protected readonly store = inject(OffersStore);
  protected readonly settings = inject(SettingsStore);

  /** Kopien anderer Agenten: wie im Dashboard zählen Auswertungen nur primäre Einträge. */
  private readonly primaryOffers = computed(() => this.store.offers().filter((offer) => offer.primary));

  // Duplikat-Toggle: zusammengefasst (nur primäre, mit Badge) oder alle Zeilen.
  protected readonly rows = computed<OfferRow[]>(() => {
    const offers = this.settings.settings().collapseDuplicates ? this.primaryOffers() : this.store.offers();
    return offers.map((offer) => ({
      id: offer.id,
      receivedAt: offer.receivedAt,
      sourceType: offer.sourceType,
      agentName: offer.agentName,
      title: offer.projectTitle ?? offer.subject,
      role: offer.role,
      // Cluster erst hier, nicht im Backend: dieselbe Regel wie im Dashboard-Ranking.
      roleCategory: offer.role === null || offer.role.trim() === '' ? null : roleCategory(offer.role),
      company: offer.company,
      location: offer.location,
      country: offer.country,
      remote: offer.remote,
      dupCount: offer.dupCount,
      projectUrl: offer.projectUrl,
      matchScore: offer.matchScore,
      matchReason: offer.matchReason,
      startDate: offer.startDate,
      budgetEur: offer.budgetEur,
      budgetKind: offer.budgetKind,
      durationMonths: offer.durationMonths,
      utilizationPercent: offer.utilizationPercent,
      remotePercent: offer.remotePercent,
      startMonth: offer.startMonth,
      startImmediate: offer.startImmediate,
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
