import { Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { TagModule } from 'primeng/tag';

/**
 * Editierbare Chip-Liste (Skills, Signale): Enter fügt hinzu, × entfernt.
 * Bewusst eigener Mini-Editor statt PrimeNG-Chips — volle Kontrolle, kein CVA nötig.
 */
@Component({
  selector: 'app-chip-list',
  imports: [TranslocoDirective, TagModule],
  template: `
    <ng-container *transloco="let t">
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium" [attr.for]="inputId()">{{ label() }}</label>
        <div class="flex flex-wrap items-center gap-2">
          @for (item of items(); track item) {
            <p-tag [severity]="severity()">
              <span class="flex items-center gap-1">
                {{ item }}
                <button
                  type="button"
                  class="cursor-pointer leading-none"
                  [attr.aria-label]="t('profiles.editor.removeItem', { item })"
                  (click)="remove.emit(item)"
                >
                  ×
                </button>
              </span>
            </p-tag>
          }
          <input
            [id]="inputId()"
            type="text"
            class="w-44 rounded border border-surface-300 bg-transparent px-2 py-1 text-sm dark:border-surface-600"
            [placeholder]="t('profiles.editor.addPlaceholder')"
            (keydown.enter)="onEnter($event)"
          />
        </div>
      </div>
    </ng-container>
  `,
})
export class ChipList {
  readonly label = input.required<string>();
  readonly items = input.required<string[]>();
  readonly inputId = input.required<string>();
  readonly severity = input<'secondary' | 'info' | 'danger'>('secondary');
  readonly add = output<string>();
  readonly remove = output<string>();

  protected onEnter(event: Event): void {
    event.preventDefault();
    const inputElement = event.target as HTMLInputElement;
    const value = inputElement.value.trim();
    if (value) {
      this.add.emit(value);
      inputElement.value = '';
    }
  }
}
