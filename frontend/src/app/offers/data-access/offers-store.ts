import { HttpClient, httpResource } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Offer, Run } from '../domain/offer';

const OFFERS_URL = '/api/offers';
const RUNS_URL = '/api/runs';

/**
 * Reads offers and the latest run reactively via `httpResource()`; the collect
 * trigger is a mutation through `HttpClient` that reloads both resources
 * (guide: resources for reads, HttpClient for mutations).
 */
@Injectable({ providedIn: 'root' })
export class OffersStore {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly offersResource = httpResource<Offer[]>(() => OFFERS_URL, { defaultValue: [] });
  private readonly latestRunResource = httpResource<Run | null>(() => `${RUNS_URL}/latest`, { defaultValue: null });

  readonly offers = this.offersResource.value;
  readonly isLoading = this.offersResource.isLoading;
  readonly hasError = this.offersResource.error;
  readonly latestRun = this.latestRunResource.value;

  private readonly collecting = signal(false);
  private readonly collectFailed = signal(false);
  readonly isCollecting = this.collecting.asReadonly();
  readonly hasCollectError = this.collectFailed.asReadonly();

  /** Löst einen Abruf-Lauf aus („Mails abrufen"-Button) und lädt danach neu. */
  collect(): void {
    this.collecting.set(true);
    this.collectFailed.set(false);
    this.http
      .post<Run>(RUNS_URL, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.collecting.set(false);
          this.offersResource.reload();
          this.latestRunResource.reload();
        },
        error: () => {
          this.collecting.set(false);
          this.collectFailed.set(true);
        },
      });
  }
}
