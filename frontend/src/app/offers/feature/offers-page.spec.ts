import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ChartModule } from 'primeng/chart';

import { OffersStore } from '../data-access/offers-store';
import { SettingsStore } from '../data-access/settings-store';
import { ThemeStore } from '../../shared/data-access/theme-store';
import { Offer } from '../domain/offer';
import { AgentCharts } from '../ui/agent-charts';
import { OfferCharts } from '../ui/offer-charts';
import { OffersPage } from './offers-page';

const en = {
  offers: {
    kpi: {
      today: 'Today',
      last7Days: '7 days',
      last30Days: '30 days',
      averageScore: 'Avg match score',
      greenShare: 'Share 🟢',
    },
    charts: {
      perDay: 'Offers per day (30 days)',
      perMonth: 'Requests per month (12 months)',
      perMonthOffers: 'Requests',
      perMonthAverage: 'Avg per month',
      scoreTrend: 'Avg match score per day (30 days)',
      remote: 'Remote share',
      remoteUnknown: 'Unknown',
      agents: 'Triggers per agent',
      agentScores: 'Avg match score per agent',
      roles: 'Requested job profiles',
      topSkills: 'Top requested skills',
      topGaps: 'Top skill gaps',
      scores: 'Match score distribution',
    },
    tabs: {
      global: 'Overall',
      agentAnalysis: 'Agent analysis',
    },
    agentAnalysis: {
      agent: 'Agent',
      empty: 'No offers from search agents yet.',
    },
    remote: { REMOTE: 'Remote', HYBRID: 'Hybrid', ONSITE: 'On-site' },
  },
};

/** Chart.js braucht ein echtes Canvas (fehlt in jsdom) — der Stub reicht fürs Verdrahten der Seite. */
// eslint-disable-next-line @angular-eslint/component-selector -- muss PrimeNGs p-chart im Template ersetzen
@Component({ selector: 'p-chart', template: '' })
class ChartStub {
  readonly type = input<string>();
  readonly data = input<object>();
  readonly options = input<object>();
  readonly height = input<string>();
}

let nextOfferId = 1;

function makeOffer(patch: Partial<Offer>): Offer {
  return {
    id: nextOfferId++,
    receivedAt: new Date().toISOString(),
    fromAddr: null,
    subject: null,
    sourceType: 'AGENT',
    agentName: 'AI',
    projectTitle: null,
    company: null,
    role: null,
    location: null,
    country: null,
    remote: null,
    rate: null,
    startDate: null,
    duration: null,
    projectUrl: null,
    matchScore: null,
    matchReason: null,
    seniority: null,
    industry: null,
    primary: true,
    dupCount: 1,
    status: 'NEW',
    skills: [],
    ...patch,
  };
}

/** 2× „AI“ (stärkster Agent), 1× „Angular“, 1 private Anfrage — Skills klar pro Agent getrennt. */
function defaultOffers(): Offer[] {
  return [
    makeOffer({ agentName: 'AI', matchScore: 80, skills: [{ name: 'LLM', gap: false }] }),
    makeOffer({
      agentName: 'AI',
      matchScore: 60,
      skills: [
        { name: 'LLM', gap: false },
        { name: 'MCP', gap: true },
      ],
    }),
    makeOffer({ agentName: 'Angular', matchScore: 90, skills: [{ name: 'Kotlin', gap: true }] }),
    makeOffer({ sourceType: 'PRIVATE', agentName: null, skills: [{ name: 'Vue', gap: true }] }),
  ];
}

/** jsdom kennt keinen `ResizeObserver` — PrimeNGs Tab-Liste bindet beim Init einen für die Scroll-Pfeile. */
function stubResizeObserver(): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly targets = new Set<Element>();

      observe(target: Element): void {
        this.targets.add(target);
      }

      unobserve(target: Element): void {
        this.targets.delete(target);
      }

      disconnect(): void {
        this.targets.clear();
      }
    },
  );
}

