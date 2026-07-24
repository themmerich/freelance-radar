import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'freelance-radar.settings';

type PersistedSettings = {
  greenThreshold: number;
  yellowThreshold: number;
  collapseDuplicates: boolean;
};

const DEFAULTS: PersistedSettings = {
  // Ampel-Schwellen wie in v1: 🟢 ≥ 70, 🟡 ≥ 40.
  greenThreshold: 70,
  yellowThreshold: 40,
  collapseDuplicates: true,
};

/** Dashboard-Einstellungen (Ampel-Schwellen, Duplikat-Toggle), in localStorage persistiert. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly state = signal<PersistedSettings>(load());

  readonly greenThreshold = () => this.state().greenThreshold;
  readonly yellowThreshold = () => this.state().yellowThreshold;
  readonly collapseDuplicates = () => this.state().collapseDuplicates;
  readonly settings = this.state.asReadonly();

  setGreenThreshold(value: number): void {
    this.update({ greenThreshold: clampScore(value) });
  }

  setYellowThreshold(value: number): void {
    this.update({ yellowThreshold: clampScore(value) });
  }

  setCollapseDuplicates(value: boolean): void {
    this.update({ collapseDuplicates: value });
  }

  private update(patch: Partial<PersistedSettings>): void {
    const next = { ...this.state(), ...patch };
    this.state.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ohne localStorage (z.B. strikte Privacy-Einstellungen) gelten die Werte nur für die Session.
    }
  }
}

function clampScore(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;
}

function load(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PersistedSettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}
