import { Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { Trend } from '../util/offer-stats';

/** Kennzahlen für die Kachel-Zeile — vom Feature vorberechnet, hier nur Anzeige. */
export type KpiTileData = {
  today: number;
  last7Days: Trend;
  last30Days: Trend;
  total: number;
  averageScore: Trend;
  greenShare: Trend;
};

/** Richtung des Deltas. Bei allen vier Trendkacheln ist „steigend" die gute Richtung. */
type Tone = 'up' | 'down' | 'flat';

type TileView = {
  label: string;
  value: string;
  /** null bei den Kacheln ohne Vergleich (Heute, Gesamt) und wenn die Vorperiode keinen hergibt. */
  delta: { arrow: string; text: string; classes: string } | null;
  /** Die Kachel trägt einen Vergleich, die Datenlage gibt ihn aber nicht her. */
  hasNoComparison: boolean;
};

const ARROW: Record<Tone, string> = { up: '▲', down: '▼', flat: '' };

/**
 * Farbe je Richtung. Als ganzer Klassen-String statt `[class.x]`, weil Tailwinds
 * `dark:`-Präfix einen Doppelpunkt in den Klassennamen trägt.
 */
const TONE_CLASSES: Record<Tone, string> = {
  up: 'text-green-600 dark:text-green-400',
  down: 'text-red-600 dark:text-red-400',
  flat: 'text-surface-500 dark:text-surface-400',
};

function toneOf(delta: number): Tone {
  if (delta > 0) {
    return 'up';
  }
  return delta < 0 ? 'down' : 'flat';
}

/** Vorzeichen ausgeschrieben — echtes Minuszeichen (U+2212) statt Bindestrich, „±0" bei Stillstand. */
function signed(delta: number): string {
  if (delta > 0) {
    return `+${delta}`;
  }
  return delta < 0 ? `−${Math.abs(delta)}` : '±0';
}

@Component({
  selector: 'app-kpi-tiles',
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        @for (tile of tiles(); track tile.label) {
          <div class="flex flex-col gap-1 rounded border border-surface-200 p-3 dark:border-surface-700">
            <dt class="text-sm text-surface-600 dark:text-surface-300">{{ t(tile.label) }}</dt>
            <dd class="flex flex-wrap items-baseline gap-2">
              <span class="text-2xl font-semibold">{{ tile.value }}</span>

              @if (tile.delta; as delta) {
                <!-- Pfeil und Farbe sind Zugabe; Richtung und Bezug stehen im Text. -->
                <span class="text-sm font-medium" [class]="delta.classes">
                  @if (delta.arrow) {
                    <span aria-hidden="true">{{ delta.arrow }}</span>
                  }
                  {{ delta.text }}
                  <span class="sr-only">{{ t('offers.kpi.versusPrevious') }}</span>
                </span>
              } @else if (tile.hasNoComparison) {
                <span class="text-sm text-surface-500 dark:text-surface-400">{{ t('offers.kpi.noComparison') }}</span>
              }
            </dd>
          </div>
        }
      </dl>
    </ng-container>
  `,
})
export class KpiTiles {
  readonly kpis = input.required<KpiTileData>();

  private readonly transloco = inject(TranslocoService);

  protected readonly tiles = computed<TileView[]>(() => {
    const kpis = this.kpis();
    return [
      { label: 'offers.kpi.today', value: `${kpis.today}`, delta: null, hasNoComparison: false },
      this.trendTile('offers.kpi.last7Days', kpis.last7Days, (value) => `${value}`, 'offers.kpi.deltaPercent'),
      this.trendTile('offers.kpi.last30Days', kpis.last30Days, (value) => `${value}`, 'offers.kpi.deltaPercent'),
      { label: 'offers.kpi.total', value: `${kpis.total}`, delta: null, hasNoComparison: false },
      this.trendTile('offers.kpi.averageScore', kpis.averageScore, (value) => `${value}`, null),
      this.trendTile('offers.kpi.greenShare', kpis.greenShare, (value) => `${value} %`, 'offers.kpi.deltaPercentagePoints'),
    ];
  });

  /** `deltaKey` trägt die Einheit der Differenz; null heißt „blanke Zahl" (Ø Score in Punkten). */
  private trendTile(label: string, trend: Trend, render: (value: number) => string, deltaKey: string | null): TileView {
    const value = trend.value === null ? '—' : render(trend.value);
    if (trend.delta === null) {
      // Fehlt schon der Wert, wäre ein „kein Vergleich" neben dem „—" nur Rauschen.
      return { label, value, delta: null, hasNoComparison: trend.value !== null };
    }

    const text = signed(trend.delta);
    const tone = toneOf(trend.delta);
    return {
      label,
      value,
      delta: {
        arrow: ARROW[tone],
        text: deltaKey === null ? text : this.transloco.translate(deltaKey, { value: text }),
        classes: TONE_CLASSES[tone],
      },
      hasNoComparison: false,
    };
  }
}