describe('OffersPage', () => {
  let offers: ReturnType<typeof signal<Offer[]>>;

  beforeEach(async () => {
    stubResizeObserver();
    offers = signal<Offer[]>(defaultOffers());
    TestBed.overrideComponent(OfferCharts, { remove: { imports: [ChartModule] }, add: { imports: [ChartStub] } });
    TestBed.overrideComponent(AgentCharts, { remove: { imports: [ChartModule] }, add: { imports: [ChartStub] } });
    await TestBed.configureTestingModule({
      imports: [
        OffersPage,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: OffersStore, useValue: { offers, isLoading: signal(false), hasError: signal(undefined) } },
        {
          provide: SettingsStore,
          useValue: {
            settings: signal({ greenThreshold: 70, yellowThreshold: 40, collapseDuplicates: true }),
            greenThreshold: () => 70,
            yellowThreshold: () => 40,
          },
        },
        { provide: ThemeStore, useValue: { dark: signal(false) } },
      ],
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(OffersPage);
    fixture.detectChanges();
    return fixture;
  }

  function agentCharts(fixture: ReturnType<typeof createFixture>): AgentCharts {
    return fixture.debugElement.query(By.directive(AgentCharts)).componentInstance as AgentCharts;
  }

  function tabs(fixture: ReturnType<typeof createFixture>): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]')];
  }

  function panels(fixture: ReturnType<typeof createFixture>): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  }

  function openAgentTab(fixture: ReturnType<typeof createFixture>): void {
    tabs(fixture)[1].click();
    fixture.detectChanges();
  }

  it('splits the charts into a global and an agent tab', () => {
    const fixture = createFixture();

    expect(tabs(fixture).map((tab) => tab.textContent?.trim())).toEqual(['Overall', 'Agent analysis']);
    expect(panels(fixture)[0].querySelector('app-offer-charts')).not.toBeNull();
    expect(panels(fixture)[0].hidden).toBe(false);
    expect(panels(fixture)[1].hidden).toBe(true);
  });

  it('renders the agent charts only once their tab is open', () => {
    const fixture = createFixture();

    // Lazy: versteckt würde Chart.js auf 0×0 messen und danach nicht mehr nachwachsen.
    expect(panels(fixture)[1].querySelector('app-agent-charts')).toBeNull();

    openAgentTab(fixture);

    expect(panels(fixture)[1].hidden).toBe(false);
    expect(panels(fixture)[1].querySelector('app-agent-charts')).not.toBeNull();
  });

  it('preselects the agent with the most offers', () => {
    const fixture = createFixture();
    openAgentTab(fixture);

    const select = (fixture.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('AI');
    expect([...select.options].map((option) => option.value)).toEqual(['AI', 'Angular']);
  });

  it('filters the detail charts to the offers of the selected agent', () => {
    const fixture = createFixture();
    openAgentTab(fixture);

    // Nur die beiden „AI“-Angebote zählen — weder „Kotlin“ (Angular) noch „Vue“ (privat).
    expect(agentCharts(fixture).skills()).toEqual([
      { name: 'LLM', count: 2 },
      { name: 'MCP', count: 1 },
    ]);
    expect(agentCharts(fixture).gaps()).toEqual([{ name: 'MCP', count: 1 }]);
    expect(
      agentCharts(fixture)
        .perDay()
        .counts.reduce((sum, count) => sum + count, 0),
    ).toBe(2);
    expect(
      agentCharts(fixture)
        .perMonth()
        .counts.reduce((sum, count) => sum + count, 0),
    ).toBe(2);
  });

  it('keeps the selected agent when it still exists after a reload', () => {
    const fixture = createFixture();
    openAgentTab(fixture);
    fixture.componentInstance['selectedAgent'].set('Angular');
    fixture.detectChanges();

    offers.update((current) => [...current, makeOffer({ agentName: 'AI' })]);
    fixture.detectChanges();

    expect(agentCharts(fixture).gaps()).toEqual([{ name: 'Kotlin', count: 1 }]);
  });

  it('falls back to the strongest agent when the selected one disappears', () => {
    const fixture = createFixture();
    openAgentTab(fixture);
    fixture.componentInstance['selectedAgent'].set('Angular');
    fixture.detectChanges();

    offers.update((current) => current.filter((offer) => offer.agentName !== 'Angular'));
    fixture.detectChanges();

    expect(agentCharts(fixture).skills()).toEqual([
      { name: 'LLM', count: 2 },
      { name: 'MCP', count: 1 },
    ]);
  });

  it('replaces the agent section with a hint when there are no agent offers', () => {
    offers.set([makeOffer({ sourceType: 'PRIVATE', agentName: null })]);
    const fixture = createFixture();
    openAgentTab(fixture);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('No offers from search agents yet.');
    expect(element.querySelector('select')).toBeNull();
    expect(fixture.debugElement.query(By.directive(AgentCharts))).toBeNull();
  });
});
