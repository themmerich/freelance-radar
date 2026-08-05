import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ChartModule } from 'primeng/chart';

import { AgentCharts } from './agent-charts';

const en = {
  offers: {
    charts: {
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

  it('renders the four agent charts with their titles', () => {
    const fixture = createFixture();

    const captions = [...(fixture.nativeElement as HTMLElement).querySelectorAll('figcaption')].map((c) => c.textContent?.trim());
    expect(captions).toEqual(['Avg match score per day (30 days)', 'Match score distribution', 'Top requested skills', 'Top skill gaps']);
  });

  it('passes skills and gaps as labels of the bar charts', () => {
    const fixture = createFixture();

    // Reihenfolge wie im Template: Trend, Verteilung, Skills, Gaps.
    const charts = fixture.debugElement.queryAll(By.directive(ChartStub)).map((chart) => chart.componentInstance as ChartStub);
    expect(charts).toHaveLength(4);
    expect(charts[2].data()?.labels).toEqual(['Angular']);
    expect(charts[3].data()?.labels).toEqual(['Kotlin']);
  });
});
