import { Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { TimeRange } from '../util/offer-stats';

/**
 * Auswertungsfenster des Dashboards als Segmentgruppe.
 *
 * Native Radios statt Buttons mit `aria-pressed`: vier sich gegenseitig ausschließende
 * Optionen sind genau das, wofür Radios da sind — Pfeiltasten-Navigation und die Ansage
 * „1 von 4" gibt es damit geschenkt (Style-Guide: semantisches HTML vor ARIA). Das Input
 * liegt visuell verborgen unter dem Label, der Fokusring sitzt deshalb auf dem Label.
 */
@Component({
  selector: 'app-range-picker',
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <fieldset>
        <legend class="sr-only">{{ t('offers.range.label') }}</legend>
        <div class="flex overflow-hidden rounded border border-surface-300 dark:border-surface-600">
          @for (option of ranges; track option) {
            <label
              class="cursor-pointer px-3 py-1 text-sm transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset"
              [class.bg-primary]="option === range()"
              [class.text-primary-contrast]="option === range()"
              [class.font-semibold]="option === range()"
            >
              <input
                class="sr-only"
                type="radio"
                name="dashboard-range"
                [value]="option"
                [checked]="option === range()"
                (change)="rangeChange.emit(option)"
              />
              {{ t('offers.range.' + option) }}
            </label>
          }
        </div>
      </fieldset>
    </ng-container>
  `,
})
export class RangePicker {
  readonly range = input.required<TimeRange>();
  readonly rangeChange = output<TimeRange>();

  /** Reihenfolge von eng nach weit — die Beschriftungen kommen aus `offers.range.*`. */
  protected readonly ranges: TimeRange[] = ['30d', '90d', '12m', 'all'];
}
