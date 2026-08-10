# Trend-Deltas in den KPI-Kacheln

Design-Spec, 2026-08-10. Umsetzung von Punkt 5 aus
[`docs/improvement-backlog.md`](../../improvement-backlog.md).

## Ziel

Die Kachel-Zeile des Dashboards nennt heute nackte Zahlen: „30 Tage: 428". Ob das viel oder
wenig ist, sagt sie nicht. Erst der Vergleich mit der gleich langen Vorperiode macht aus der
Kachel eine Marktaussage — „428, ▲ +12 %".

Vier Kacheln bekommen ein Delta: 7 Tage, 30 Tage, Ø Match-Score und Anteil 🟢. „Heute" und
„Gesamt" bleiben ohne: ein Tagesvergleich misst bei manuellem Collect-Lauf vor allem, wann
zuletzt abgerufen wurde, und „Gesamt" ist kumulativ — es kann nur wachsen.

## Entscheidungen

| Frage                     | Entscheidung                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Kacheln mit Delta         | 7 Tage, 30 Tage, Ø Match-Score, Anteil 🟢                                            |
| Ø Score und 🟢-Anteil     | von Allzeit auf **30 Tage** umgedeutet, damit Wert und Delta dieselbe Periode messen |
| Vorperiode                | das gleich lange Fenster unmittelbar davor                                           |
| Delta bei dünner Historie | entfällt, solange der Bestand die Vorperiode nicht deckt                             |
| Einheit                   | Zählungen relativ in %, Ø Score in Punkten, 🟢-Anteil in Prozentpunkten              |
| Darstellung               | Pfeil + Vorzeichen + Farbe neben dem Wert                                            |
| Ort der Berechnung        | eigene reine Funktion `trend` im `util`, `kpis()` komponiert sie                     |

Verworfen: den Allzeit-Ø in den beiden Qualitätskacheln stehen lassen und das Delta auf
30 Tage danebenzusetzen (Wert und Delta würden Verschiedenes messen); das Delta immer zeigen
und nur die Division durch null abfangen (genau die heutige Datenlage lieferte damit ein
erfundenes „+2000 %"); die Deltas in der Kachel-Komponente rechnen (Fachlogik gehört ins
`util`, die `ui`-Schicht bleibt dumb).

Die Kacheln hängen weiterhin **nicht** am Zeitraum-Umschalter. Sie sind der feste Bezugspunkt
über beiden Tabs, siehe
[`2026-08-10-dashboard-zeitraum-design.md`](2026-08-10-dashboard-zeitraum-design.md).

## Kennzahl-Modell

Neu in `frontend/src/app/offers/util/offer-stats.ts` (framework-frei, `type:util`):

```ts
/** Kennzahl samt Veränderung zur gleich langen Vorperiode. */
export type Trend = { value: number | null; delta: number | null };

/** Was gemessen wird, plus die Einheit der Differenz. */
export type Metric = { measure: (offers: StatsOffer[]) => number | null; delta: 'relative' | 'absolute' };

export function trend(offers: StatsOffer[], days: number, metric: Metric, today: Date): Trend;
```

`value` ist `null`, wenn das Fenster keine Grundlage hat — bei den Qualitätskennzahlen also,
solange darin nichts analysiert ist. Zählungen liefern immer eine Zahl; eine 0 ist ein Befund.

Drei Metriken, im Modul definiert und mitexportiert — sonst könnte der Test `trend` nicht
einzeln aufrufen:

| Metrik        | `measure`                                             | Einheit der Differenz      |
| ------------- | ----------------------------------------------------- | -------------------------- |
| Angebotszahl  | `offers.length`                                       | `relative` (Prozent)       |
| Ø Match-Score | Schnitt über analysierte Angebote, sonst `null`       | `absolute` (Punkte)        |
| Anteil 🟢     | Anteil analysierter Angebote ≥ Schwelle, sonst `null` | `absolute` (Prozentpunkte) |

Der 🟢-Anteil braucht die Ampel-Schwelle und kommt deshalb aus einer Factory
`greenShareMetric(threshold): Metric`; die beiden übrigen sind Konstanten.

### Fenster

`trend` schneidet zwei gleich lange Fenster aus derselben Liste:

| Fenster    | Grenzen (Tagesgenauigkeit, lokale Zeit) |
| ---------- | --------------------------------------- |
| aktuell    | `[heute − (n − 1) … heute]`             |
| Vorperiode | `[heute − (2n − 1) … heute − n]`        |

