import { TestBed } from '@angular/core/testing';

import { ThemeStore } from './theme-store';

const STORAGE_KEY = 'freelance-radar.theme';

describe('ThemeStore', () => {
  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    document.documentElement.classList.remove('dark');
    vi.unstubAllGlobals();
  });

  // Die Testumgebung kennt `window.matchMedia` von sich aus nicht — deshalb prüft
  // `load()` produktiv mit `?.`, und der Test muss es erst per Stub bereitstellen.
  function stubOsDark(matches: boolean): void {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia);
  }

  it('falls back to the OS preference when nothing is stored', () => {
    stubOsDark(true);

    const store = TestBed.inject(ThemeStore);

    expect(store.dark()).toBe(true);
  });

  it('applies the initial value to <html> without waiting for a change', () => {
    window.localStorage.setItem(STORAGE_KEY, 'true');

    TestBed.inject(ThemeStore);
    TestBed.tick();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists the choice and toggles the class on <html>', () => {
    const store = TestBed.inject(ThemeStore);

    store.setDark(true);
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');

    store.setDark(false);
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('prefers the stored choice over the OS preference', () => {
    window.localStorage.setItem(STORAGE_KEY, 'false');
    stubOsDark(true);

    expect(TestBed.inject(ThemeStore).dark()).toBe(false);
  });
});
