import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

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
      company: 'Company',
      country: 'Country',
      location: 'Location',
      remote: 'Remote',
      status: 'Status',
    },
    detail: {
      notAnalyzed: 'Not analyzed yet.',
      skills: 'Skills (red = missing from profile)',
      rate: 'Rate',
      start: 'Start',
      duration: 'Duration',
    },
    source: { AGENT: 'Agent', PRIVATE: 'Private', NEWSLETTER: 'Newsletter', OTHER: 'Other' },
    remote: { REMOTE: 'Remote', HYBRID: 'Hybrid', ONSITE: 'On-site' },
    status: { NEW: 'New', ANALYZED: 'Analyzed', ERROR: 'Error' },
  },
};

const ROW: OfferRow = {
  id: 7,
  receivedAt: '2026-07-22T09:15:00Z',
  sourceType: 'AGENT',
  agentName: 'Angular',
  title: 'Senior Angular Entwickler',
  company: 'softwareXperts GmbH',
  location: 'Hamburg',
  country: 'AT',
  remote: 'REMOTE',
  dupCount: 1,
  projectUrl: 'https://www.freelancermap.de/nproj/3026991.html',
  matchScore: 85,
  matchReason: 'Kern-Stack Angular, remote — passt sehr gut zum Profil.',
  rate: '95,00 €/h',
  startDate: '09/2026',
  duration: '6 Monate',
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
    expect(text).toContain('95,00 €/h');
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
});
