import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { OfferTable, OfferRow } from './offer-table';

const en = {
  offers: {
    empty: 'No offers yet.',
    dupBadge: 'spread {{count}}×',
    table: {
      received: 'Received',
      source: 'Source',
      agent: 'Agent',
      title: 'Project',
      company: 'Company',
      location: 'Location',
      remote: 'Remote',
      status: 'Status',
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
  remote: 'REMOTE',
  dupCount: 1,
  projectUrl: 'https://www.freelancermap.de/nproj/3026991.html',
  status: 'NEW',
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

  it('renders an offer row with source tag, agent, company, and remote label', () => {
    const fixture = TestBed.createComponent(OfferTable);
    fixture.componentRef.setInput('offers', [ROW]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';
    expect(text).toContain('Senior Angular Entwickler');
    expect(text).toContain('Angular');
    expect(text).toContain('softwareXperts GmbH');
    expect(text).toContain('Hamburg');
    expect(text).toContain('Remote');
    expect(text).toContain('New');
    expect(text).not.toContain('spread');

    const link = element.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toContain('/nproj/3026991.html');
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
