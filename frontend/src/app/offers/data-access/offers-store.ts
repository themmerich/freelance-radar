import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';

import { Run } from '../../shared/domain/run';
import { Offer } from '../domain/offer';

const OFFERS_URL = '/api/offers';
const RUNS_URL = '/api/runs';
const PROFILES_URL = '/api/profiles';

/** Minimalsicht auf die Profile für den Dashboard-Umschalter. */
export type ProfileOption = {
  id: number;
  name: string;
  active: boolean;
};

/**
 * Reads offers and the latest run reactively via `httpResource()`; the collect
 * trigger is a mutation through `HttpClient` that reloads both resources
 * (guide: resources for reads, HttpClient for mutations).
 */
@Injectable({ providedIn: 'root' })
export class OffersStore {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messages = inject(MessageService);
  private readonly transloco = inject(TranslocoService);

  private readonly offersResource = httpResource<Offer[]>(() => OFFERS_URL, { defaultValue: [] });
  private readonly latestRunResource = httpResource<Run | null>(() => `${RUNS_URL}/latest`, { defaultValue: null });
  private readonly profilesResource = httpResource<ProfileOption[]>(() => PROFILES_URL, { defaultValue: [] });

  readonly offers = this.offersResource.value;
  readonly isLoading = this.offersResource.isLoading;
  readonly hasError = this.offersResource.error;
  readonly latestRun = this.latestRunResource.value;
  readonly profileOptions = this.profilesResource.value;

  private readonly collecting = signal(false);
  readonly isCollecting = this.collecting.asReadonly();

  /** Umschalten auf ein anderes Profil: aktivieren, dann Angebote aus dessen Sicht laden. */
  switchProfile(profileId: number): void {
    this.http
      .post<ProfileOption>(`${PROFILES_URL}/${profileId}/activate`, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.profilesResource.reload();
        this.offersResource.reload();
      });
  }

  /**
   * Löst einen Abruf-Lauf aus („Mails abrufen"-Button), lädt danach neu und
   * meldet das Ergebnis als Toast — Importzahlen bei Erfolg, bei Fehlern das
   * Problem-Detail des Backends (z. B. IMAP nicht erreichbar), sonst generisch.
   */
  collect(): void {
    this.collecting.set(true);
    this.http
      .post<Run>(RUNS_URL, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (run) => {
          this.collecting.set(false);
          this.offersResource.reload();
          this.latestRunResource.reload();
          this.messages.add({
            severity: 'success',
            summary: this.transloco.translate('offers.toast.successSummary'),
            detail: this.transloco.translate('offers.toast.successDetail', {
              newOffers: run.newOffers,
              totalSeen: run.totalSeen,
              analyzed: run.analyzedOffers,
              details: run.detailsFetched,
            }),
          });
        },
        error: (error: HttpErrorResponse) => {
          this.collecting.set(false);
          const serverDetail = typeof error.error?.detail === 'string' ? error.error.detail : null;
          this.messages.add({
            severity: 'error',
            summary: this.transloco.translate('offers.toast.errorSummary'),
            detail: serverDetail ?? this.transloco.translate('offers.collectError'),
            sticky: true,
          });
        },
      });
  }
}
