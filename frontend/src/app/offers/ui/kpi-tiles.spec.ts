import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { KpiTiles } from './kpi-tiles';

const en = {
  offers: {
    kpi: {
      today: 'Today',
      last7Days: '7 days',
      last30Days: '30 days',
      total: 'Total',
      averageScore: 'Avg match score',
      greenShare: 'Share 🟢',
    },
  },
};

describe('KpiTiles', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        KpiTiles,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    }).compileComponents();
  });

  it('renders all six tiles with their values', () => {
    const fixture = TestBed.createComponent(KpiTiles);
    fixture.componentRef.setInput('kpis', { today: 3, last7Days: 68, last30Days: 68, total: 124, averageScore: 41, greenShare: 12 });
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';
    expect(element.querySelectorAll('dt')).toHaveLength(6);
    expect(text).toContain('Today');
    expect(text).toContain('68');
    expect(text).toContain('Total');
    expect(text).toContain('124');
    expect(text).toContain('41');
    expect(text).toContain('12 %');
  });

  it('shows a dash while no offer is analyzed', () => {
    const fixture = TestBed.createComponent(KpiTiles);
    fixture.componentRef.setInput('kpis', { today: 0, last7Days: 0, last30Days: 0, total: 0, averageScore: null, greenShare: null });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('—');
  });
});
