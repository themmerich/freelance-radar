import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { OffersStore } from '../data-access/offers-store';
import { OfferTable, OfferRow } from '../ui/offer-table';

@Component({
  selector: 'app-offers-page',
  imports: [DatePipe, TranslocoDirective, ButtonModule, CardModule, ProgressSpinnerModule, OfferTable],
  template: `
    <main class="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 p-6">
      <ng-container *transloco="let t">
        <p-card [header]="t('offers.title')">
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
                  ({{ run.ranAt | date: 'dd.MM.yyyy HH:mm' }})
                </span>
              } @else {
                <span class="text-sm text-surface-600 dark:text-surface-300">{{ t('offers.noRunYet') }}</span>
              }
            </div>

            @if (store.hasCollectError()) {
              <p class="text-red-500" role="alert">{{ t('offers.collectError') }}</p>
            }

            @if (store.isLoading()) {
              <p-progress-spinner [style]="{ width: '2rem', height: '2rem' }" [ariaLabel]="t('offers.title')" />
            } @else if (store.hasError()) {
              <p class="text-red-500">{{ t('offers.loadError') }}</p>
            } @else {
              <app-offer-table [offers]="rows()" />
            }
          </div>
        </p-card>
      </ng-container>
    </main>
  `,
})
export class OffersPage {
  protected readonly store = inject(OffersStore);

  // Springen mehrere Agenten auf dasselbe Projekt an, erscheint nur der primäre
  // Eintrag — mit dupCount-Badge statt Doppelzeile (Toggle kommt in Phase 3).
  protected readonly rows = computed<OfferRow[]>(() =>
    this.store
      .offers()
      .filter((offer) => offer.primary)
      .map((offer) => ({
        id: offer.id,
        receivedAt: offer.receivedAt,
        sourceType: offer.sourceType,
        agentName: offer.agentName,
        title: offer.projectTitle ?? offer.subject,
        company: offer.company,
        location: offer.location,
        remote: offer.remote,
        dupCount: offer.dupCount,
        projectUrl: offer.projectUrl,
        status: offer.status,
      })),
  );
}