Der laufende Tag zählt mit, wie bei den heutigen KPI-Fenstern. Für `n = 7` am 2026-08-10 heißt
das: aktuell 04.08.–10.08., Vorperiode 28.07.–03.08.

### Wann das Delta entfällt

`delta` ist `null` in genau drei Fällen:

1. **Vorperiode nicht gedeckt** — das älteste Angebot im Bestand liegt _nach_ dem Beginn der
   Vorperiode. Dann misst ein Delta den Aufbau der Sammlung, nicht den Markt. Geprüft wird
   gegen die **gesamte** übergebene Liste, nicht gegen das Fenster.
2. **Vorperiodenwert ist `null`** — keine analysierten Angebote als Basis.
3. **Vorperiodenwert ist `0` bei relativer Einheit** — Division durch null.

Fall 1 verwendet das älteste Angebot als Beleg dafür, ab wann gesammelt wurde: liegt es am oder
vor dem Beginn der Vorperiode, gilt die Vorperiode als gedeckt. Das ist ein Proxy — ein
exaktes Startdatum der Sammlung führt die Anwendung nicht — aber der ehrlichste verfügbare.

### Rundung

Beide Perioden werden ungerundet gemessen, gerundet wird erst die Differenz:

- `relative`: `Math.round(((aktuell − vorher) / vorher) * 100)`
- `absolute`: `Math.round(aktuell − vorher)`

## `kpis()` als Komposition

Der Rückgabetyp wächst, die Signatur bleibt:

```ts
export type Kpis = {
  today: number;
  last7Days: Trend;
  last30Days: Trend;
  /** Alle analysierten Angebote ohne Zeitfenster — kumulativ, deshalb ohne Delta. */
  total: number;
  /** Ø Match-Score der letzten 30 Tage (vorher: Allzeit). */
  averageScore: Trend;
  /** Anteil 🟢 der letzten 30 Tage (vorher: Allzeit). */
  greenShare: Trend;
};
```

`kpis()` ruft `trend` viermal — zweimal mit der Zählmetrik (7 und 30 Tage), einmal je
Qualitätsmetrik (30 Tage) — und ergänzt `today` und `total` wie bisher. Die eigene
Fensterlogik in `kpis()` entfällt damit weitgehend.

## Darstellung

`frontend/src/app/offers/ui/kpi-tiles.ts` bleibt dumb und bekommt weiterhin nur vorberechnete
Werte; `KpiTileData` übernimmt die neue Feldform von `Kpis`.

```
Heute    7 Tage        30 Tage             Gesamt   Ø Match-Score (30 Tage)   Anteil 🟢 (30 Tage)
  12     89 ▲ +8 %     428 kein Vergleich   1.204    62 ▲ +4                   28 % ▼ −3 %p
```

- **Pfeil `aria-hidden`.** Die Richtung steht ohnehin im Vorzeichen — Farbe und Glyphe sind
  Zugabe, nie der einzige Träger der Aussage (a11y-Style-Guide). Dahinter ein `sr-only`
  „gegenüber der Vorperiode", damit die Zahl vorgelesen einen Bezug hat.
- **Farben:** steigend `text-green-600 dark:text-green-400`, fallend
  `text-red-600 dark:text-red-400`, `±0` in Grau. Bei allen vier Trendkacheln ist „steigend"
  die gute Richtung, die Zuordnung hängt also direkt am Vorzeichen.
- **`delta === null`** → an derselben Stelle der graue Hinweis „kein Vergleich". Die Formulierung
  deckt beide Ursachen ab; „zu wenig Historie" wäre bei einer gedeckten, aber leeren Vorperiode
  falsch.
- **`value === null`** → wie heute „—", ohne Hinweis. Ein Delta zu einem fehlenden Wert zu
  kommentieren wäre Rauschen.

Die Kachel-Zeile bleibt bei sechs Einträgen und demselben Grid; das Delta steht in derselben
`<dd>` neben dem Wert.

> **Nachtrag aus der Umsetzung:** Die Annahme „die Zeilenhöhe ändert sich nicht" war falsch.
> „(30 Tage)" lässt die Beschriftung der beiden Qualitätskacheln in den schmalen Spalten
> umbrechen, wodurch deren Werte tiefer standen als die der übrigen vier. Das `<dt>`
> reserviert deshalb fest zwei Zeilen (`min-h-10`) — in der schmalen Ansicht brauchen ohnehin
> alle sechs Beschriftungen zwei Zeilen.

