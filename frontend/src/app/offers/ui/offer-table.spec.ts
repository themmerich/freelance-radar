import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { OfferTable, OfferRow } from './offer-table';

const en = {
  offers: {
    empty: 'No offers yet.',
    table: {
      received: 'Received',
      source: 'Source',
      agent: 'Agent',
      title: 'Project',
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
  location: 'Hamburg',
  remote: 'REMOTE',
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

  it('renders an offer row with source tag, agent, and remote label', () => {
    const fixture = TestBed.createComponent(OfferTable);
    fixture.componentRef.setInput('offers', [ROW]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Senior Angular Entwickler');
    expect(text).toContain('Angular');
    expect(text).toContain('Hamburg');
    expect(text).toContain('Remote');
    expect(text).toContain('New');
  });

  it('shows the empty message when there are no offers', () => {
    const fixture = TestBed.createComponent(OfferTable);
    fixture.componentRef.setInput('offers', []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No offers yet.');
  });
});
