import { Injectable, effect, signal } from '@angular/core';

const STORAGE_KEY = 'freelance-radar.theme';

/**
 * Hell/Dunkel-Modus, in localStorage persistiert. Liegt im Shared Kernel statt auf
 * Root-Ebene, weil sowohl die App-Shell (Topbar-Switch) als auch `offers` (Charts
 * folgen der Wahl) darauf zugreifen — root darf laut Sheriff nicht von Scopes aus
 * importiert werden.
 */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly state = signal<boolean>(load());
  readonly dark = this.state.asReadonly();

  constructor() {
    // Läuft auch einmal sofort mit dem Startwert — Tailwinds `dark:`-Variante
    // (`@custom-variant dark` in styles.css) und PrimeNGs `darkModeSelector:
    // '.dark'` (app.config.ts) hängen beide an dieser Klasse auf <html>.
    effect(() => document.documentElement.classList.toggle('dark', this.state()));
  }

  setDark(value: boolean): void {
    this.state.set(value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Ohne localStorage (z.B. strikte Privacy-Einstellungen) gilt die Wahl nur für die Session.
    }
  }
}

/** Ohne gespeicherte Wahl entscheidet die OS-Einstellung — danach übernimmt der Switch. */
function load(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      return JSON.parse(raw) as boolean;
    }
  } catch {
    // Fällt unten auf die OS-Einstellung zurück.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}
