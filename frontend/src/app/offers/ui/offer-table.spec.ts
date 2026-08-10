import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Table } from 'primeng/table';

import { OfferTable, OfferRow } from './offer-table';

const en = {
  offers: {
    empty: 'No offers yet.',
    dupBadge: 'spread {{count}}×',
    table: {
      details: 'Details',
      received: 'Received',
      score: 'Match',
      source: 'Source',
      agent: 'Agent',
      title: 'Project',
      roleCategory: 'Job profile',
      company: 'Company',
      country: 'Country',
      location: 'Location',
      remote: 'Remote',
      rate: 'Rate',
      ratePerHour: '{{rate}} €/h',
      duration: 'Duration',
      durationMonths: '{{months}} mo.',
      status: 'Status',
      pageReport: '{first}–{last} of {totalRecords}',
      filterAll: 'All',
      filterLabel: 'Filter by {{column}}',
    },
    detail: {
      notAnalyzed: 'Not analyzed yet.',
      skills: 'Skills (red = missing from profile)',
      role: 'Role per analysis',
      budget: 'Budget',
      start: 'Start',
      startImmediate: 'immediately',
      duration: 'Duration',
      utilization: 'Utilisation',
      remoteShare: 'Remote share',
    },
    budgetKind: { HOURLY: '{{amount}} € per hour', DAILY: '{{amount}} € per day', TOTAL: '{{amount}} € total' },
    source: { AGENT: 'Agent', PRIVATE: 'Private', NEWSLETTER: 'Newsletter', OTHER: 'Other' },
    remote: { REMOTE: 'Remote', HYBRID: 'Hybrid', ONSITE: 'On-site' },
    roleCategory: { FRONTEND: 'Frontend', FULLSTACK: 'Fullstack', OTHER: 'Other' },
    status: { NEW: 'New', ANALYZED: 'Analyzed', ERROR: 'Error' },
  },
};

const ROW: OfferRow = {
  id: 7,
  receivedAt: '2026-07-22T09:15:00Z',
  sourceType: 'AGENT',
  agentName: 'Angular',
  title: 'Senior Angular Entwickler',
  role: 'Senior Angular Entwickler',
  roleCategory: 'FRONTEND',
  company: 'softwareXperts GmbH',
  location: 'Hamburg',
  country: 'AT',
  remote: 'REMOTE',
  dupCount: 1,
  projectUrl: 'https://www.freelancermap.de/nproj/3026991.html',
  matchScore: 85,
  matchReason: 'Kern-Stack Angular, remote — passt sehr gut zum Profil.',
  startDate: '09/2026',
  budgetEur: 95,
  budgetKind: 'HOURLY',
  durationMonths: 6,
  utilizationPercent: 100,
  remotePercent: 80,
  startMonth: null,
  startImmediate: false,
  skills: [
    { name: 'Angular', gap: false },
    { name: 'Kotlin', gap: true },
  ],
  status: 'ANALYZED',
};

describe('OfferTable', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        OfferTable,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    }).compileComponents();
  });

  it('renders an offer row with score tag, source, agent, company, and remote label', () => {
    const fixture = TestBed.createComponent(OfferTable);
    fixture.componentRef.setInput('offers', [ROW]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';
    expect(text).toContain('85');
    expect(text).toContain('Senior Angular Entwickler');
    expect(text).toContain('softwareXperts GmbH');
    expect(text).toContain('🇦🇹 AT');
    expect(text).toContain('Hamburg');
    expect(text).toContain('Analyzed');
    expect(text).not.toContain('spread');
    // Die Detail-Zeile ist eingeklappt — die Begründung erscheint erst nach dem Toggle.
    expect(text).not.toContain('passt sehr gut');

    const link = element.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toContain('/nproj/3026991.html');
  });

  it('expands a row to show the match reason and the skill gaps', async () => {
    const fixture = TestBed.createComponent(OfferTable);
    fixture.componentRef.setInput('offers', [ROW]);
    fixture.detectChanges();

    // Die pRowToggler-Direktive sitzt auf dem p-button-Host, nicht auf dem inneren Button.
    const element = fixture.nativeElement as HTMLElement;
    (element.querySelector('p-button') as HTMLElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = element.textContent ?? '';
    expect(text).toContain('Kern-Stack Angular, remote — passt sehr gut zum Profil.');
    expect(text).toContain('Kotlin');
    expect(text).toContain('95 € per hour');
  });

  it('shows an hourly rate in the rate column', () => {
    const fixture = TestBed.createComponent(OfferTable);
    fixture.componentRef.setInput('offers', [ROW]);
    fixture.detectChanges();

    const cells = [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody td')].map((cell) => cell.textContent?.trim());
    expect(cells).toContain('95 €/h');
    expect(cells).toContain('6 mo.');
  });

  it('leaves the rate column empty for a day rate rather than passing it off as hourly', () => {
    const fixture = TestBed.createComponent(OfferTable);
    // 649 € ist ein Tagessatz — in der Satz-Spalte stünde sonst „649 €/h".
    fixture.componentRef.setInput('offers', [{ ...ROW, budgetEur: 649, budgetKind: 'DAILY' }]);
    fixture.detectChanges();

    const cells = [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody td')].map((cell) => cell.textContent?.trim());
    expect(cells).not.toContain('649 €/h');
    expect(cells).toContain('—');
  });

  it('shows the duplicate badge when several agents caught the same project', () => {
    const fixture = TestBed.createComponent(OfferTable);
    fixture.componentRef.setInput('offers', [{ ...ROW, dupCount: 3 }]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('spread 3×');
  });

  it('shows the empty message when there are no offers', () => {
    const fixture = TestBed.createComponent(OfferTable);
    fixture.componentRef.setInput('offers', []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No offers yet.');
  });

  it('renders only one page of rows and reports the page range', () => {
    const fixture = TestBed.createComponent(OfferTable);
    fixture.componentRef.setInput(
      'offers',
      Array.from({ length: 30 }, (_, index) => ({ ...ROW, id: index + 1 })),
    );
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(element.textContent).toContain('1–10 of 30');
    // Das Seitengrößen-Dropdown des Paginators bietet die vier Stufen an.
    expect(element.querySelector('p-select')).not.toBeNull();
  });

  it('scrolls horizontally instead of squeezing the columns', () => {
    const fixture = TestBed.createComponent(OfferTable);
    fixture.componentRef.setInput('offers', [ROW]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('table')?.className).toContain('min-w-[88rem]');
  });

  it('filters rows by column value', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(OfferTable);
      fixture.componentRef.setInput('offers', [ROW, { ...ROW, id: 8, sourceType: 'PRIVATE' as const, company: 'Direkt AG' }]);
      fixture.detectChanges();

      const table = fixture.debugElement.query(By.directive(Table)).componentInstance as Table;
      table.filter('PRIVATE', 'sourceType', 'equals');
      // PrimeNG entprellt Filter um `filterDelay` (300 ms), sonst greift der Filter noch nicht.
      vi.advanceTimersByTime(300);
      fixture.detectChanges();

      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
      expect(element.textContent).toContain('Direkt AG');
      expect(element.textContent).not.toContain('softwareXperts GmbH');
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers a filter for every filterable column', () => {
    const fixture = TestBed.createComponent(OfferTable);
    fixture.componentRef.setInput('offers', [ROW]);
    fixture.detectChanges();

    // Match, Quelle, Agent, Projekt, Berufsprofil, Firma, Land, Ort, Remote, Status — „Eingegangen" bleibt sortierbar.
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('p-column-filter')).toHaveLength(10);
  });
});
