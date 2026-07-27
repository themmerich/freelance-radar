import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { ScoreDialog, ScorePreview } from './score-dialog';

const en = {
  profiles: {
    score: {
      title: 'Score · {{name}}',
      close: 'Close',
      cancel: 'Cancel',
      confirmTitle: 'Score the entire backlog?',
      confirmWarning: 'All {{candidates}} open offers are scored in one go.',
    },
    reanalysis: { range: 'Range', all: 'Entire backlog', days: 'Last {{days}} days', preview: '{{candidates}} offers open', run: 'Score' },
  },
};

const PREVIEW: ScorePreview = { candidates: 5, estimatedInputTokens: 4000, estimatedOutputTokens: 850 };

describe('ScoreDialog', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ScoreDialog,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    }).compileComponents();
  });

  /** `days` null = gesamter Bestand, sonst das Zeitfenster in Tagen. */
  function createDialog(days: number | null) {
    const fixture = TestBed.createComponent(ScoreDialog);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('profileName', 'Standard');
    fixture.componentRef.setInput('days', days);
    fixture.componentRef.setInput('preview', PREVIEW);
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Beide Dialoge tragen einen „Score"-Button; PrimeNG hängt sie außerhalb des Fixtures
   * ein. Deshalb erst den Dialog über seine Überschrift greifen, dann darin klicken.
   */
  function clickIn(dialogTitle: string, label: string): void {
    const dialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find((element) =>
      element.textContent?.includes(dialogTitle),
    );
    expect(dialog).toBeDefined();
    Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      .find((button) => button.textContent?.includes(label))
      ?.click();
  }

  it('shows the candidate count and the estimated cost', () => {
    createDialog(30);

    // 4000 Input- + 850 Output-Tokens auf Haiku ≈ 0,83 ct
    expect(document.body.textContent).toContain('5 offers open');
    expect(document.body.textContent).toContain('0.83');
  });

  it('scores a time window right away', () => {
    const fixture = createDialog(30);
    let scored = 0;
    fixture.componentInstance.score.subscribe(() => scored++);

    clickIn('Score · Standard', 'Score');
    fixture.detectChanges();

    expect(scored).toBe(1);
    expect(document.body.textContent).not.toContain('Score the entire backlog?');
  });

  it('asks for confirmation before scoring the entire backlog', () => {
    const fixture = createDialog(null);
    let scored = 0;
    fixture.componentInstance.score.subscribe(() => scored++);

    clickIn('Score · Standard', 'Score');
    fixture.detectChanges();

    // Erst die Warnung, noch kein Lauf — der gesamte Bestand läuft ohne Kostendeckel.
    expect(document.body.textContent).toContain('Score the entire backlog?');
    expect(document.body.textContent).toContain('All 5 open offers');
    expect(scored).toBe(0);

    clickIn('Score the entire backlog?', 'Score');
    fixture.detectChanges();

    expect(scored).toBe(1);
  });
});
