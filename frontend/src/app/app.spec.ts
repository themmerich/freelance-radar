import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { MessageService } from 'primeng/api';
import { App } from './app';

const en = { nav: { label: 'Main navigation', dashboard: 'Dashboard', profiles: 'Profiles' } };

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
      providers: [provideRouter([]), MessageService],
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

  it('marks the tab of the current route as selected', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    // Ohne Navigation steht die URL auf „/“ — also ist das Dashboard aktiv.
    const tabs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]')];
    const selected = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true');
    expect(tabs).toHaveLength(2);
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent?.trim()).toBe('Dashboard');
  });
});
