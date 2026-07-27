import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { Observable } from 'rxjs';

import { AnalysisPreview, Profile, ProfileDraft } from '../domain/profile';
import { Run } from '../../shared/domain/run';

const PROFILES_URL = '/api/profiles';
const ANALYSES_URL = '/api/analyses';

/** Profile lesen via `httpResource()`, Mutationen via `HttpClient` mit Reload danach. */
@Injectable({ providedIn: 'root' })
export class ProfilesStore {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messages = inject(MessageService);
  private readonly transloco = inject(TranslocoService);

  private readonly profilesResource = httpResource<Profile[]>(() => PROFILES_URL, { defaultValue: [] });

  readonly profiles = this.profilesResource.value;
  readonly isLoading = this.profilesResource.isLoading;
  readonly hasError = this.profilesResource.error;

  private readonly saving = signal(false);
  readonly isSaving = this.saving.asReadonly();
  private readonly failed = signal(false);
  readonly hasSaveError = this.failed.asReadonly();

  /** `onCreated` bekommt das angelegte Profil — der Editor wechselt damit in den Ändern-Modus. */
  create(draft: ProfileDraft, onCreated?: (profile: Profile) => void): void {
    this.mutate(this.http.post<Profile>(PROFILES_URL, draft), onCreated);
  }

  /** `onUpdated` löst z. B. den Neubewerten-Dialog nach einer Profiländerung aus. */
  update(id: number, draft: ProfileDraft, onUpdated?: (profile: Profile) => void): void {
    this.mutate(this.http.put<Profile>(`${PROFILES_URL}/${id}`, draft), onUpdated);
  }

  remove(id: number): void {
    this.mutate(this.http.delete<void>(`${PROFILES_URL}/${id}`));
  }

  /**
   * Re-Analyse „Bestand gegen Profil X bewerten"; `days` null = gesamter Bestand.
   * `force`: auch bereits bewertete Angebote neu bewerten (nach einer Profiländerung —
   * ohne `force` gälten sie schon als erledigt und blieben auf ihrem alten Ergebnis).
   */
  reanalyze(profileId: number, days: number | null, force = false): void {
    this.saving.set(true);
    this.failed.set(false);
    this.http
      .post<Run>(ANALYSES_URL, { profileId, days, force })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (run) => {
          this.saving.set(false);
          this.messages.add({
            severity: 'success',
            summary: this.transloco.translate('profiles.reanalysis.toast.successSummary'),
            detail: this.transloco.translate('profiles.reanalysis.toast.successDetail', { analyzed: run.analyzedOffers }),
          });
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.failed.set(true);
          const serverDetail = typeof error.error?.detail === 'string' ? error.error.detail : null;
          this.messages.add({
            severity: 'error',
            summary: this.transloco.translate('profiles.reanalysis.toast.errorSummary'),
            detail: serverDetail ?? this.transloco.translate('profiles.reanalysis.error'),
            sticky: true,
          });
        },
      });
  }

  preview(profileId: number, days: number | null, force = false): Observable<AnalysisPreview> {
    const params: Record<string, string> = { profileId: `${profileId}` };
    if (days !== null) {
      params['days'] = `${days}`;
    }
    if (force) {
      params['force'] = 'true';
    }
    return this.http.get<AnalysisPreview>(`${ANALYSES_URL}/preview`, { params });
  }

  private mutate<T>(request: Observable<T>, onSuccess?: (value: T) => void): void {
    this.saving.set(true);
    this.failed.set(false);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => {
        this.saving.set(false);
        this.profilesResource.reload();
        onSuccess?.(value);
      },
      error: () => {
        this.saving.set(false);
        this.failed.set(true);
      },
    });
  }
}
