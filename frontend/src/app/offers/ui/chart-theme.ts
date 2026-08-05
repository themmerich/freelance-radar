/**
 * Farben und Achsen-Optionen, die sich die Chart-Komponenten des Dashboards teilen.
 * Farben aus einer validierten Dataviz-Palette, jeweils für helle und dunkle
 * Oberfläche gestuft; `good`/`warning`/`critical` sind die Status-Farben der Score-Ampel.
 */
export type ChartPalette = {
  series1: string;
  series2: string;
  series3: string;
  series4: string;
  good: string;
  warning: string;
  critical: string;
  ink: string;
  muted: string;
  grid: string;
};

export const PALETTE: Record<'light' | 'dark', ChartPalette> = {
  light: {
    series1: '#2a78d6',
    series2: '#eb6834',
    series3: '#1baf7a',
    series4: '#eda100',
    good: '#0ca30c',
    warning: '#fab219',
    critical: '#d03b3b',
    ink: '#52514e',
    muted: '#898781',
    grid: '#e1e0d9',
  },
  dark: {
    series1: '#3987e5',
    series2: '#d95926',
    series3: '#199e70',
    series4: '#c98500',
    good: '#0ca30c',
    warning: '#fab219',
    critical: '#d03b3b',
    ink: '#c3c2b7',
    muted: '#898781',
    grid: '#2c2c2a',
  },
};

/** Chart.js-Optionen für Balken/Linien; `valueMax` fixiert die Werteachse (die zur `indexAxis` orthogonale) auf 0–`valueMax`. */
export function axisOptions(palette: ChartPalette, indexAxis: 'x' | 'y', valueMax?: number): object {
  const axis = { ticks: { color: palette.muted, precision: 0 }, grid: { color: palette.grid } };
  const valueBounds = valueMax === undefined ? {} : { min: 0, max: valueMax };
  return {
    indexAxis,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ...axis, ...(indexAxis === 'y' ? valueBounds : {}) },
      y: { ...axis, ...(indexAxis === 'x' ? valueBounds : {}) },
    },
  };
}
