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
    dashboard: 'Dashboard',
    profiles: 'Profiles',
  },
};

describe('App', () => {
  beforeEach(async () => {
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
});
