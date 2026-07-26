import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { App } from './app';

const en = {
  nav: {
    label: 'Main navigation',
    menu: 'Show navigation',
    close: 'Hide navigation',
    themeLight: 'Switch to light mode',
    themeDark: 'Switch to dark mode',
    dashboard: 'Dashboard',
    profiles: 'Profiles',
  },
};

/**
 * Node 22+ bringt ein eigenes `localStorage` mit, das ohne `--localstorage-file`
 * kaputt ist — auf Node 26 (CI) verdeckt es jsdoms funktionierende Implementierung
 * komplett, weil `window` hier `globalThis` ist. `ThemeStore` liest beim Erzeugen
 * synchron davon, muss also vor `TestBed.createComponent(App)` stehen.
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

describe('App', () => {
  beforeEach(async () => {
    stubLocalStorage();
    await TestBed.configureTestingModule({
      imports: [
        App,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      // Leere Routen genügen: geprüft wird die Navigation der Shell, nicht die Seiten.
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'profil', children: [] },
        ]),
        MessageService,
      ],
    }).compileComponents();
  });

  afterEach(() => {
    // ThemeStore schreibt echt auf <html> — sonst leckt ein Test in den nächsten.
    document.documentElement.classList.remove('dark');
    vi.unstubAllGlobals();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the navigation and the router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
    expect(compiled.textContent).toContain('Dashboard');
    expect(compiled.textContent).toContain('Profiles');
  });

  it('marks the link of the current route as the current page', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/profil');
    // `routerLinkActive` markiert erst im Microtask nach der Navigation.
    await fixture.whenStable();

    // Genau eine Markierung: „/“ ist `exact`, sonst wäre das Dashboard hier mit aktiv.
    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a')];
    const current = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(links).toHaveLength(2);
    expect(current).toHaveLength(1);
    expect(current[0].textContent?.trim()).toBe('Profiles');
  });

  it('opens and closes the mobile drawer', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const sidebar = element.querySelector('#app-sidebar') as HTMLElement;
    const toggle = element.querySelector('[aria-label="Show navigation"]') as HTMLElement;

    expect(sidebar.classList.contains('hidden')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    toggle.click();
    fixture.detectChanges();
    expect(sidebar.classList.contains('hidden')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    (element.querySelector('[aria-label="Hide navigation"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(sidebar.classList.contains('hidden')).toBe(true);
  });

  it('closes the drawer when a navigation link is used', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const sidebar = element.querySelector('#app-sidebar') as HTMLElement;

    (element.querySelector('[aria-label="Show navigation"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(sidebar.classList.contains('hidden')).toBe(false);

    // Sonst bliebe die Schublade nach dem Navigieren über dem Inhalt liegen.
    (element.querySelectorAll('nav a')[1] as HTMLElement).click();
    fixture.detectChanges();
    expect(sidebar.classList.contains('hidden')).toBe(true);
  });

  it('keeps the navigation as real links with an href', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll('nav a')] as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/profil']);
  });

  it('shows the topbar with the theme button on every breakpoint, not just mobile', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const themeButton = element.querySelector('[aria-label="Switch to dark mode"]');
    const topbar = themeButton?.closest('.border-b');
    // Anders als die mobile Menü-Gruppe darf die Topbar selbst kein `lg:hidden` tragen.
    expect(themeButton).not.toBeNull();
    expect(topbar?.className).not.toContain('lg:hidden');
  });

  it('toggles the dark class on <html> and flips the icon and label', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const button = () => element.querySelector('button[aria-label^="Switch to"]') as HTMLElement;

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(button().querySelector('i')?.className).toContain('pi-moon');

    button().click();
    fixture.detectChanges();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(button().getAttribute('aria-label')).toBe('Switch to light mode');
    expect(button().querySelector('i')?.className).toContain('pi-sun');
  });

  it('lets the theme button shrink the brand name instead of pushing itself off-screen', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const menuButton = (fixture.nativeElement as HTMLElement).querySelector('[aria-controls="app-sidebar"]') as HTMLElement;
    const brandName = menuButton.nextElementSibling as HTMLElement;
    // Direkte Geschwister im selben Flex-Row, kein verschachteltes `flex`: ein zweiter
    // Schrumpf-Container schrumpft in Chromium nicht zuverlässig unter seine Content-Breite.
    expect(brandName.tagName).toBe('SPAN');
    expect(brandName.className).toContain('min-w-0');
    expect(brandName.className).toContain('truncate');
  });
});
