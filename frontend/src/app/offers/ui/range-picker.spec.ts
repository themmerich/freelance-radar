import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { RangePicker } from './range-picker';
import { TimeRange } from '../util/offer-stats';

const en = {
  offers: {
    range: { label: 'Time range', '30d': '30 days', '90d': '90 days', '12m': '12 months', all: 'All' },
  },
};

describe('RangePicker', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RangePicker,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    }).compileComponents();
  });

  function createFixture(range: TimeRange = '30d') {
    const fixture = TestBed.createComponent(RangePicker);
    fixture.componentRef.setInput('range', range);
    fixture.detectChanges();
    return fixture;
  }

  function radios(fixture: ReturnType<typeof createFixture>): HTMLInputElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type="radio"]')];
  }

  it('offers the four windows from narrow to wide', () => {
    const fixture = createFixture();

    expect(radios(fixture).map((radio) => radio.value)).toEqual(['30d', '90d', '12m', 'all']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('12 months');
  });

  it('marks the selected window as checked', () => {
    const fixture = createFixture('12m');

    expect(radios(fixture).map((radio) => radio.checked)).toEqual([false, false, true, false]);
  });

  it('emits the window the user picked', () => {
    const fixture = createFixture();
    const picked: TimeRange[] = [];
    fixture.componentInstance.rangeChange.subscribe((range) => picked.push(range));

    radios(fixture)[1].click();

    expect(picked).toEqual(['90d']);
  });
});