## Übersetzungen

Neue Schlüssel unter `offers.kpi.`:

| Schlüssel               | de                       | en                     |
| ----------------------- | ------------------------ | ---------------------- |
| `versusPrevious`        | gegenüber der Vorperiode | versus previous period |
| `noComparison`          | kein Vergleich           | no comparison          |
| `deltaPercent`          | `{{value}} %`            | `{{value}} %`          |
| `deltaPercentagePoints` | `{{value}} %p`           | `{{value}} pp`         |

Das Delta des Ø Match-Score trägt keine Einheit und braucht deshalb keinen Schlüssel.

Geänderte Schlüssel: `averageScore` → „Ø Match-Score (30 Tage)" / „Avg match score (30 days)",
`greenShare` → „Anteil 🟢 (30 Tage)" / „Share 🟢 (30 days)". Das Fenster gehört in die
Beschriftung, sonst liest sich der Wert weiter als Allzeit-Schnitt.

Vorzeichen und Betrag baut die Komponente selbst (`+`, `−` als echtes Minuszeichen U+2212, `±`
bei 0) und reicht das Ergebnis als `value` in die Übersetzung.

## Was sich damit heute zeigt

Die Sammlung läuft seit 2026-07-20. Daraus folgt für den Bestand vom 2026-08-10:

| Kachel                            | Delta sichtbar        |
| --------------------------------- | --------------------- |
| 7 Tage                            | sofort                |
| 30 Tage, Ø Match-Score, Anteil 🟢 | ab dem **2026-09-17** |

Bis dahin steht in drei von vier Trendkacheln „kein Vergleich". Das ist die gewollte Anzeige
der Datenlage, kein Fehler — dieselbe Haltung wie in der Marktzeile, die „aus N Angeboten"
ausweist, statt eine Zahl ohne Basis zu zeigen.

## Randfälle

- **Vorperiode gedeckt, aber leer.** Zählkachel: relatives Delta undefiniert → „kein
  Vergleich". Qualitätskachel: Vorperiodenwert `null` → ebenso.
- **Aktuelles Fenster leer.** Die Zählkachel zeigt `0`; ist die Vorperiode gedeckt und nicht
  leer, steht daneben ein ehrliches „▼ −100 %".
- **Leerer Bestand.** Alle Werte `0` bzw. `—`, alle Deltas entfallen (nichts ist gedeckt).
- **Zeitzone und Sommerzeit.** Wie bisher lokale Zeit über `startOfDay`; die Fenstergrenzen
  entstehen durch Datumsarithmetik, nicht durch Millisekunden-Addition.

## Tests

**`offer-stats.spec.ts`** — `trend` misst die Vorperiode auf dem verschobenen Fenster; die
Deckungsgrenze scharf geprüft (ältestes Angebot exakt am Beginn der Vorperiode → Delta, einen
Tag später → `null`); leere Vorperiode → `null`; relative gegen absolute Einheit; Score- und
🟢-Metrik zählen nur analysierte Angebote; `kpis()` liefert für `today` und `total` weiterhin
blanke Zahlen.

**`kpi-tiles.spec.ts`** — Pfeil, Vorzeichen und Einheit je Kachel; „kein Vergleich" statt eines
Deltas bei `delta: null`; „—" bei `value: null`; „Heute" und „Gesamt" ohne Delta; das
Pfeil-Element ist `aria-hidden`.

**`offers-page.spec.ts`** — die Kacheln bleiben an ihren festen Fenstern; ein Wechsel des
Zeitraum-Umschalters verändert die Kachel-Eingaben nicht.

**`e2e/offers.spec.ts`** — die Fixture bekommt zwei weitere primäre Angebote (rund 10 und 20
Tage alt), damit die Vorperiode der 7-Tage-Kachel gedeckt und gefüllt ist; der Test prüft, dass
die Kachel im Browser ein Delta zeigt.

## Nicht Teil dieser Änderung

- Zeitraum-Umschalter für die Kachel-Zeile — die festen Fenster sind der bewusste Bezugspunkt
- Deltas in der Marktzeile (Ø Stundensatz, Ø Laufzeit, Ø Remote-Anteil)
- Skill-Trends über Zeit (Backlog-Punkt 6, eigener PR)
