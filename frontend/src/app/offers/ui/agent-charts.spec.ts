import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ChartModule } from 'primeng/chart';

import { AgentCharts } from './agent-charts';

const en = {
  offers: {
    charts: {
      perDay: 'Offers per day (30 days)',
      perMonth: 'Requests per month (12 months)',
      perMonthOffers: 'Requests',
      perMonthAverage: 'Avg per month',
      scoreTrend: 'Avg match score per day (30 days)',
      scores: 'Match score distribution',
      topSkills: 'Top requested skills',
      topGaps: 'Top skill gaps',
    },
  },
};

/** Chart.js braucht ein echtes Canvas (fehlt in jsdom) — der Stub hält die Inputs fürs Assert bereit. */
// eslint-disable-next-line @angular-eslint/component-selector -- muss PrimeNGs p-chart im Template ersetzen
@Component({ selector: 'p-chart', template: '' })
class ChartStub {
  readonly type = input<string>();
  readonly data = input<{ labels: unknown[]; datasets: { data: unknown[] }[] }>();
  readonly options = input<object>();
  readonly height = input<string>();
}

describe('AgentCharts', () => {
  beforeEach(async () => {
    TestBed.overrideComponent(AgentCharts, { remove: { imports: [ChartModule] }, add: { imports: [ChartStub] } });
    await TestBed.configureTestingModule({
      imports: [
        AgentCharts,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(AgentCharts);
    fixture.componentRef.setInput('perDay', { labels: ['01.07.'], counts: [1] });
    fixture.componentRef.setInput('perMonth', { labels: ['07.26'], counts: [1], average: 0.1 });
    fixture.componentRef.setInput('scoreTrend', { labels: ['01.07.'], averages: [80] });
    fixture.componentRef.setInput('histogram', [0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
    fixture.componentRef.setInput('skills', [{ name: 'Angular', count: 2 }]);
    fixture.componentRef.setInput('gaps', [{ name: 'Kotlin', count: 1 }]);
    fixture.componentRef.setInput('greenThreshold', 70);
    fixture.componentRef.setInput('yellowThreshold', 40);
    fixture.componentRef.setInput('dark', false);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the six agent charts with their titles', () => {
    const fixture = createFixture();

    const captions = [...(fixture.nativeElement as HTMLElement).querySelectorAll('figcaption')].map((c) => c.textContent?.trim());
    expect(captions).toEqual([
      'Offers per day (30 days)',
      'Requests per month (12 months)',
      'Avg match score per day (30 days)',
      'Match score distribution',
      'Top requested skills',
      'Top skill gaps',
    ]);
  });

  it('passes skills and gaps as labels of the bar charts', () => {
    const fixture = createFixture();

    // Reihenfolge wie im Template: pro Tag, pro Monat, Trend, Verteilung, Skills, Gaps.
    const charts = fixture.debugElement.queryAll(By.directive(ChartStub)).map((chart) => chart.componentInstance as ChartStub);
    expect(charts).toHaveLength(6);
    expect(charts[4].data()?.labels).toEqual(['Angular']);
    expect(charts[5].data()?.labels).toEqual(['Kotlin']);
  });

  it('draws the monthly average as a flat line next to the monthly counts', () => {
    const fixture = createFixture();

    const perMonth = fixture.debugElement.queryAll(By.directive(ChartStub))[1].componentInstance as ChartStub;
    expect(perMonth.data()?.datasets.map((dataset) => dataset.data)).toEqual([[1], [0.1]]);
  });
});
