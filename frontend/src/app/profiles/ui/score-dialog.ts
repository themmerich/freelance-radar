import { DecimalPipe } from '@angular/common';
import { Component, input, model, output, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

import { runCostCents } from '../../shared/util/run-cost';

/** Was der Dialog an Vorschau anzeigt — ein Präsentations-Vertrag, domänenfrei. */
export type ScorePreview = {
  candidates: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
};

/** Auswählbare Zeitfenster; `null` steht für den gesamten Bestand. */
const RANGES = [7, 30, 90] as const;

/**
 * Bewertet den Bestand gegen ein Profil: Zeitraum wählen, geschätzte Kosten sehen,
 * starten. Der gesamte Bestand läuft ohne Kostendeckel und deshalb erst nach einer
 * ausdrücklichen Bestätigung.
 */
@Component({
  selector: 'app-score-dialog',
  imports: [DecimalPipe, TranslocoDirective, ButtonModule, DialogModule],
  template: `
    <ng-container *transloco="let t">
      <p-dialog
        [visible]="visible()"
        (visibleChange)="visible.set($event)"
        [modal]="true"
        [header]="t('profiles.score.title', { name: profileName() })"
        [style]="{ width: '32rem', maxWidth: '95vw' }"
      >
        <div class="flex flex-col gap-3">
          <label class="flex items-center gap-2 text-sm">
            <span>{{ t('profiles.reanalysis.range') }}</span>
            <select
              class="rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
              [value]="days() === null ? 'all' : days()"
              (change)="onDaysChange($event)"
            >
              <option value="all">{{ t('profiles.reanalysis.all') }}</option>
              @for (range of ranges; track range) {
                <option [value]="range">{{ t('profiles.reanalysis.days', { days: range }) }}</option>
              }
            </select>
          </label>

          @if (preview(); as p) {
            <p class="text-sm text-surface-600 dark:text-surface-300">
              {{ t('profiles.reanalysis.preview', { candidates: p.candidates }) }}
              · ≈{{ costCents(p.estimatedInputTokens, p.estimatedOutputTokens) | number: '1.1-2' }} ct
            </p>
          }
        </div>

        <ng-template #footer>
          <p-button type="button" [text]="true" [label]="t('profiles.score.close')" (onClick)="visible.set(false)" />
          <p-button
            type="button"
            icon="pi pi-sparkles"
            [label]="t('profiles.reanalysis.run')"
            [disabled]="preview()?.candidates === 0"
            (onClick)="onScore()"
          />
        </ng-template>
      </p-dialog>

      <!-- Gesamter Bestand: hier greift der Kostendeckel pro Lauf nicht, deshalb die Rückfrage. -->
      <p-dialog
        [visible]="showConfirmDialog()"
        (visibleChange)="showConfirmDialog.set($event)"
        [modal]="true"
        [header]="t('profiles.score.confirmTitle')"
        [style]="{ width: '28rem', maxWidth: '95vw' }"
      >
        <p class="text-sm text-surface-600 dark:text-surface-300">
          {{ t('profiles.score.confirmWarning', { candidates: preview()?.candidates ?? 0 }) }}
        </p>
        <ng-template #footer>
          <p-button type="button" [text]="true" [label]="t('profiles.score.cancel')" (onClick)="showConfirmDialog.set(false)" />
          <p-button type="button" icon="pi pi-sparkles" [label]="t('profiles.reanalysis.run')" (onClick)="confirmScore()" />
        </ng-template>
      </p-dialog>
    </ng-container>
  `,
})
export class ScoreDialog {
  readonly visible = model.required<boolean>();
  readonly profileName = input.required<string>();
  /** `null` = gesamter Bestand; sonst die Zahl der zurückliegenden Tage. */
  readonly days = model.required<number | null>();
  readonly preview = input.required<ScorePreview | null>();
  readonly score = output<void>();

  protected readonly costCents = runCostCents;
  protected readonly ranges = RANGES;

  protected readonly showConfirmDialog = signal(false);

  protected onDaysChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.days.set(value === 'all' ? null : Number(value));
  }

  /** Zeitfenster starten direkt; der gesamte Bestand erst nach der Warnung. */
  protected onScore(): void {
    if (this.days() === null) {
      this.showConfirmDialog.set(true);
      return;
    }
    this.score.emit();
  }

  protected confirmScore(): void {
    this.showConfirmDialog.set(false);
    this.score.emit();
  }
}
