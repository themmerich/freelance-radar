import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { MarketStats } from './market-stats';
import { AverageWithCount } from '../util/offer-stats';

const en = {
  offers: {
    table: { ratePerHour: '{{rate}} €/h', durationMonths: '{{months}} mo.' },
    market: { rate: 'Avg hourly rate', duration: 'Avg duration', remote: 'Avg remote share', basis: 'from {{count}} offers' },
  },
};

const NOTHING: AverageWithCount = { average: null, count: 0 };

describe('MarketStats', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MarketStats,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    }).compileComponents();
  });

  function createFixture(rate: AverageWithCount, duration = NOTHING, remote = NOTHING) {
    const fixture = TestBed.createComponent(MarketStats);
    fixture.componentRef.setInput('rate', rate);
    fixture.componentRef.setInput('duration', duration);
    fixture.componentRef.setInput('remote', remote);
    fixture.detectChanges();
    return fixture;
  }

  it('names the case count next to every figure', () => {
    const fixture = createFixture({ average: 83.35, count: 31 }, { average: 8.75, count: 326 }, { average: 74.4, count: 388 });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    // Gerundet, und die Fallzahl steht daneben — „83 €/h" allein wäre eine Marktaussage,
    // die 31 von 431 Angeboten nicht hergeben.
    expect(text).toContain('83 €/h');
    expect(text).toContain('from 31 offers');
    // Laufzeit mit einer Nachkommastelle und deutschem Dezimalkomma.
    expect(text).toContain('8,8 mo.');
    expect(text).toContain('74 %');
  });

  it('shows a dash instead of a zero when nothing is known', () => {
    const fixture = createFixture(NOTHING);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('—');
    expect(text).not.toContain('0 €/h');
    // Ohne Werte auch keine Fallzahl — „aus 0 Angeboten" wäre Lärm.
    expect(text).not.toContain('offers');
  });
});
