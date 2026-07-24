import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { ChipList } from './chip-list';

const en = { profiles: { editor: { addPlaceholder: 'Add + Enter', removeItem: 'Remove {{item}}' } } };

describe('ChipList', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChipList,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    }).compileComponents();
  });

  function createChipList() {
    const fixture = TestBed.createComponent(ChipList);
    fixture.componentRef.setInput('label', 'Frontend');
    fixture.componentRef.setInput('items', ['Angular', 'TypeScript']);
    fixture.componentRef.setInput('inputId', 'skills-frontend');
    fixture.detectChanges();
    return fixture;
  }

  it('renders the items and emits remove on the × button', () => {
    const fixture = createChipList();
    const removed: string[] = [];
    fixture.componentInstance.remove.subscribe((item) => removed.push(item));

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Angular');
    expect(element.textContent).toContain('TypeScript');

    (element.querySelector('button') as HTMLButtonElement).click();
    expect(removed).toEqual(['Angular']);
  });

  it('emits add on Enter and clears the input', () => {
    const fixture = createChipList();
    const added: string[] = [];
    fixture.componentInstance.add.subscribe((item) => added.push(item));

    const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
    input.value = '  Signals  ';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(added).toEqual(['Signals']);
    expect(input.value).toBe('');
  });
});
