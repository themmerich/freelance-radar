import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { CostRow, CostTable } from './cost-table';

const en = {
  offers: {
    table: {
      pageReport: '{first}–{last} of {totalRecords}',
    },
  },
  costs: {
    empty: 'No runs yet.',
    table: {
      ranAt: 'Run',
      analyzed: 'Analyzed',
      inputTokens: 'Input tokens',
      outputTokens: 'Output tokens',
      cost: 'Cost',
    },
  },
};

const ROW: CostRow = {
  id: 1,
  ranAt: '2026-07-22T09:15:00Z',
  analyzedOffers: 2,
  inputTokens: 12000,
  outputTokens: 800,
  costCents: 1.6,
};

describe('CostTable', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CostTable,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    }).compileComponents();
  });

  it('renders a run row with tokens and the estimated cost', () => {
    const fixture = TestBed.createComponent(CostTable);
    fixture.componentRef.setInput('runs', [ROW]);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('2');
    expect(text).toContain('12000');
    expect(text).toContain('800');
    expect(text).toContain('≈1.6 ct');
  });

  it('shows the empty message without any runs', () => {
    const fixture = TestBed.createComponent(CostTable);
    fixture.componentRef.setInput('runs', []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No runs yet.');
  });
});
