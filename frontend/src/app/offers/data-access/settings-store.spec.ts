import { TestBed } from '@angular/core/testing';

import { SettingsStore } from './settings-store';

const STORAGE_KEY = 'freelance-radar.settings';

/**
 * Node 22+ bringt ein eigenes `localStorage` mit, das ohne `--localstorage-file`
 * kaputt ist — deshalb dieselbe Stub-Strategie wie im ThemeStore-Spec. Frisch pro
 * Test, damit keine Einstellung in den nächsten durchsickert.
 */
function stubLocalStorage(): void {
  const backing = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => backing.set(key, value),
    removeItem: (key: string) => backing.delete(key),
    clear: () => backing.clear(),
    key: (index: number) => [...backing.keys()][index] ?? null,
    get length() {
      return backing.size;
    },
  } satisfies Storage);
}

describe('SettingsStore', () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts on the 30-day window when nothing is stored', () => {
    expect(TestBed.inject(SettingsStore).range()).toBe('30d');
  });

  it('keeps the stored window across a reload', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ greenThreshold: 70, yellowThreshold: 40, range: '12m' }));

    expect(TestBed.inject(SettingsStore).range()).toBe('12m');
  });

  it('falls back to the default for settings saved before the window existed', () => {
    // Einstellungen aus einer Version ohne `range` — der Merge über DEFAULTS fängt das ab.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ greenThreshold: 80, yellowThreshold: 50, collapseDuplicates: false }));

    const store = TestBed.inject(SettingsStore);

    expect(store.range()).toBe('30d');
    expect(store.greenThreshold()).toBe(80);
  });

  it('persists a changed window without losing the other settings', () => {
    const store = TestBed.inject(SettingsStore);
    store.setGreenThreshold(65);

    store.setRange('90d');

    expect(store.range()).toBe('90d');
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ range: '90d', greenThreshold: 65 });
  });
});
