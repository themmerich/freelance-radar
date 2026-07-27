import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Run } from '../../shared/domain/run';

const RUNS_URL = '/api/runs';

/** Liest alle Läufe für die Kostenübersicht — reiner Read, keine Mutation nötig. */
@Injectable({ providedIn: 'root' })
export class CostsStore {
  private readonly runsResource = httpResource<Run[]>(() => RUNS_URL, { defaultValue: [] });

  readonly runs = this.runsResource.value;
  readonly isLoading = this.runsResource.isLoading;
  readonly hasError = this.runsResource.error;

  /** Läuft können anderswo entstehen (Collect-Button in der Sidebar) — beim Betreten der Seite neu laden. */
  reload(): void {
    this.runsResource.reload();
  }
}
