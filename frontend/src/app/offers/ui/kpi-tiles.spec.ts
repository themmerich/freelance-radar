import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { KpiTiles, KpiTileData } from './kpi-tiles';

const en = {
  offers: {
    kpi: {
      today: 'Today',
      last7Days: '7 days',
      last30Days: '30 days',
      total: 'Total',
      averageScore: 'Avg match score (30 days)',
      greenShare: 'Share 🟢 (30 days)',
      versusPrevious: 'versus previous period',
      noComparison: 'no comparison',
      deltaPercent: '{{value}} %',
      deltaPercentagePoints: '{{value}} pp',
    },
  },
};

function kpis(overrides: Partial<KpiTileData> = {}): KpiTileData {
  return {
    today: 3,
    last7Days: { value: 68, delta: null },
    last30Days: { value: 68, delta: null },
    total: 124,
    averageScore: { value: 41, delta: null },
    greenShare: { value: 12, delta: null },
    ...overrides,
  };
}

function render(data: KpiTileData): HTMLElement {
  const fixture = TestBed.createComponent(KpiTiles);
  fixture.componentRef.setInput('kpis', data);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

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
    const element = render(kpis());
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
    const element = render(kpis({ averageScore: { value: null, delta: null }, greenShare: { value: null, delta: null } }));

    expect(element.textContent).toContain('—');
  });

  it('renders a rising count delta as a relative percentage', () => {
    const element = render(kpis({ last7Days: { value: 68, delta: 12 } }));
    const text = element.textContent ?? '';

    expect(text).toContain('+12 %');
    expect(text).toContain('versus previous period');
    expect(element.querySelector('.text-green-600')).not.toBeNull();
  });

  it('renders a falling score delta in points, without a unit', () => {
    const element = render(kpis({ averageScore: { value: 41, delta: -4 } }));
    const text = element.textContent ?? '';

    expect(text).toContain('−4');
    expect(text).not.toContain('−4 %');
    expect(element.querySelector('.text-red-600')).not.toBeNull();
  });

  it('renders the green share delta in percentage points', () => {
    const element = render(kpis({ greenShare: { value: 12, delta: 3 } }));

    expect(element.textContent).toContain('+3 pp');
  });

  it('hides the arrow from assistive technology', () => {
    const element = render(kpis({ last7Days: { value: 68, delta: 12 } }));
    const arrow = element.querySelector('[aria-hidden="true"]');

    expect(arrow?.textContent).toBe('▲');
  });

  it('drops the arrow but keeps the sign when nothing changed', () => {
    const element = render(kpis({ last7Days: { value: 68, delta: 0 } }));

    expect(element.textContent).toContain('±0 %');
    expect(element.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('explains a missing comparison instead of showing a delta', () => {
    const element = render(kpis({ last30Days: { value: 428, delta: null } }));

    expect(element.textContent).toContain('no comparison');
  });

  it('stays silent about the comparison while the value itself is missing', () => {
    const element = render(kpis({ averageScore: { value: null, delta: null }, greenShare: { value: null, delta: null } }));
    const hints = (element.textContent ?? '').match(/no comparison/g) ?? [];

    // Nur die beiden Zählkacheln dürfen den Hinweis tragen, nicht die leeren Qualitätskacheln.
    expect(hints).toHaveLength(2);
  });

  it('leaves today and total without any comparison', () => {
    const element = render(kpis({ last7Days: { value: 68, delta: 12 }, last30Days: { value: 68, delta: 12 } }));
    const tiles = Array.from(element.querySelectorAll('dd'));

    expect(tiles[0].textContent).not.toContain('versus previous period');
    expect(tiles[3].textContent).not.toContain('versus previous period');
  });
});
