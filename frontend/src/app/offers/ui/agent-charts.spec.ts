import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ChartModule } from 'primeng/chart';

import { AgentCharts } from './agent-charts';

const en = {
  offers: {
    charts: {
      perDay: 'Offers per day',
      perWeek: 'Offers per week',
      offersLegend: 'Offers',
      averagePerDay: 'Avg per day',
      averagePerWeek: 'Avg per week',
      scoreTrendDay: 'Avg match score per day',
      scoreTrendWeek: 'Avg match score per week',
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

  function createFixture(bucket: 'day' | 'week' = 'day') {
    const fixture = TestBed.createComponent(AgentCharts);
    fixture.componentRef.setInput('counts', { labels: ['01.07.'], counts: [1], average: 0.1 });
    fixture.componentRef.setInput('bucket', bucket);
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

  it('renders the five agent charts with their titles', () => {
    const fixture = createFixture();

    const captions = [...(fixture.nativeElement as HTMLElement).querySelectorAll('figcaption')].map((c) => c.textContent?.trim());
    expect(captions).toEqual([
      'Offers per day',
      'Avg match score per day',
      'Match score distribution',
      'Top requested skills',
      'Top skill gaps',
    ]);
  });

  it('names both time series after the resolution it was given', () => {
    const fixture = createFixture('week');

    const captions = [...(fixture.nativeElement as HTMLElement).querySelectorAll('figcaption')].map((c) => c.textContent?.trim());
    expect(captions.slice(0, 2)).toEqual(['Offers per week', 'Avg match score per week']);
  });

  it('passes skills and gaps as labels of the bar charts', () => {
    const fixture = createFixture();

    // Reihenfolge wie im Template: Zeitreihe, Score-Trend, Verteilung, Skills, Gaps.
    const charts = fixture.debugElement.queryAll(By.directive(ChartStub)).map((chart) => chart.componentInstance as ChartStub);
    expect(charts).toHaveLength(5);
    expect(charts[3].data()?.labels).toEqual(['Angular']);
    expect(charts[4].data()?.labels).toEqual(['Kotlin']);
  });

  it('draws the average as a flat line next to the counts', () => {
    const fixture = createFixture();

    const counts = fixture.debugElement.queryAll(By.directive(ChartStub))[0].componentInstance as ChartStub;
    expect(counts.data()?.datasets.map((dataset) => dataset.data)).toEqual([[1], [0.1]]);
  });
});
