import { HttpClient, httpResource } from '@angular/common/http';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

import { AnalysisPreview, Profile, ProfileDraft } from '../domain/profile';
import { Run } from '../domain/run';

const PROFILES_URL = '/api/profiles';
const ANALYSES_URL = '/api/analyses';

/** Profile lesen via `httpResource()`, Mutationen via `HttpClient` mit Reload danach. */
@Injectable({ providedIn: 'root' })
export class ProfilesStore {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);

  private readonly profilesResource = httpResource<Profile[]>(() => PROFILES_URL, { defaultValue: [] });

  readonly profiles = this.profilesResource.value;
  readonly isLoading = this.profilesResource.isLoading;
  readonly hasError = this.profilesResource.error;

  private readonly saving = signal(false);
  readonly isSaving = this.saving.asReadonly();
  private readonly failed = signal(false);
  readonly hasSaveError = this.failed.asReadonly();

  /** Ergebnis des letzten Re-Analyse-Laufs (für die Kostenanzeige im Panel). */
  private readonly reanalysisRun = signal<Run | null>(null);
  readonly lastReanalysisRun = this.reanalysisRun.asReadonly();

  create(draft: ProfileDraft): void {
    this.mutate(this.http.post<Profile>(PROFILES_URL, draft));
  }

  update(id: number, draft: ProfileDraft): void {
    this.mutate(this.http.put<Profile>(`${PROFILES_URL}/${id}`, draft));
  }

  remove(id: number): void {
    this.mutate(this.http.delete<void>(`${PROFILES_URL}/${id}`));
  }

  activate(id: number): void {
    this.mutate(this.http.post<Profile>(`${PROFILES_URL}/${id}/activate`, {}));
  }

  /** Re-Analyse „Bestand gegen Profil X bewerten"; `days` null = gesamter Bestand. */
  reanalyze(profileId: number, days: number | null): void {
    this.saving.set(true);
    this.failed.set(false);
    this.http
      .post<Run>(ANALYSES_URL, { profileId, days })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (run) => {
          this.saving.set(false);
          this.reanalysisRun.set(run);
        },
        error: () => {
          this.saving.set(false);
          this.failed.set(true);
        },
      });
  }

  preview(profileId: number, days: number | null): Observable<AnalysisPreview> {
    const params: Record<string, string> = { profileId: `${profileId}` };
    if (days !== null) {
      params['days'] = `${days}`;
    }
    return this.http.get<AnalysisPreview>(`${ANALYSES_URL}/preview`, { params });
  }

  private mutate(request: Observable<unknown>): void {
    this.saving.set(true);
    this.failed.set(false);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.profilesResource.reload();
      },
      error: () => {
        this.saving.set(false);
        this.failed.set(true);
      },
    });
  }
}
