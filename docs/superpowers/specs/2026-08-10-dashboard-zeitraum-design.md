# Wählbarer Zeitraum für das Dashboard

Design-Spec, 2026-08-10. Umsetzung von Punkt 4 aus
[`docs/improvement-backlog.md`](../../improvement-backlog.md).

## Ziel

Das Dashboard zeigt die Marktlage heute in fest verdrahteten Fenstern: die Zeitreihen über
30 Tage bzw. 12 Monate, alle übrigen Charts über den gesamten Bestand. Ein Umschalter über
den Tabs stellt künftig **alle** Charts auf einen gewählten Zeitraum um, damit Perioden
vergleichbar werden — „welche Skills verlangte der Markt in den letzten 90 Tagen, welche im
ganzen Jahr?".

Nicht Teil dieser Änderung: die KPI-Kachel-Zeile. Sie behält ihre festen Fenster
(heute / 7 Tage / 30 Tage / gesamt) und bleibt damit der unveränderliche Bezugspunkt über
beiden Tabs.

## Entscheidungen

| Frage                                  | Entscheidung                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| Geltungsbereich                        | Alle Charts beider Tabs; KPI-Kacheln ausgenommen                              |
| „Angebote pro Tag" + „Anfragen pro Monat" | Verschmelzen zu **einer** Zeitreihe mit mitwandernder Auflösung               |
| Persistenz der Auswahl                 | `SettingsStore` + localStorage, wie Ampel-Schwellen und Duplikat-Toggle        |
| Ort der Filterung                      | Einmal in der Seite; bestehende Aggregationen bleiben unverändert             |

Verworfen: das Zeitfenster an jede Aggregationsfunktion durchreichen (redundantes Filtern,
achtfache Testfläche); serverseitiges Filtern über Query-Parameter (zahlt sich erst bei
Datenmengen aus, die der Browser nicht mehr hält — bei aktuell 428 Angeboten unnötige
API-Fläche).

## Zeitraum-Modell

Neu in `frontend/src/app/offers/util/offer-stats.ts` (framework-frei, `type:util`):

```ts
export type TimeRange = '30d' | '90d' | '12m' | 'all';
export type Bucket = 'day' | 'week' | 'month';
export type BucketedCounts = { labels: string[]; counts: number[]; average: number };
export type BucketedAverages = { labels: string[]; averages: (number | null)[] };
```

Feste Auflösung je Fenster:

| `TimeRange` | Fenster                                            | Bucket | Balken           |
| ----------- | -------------------------------------------------- | ------ | ---------------- |
| `30d`       | heute plus die 29 vorangehenden Tage               | day    | 30               |
| `90d`       | laufende Woche plus die 12 vorangehenden (Mo–So)   | week   | 13               |
| `12m`       | laufender Monat plus die 11 vorangehenden          | month  | 12               |
| `all`       | ab dem Monat des ältesten Angebots                 | month  | variabel, min. 1 |

Der erste und der letzte Bucket sind also angeschnitten (die laufende Woche bzw. der
laufende Monat ist noch nicht vorbei) — dieselbe Konvention wie beim heutigen
Tages- und Monats-Chart.

Funktionen:

- `withinRange(offers, range, today): StatsOffer[]` — der eine Filter, den die Seite anwendet.
  Er verwendet **denselben Fensterstart** wie die Buckets, sonst widersprächen sich
  Verteilungs-Charts und Zeitreihe. Bei `all` gibt er die Liste unverändert zurück.
- `offersPerBucket(offers, range, today): BucketedCounts` — ersetzt `offersPerDay` und
  `offersPerMonth`. `average` = Summe / Anzahl Buckets (leere Buckets zählen mit, wie beim
  heutigen Monatsschnitt).
- `averageScorePerBucket(offers, range, today): BucketedAverages` — ersetzt
  `averageScorePerDay`; Buckets ohne analysierte Angebote bleiben `null` (Lücke in der Linie).

`DailyCounts` und `MonthlyCounts` verschmelzen zu `BucketedCounts`, `DailyAverages` zu
`BucketedAverages`. Die alten Funktionen entfallen ersatzlos — einzige Konsumenten sind die
Dashboard-Charts.

**Label-Format:** Tage und Wochen tragen das Datum des Bucket-Starts (`21.07.`), Monate
`MM.YY` (`08.26`) — wie heute. Wochen bekommen bewusst kein „KW"-Präfix, damit das
Util-Layer ohne Übersetzungen auskommt; die Auflösung steht im Chart-Titel.

**Bei `all` ohne Angebote** liefert `offersPerBucket` einen einzelnen Bucket für den
laufenden Monat mit Zählwert 0 — kein Sonderfall im Chart.

## Komponenten und Datenfluss

```
SettingsStore.range  (localStorage: freelance-radar.settings)
        │
        ├── RangePicker (ui, dumb)      range + rangeChange
        │
OffersPage (feature)
   primaryOffers ──withinRange(range)──▶ rangedOffers
                                            ├─▶ OfferCharts   (5 Charts, global)
                                            └─▶ agentOffers ─▶ AgentCharts (5 Charts)
```

**`SettingsStore`** — `range: TimeRange` in `PersistedSettings`, Standard `'30d'`, dazu
`setRange()`. Gespeicherte Einstellungen ohne das Feld fallen durch den vorhandenen
`{ ...DEFAULTS, ...parsed }`-Merge automatisch auf den Standard; keine Migration nötig.

**`RangePicker`** (neu, `offers/ui/range-picker.ts`) — vier native Radios in einem
`<fieldset>`, visuell als Segmentgruppe. Bewusst kein PrimeNG-Select: derselbe Grund wie beim
Agenten-Umschalter (`p-select` kollidiert mit der FormField-Typprüfung, siehe Kommentar in
`offers-page.ts`). Inputs: `range`; Output: `rangeChange`.

> **Abweichung gegenüber dem ersten Entwurf** (bei der Umsetzung entschieden): ursprünglich
> waren `<button>` mit `aria-pressed` vorgesehen. Vier sich gegenseitig ausschließende
> Optionen sind aber genau der Fall, für den Radios da sind — der a11y-Style-Guide verlangt
> „semantisches HTML vor ARIA", und Pfeiltasten-Navigation sowie die Ansage „1 von 4" gibt es
> damit geschenkt. Das Input liegt `sr-only` unter dem Label; der Fokusring sitzt deshalb auf
> dem Label, und der e2e-Test klickt das Label statt des Inputs.

**`OffersPage`** — berechnet `rangedOffers` einmal aus `primaryOffers` und dem Zeitraum;
alle Chart-Eingaben leiten sich daraus ab. Der Picker steht rechtsbündig in einer eigenen
Zeile **über** der Tab-Leiste, nicht innerhalb von `p-tablist` (dort gehören nur Tabs hinein).

**`OfferCharts` / `AgentCharts`** — bekommen statt `perDay` + `perMonth` je einen
`BucketedCounts`-Input plus den `Bucket` für den Titel. Beide Tabs fallen damit von sechs
auf fünf Charts:

| Gesamtauswertung             | Agenten-Analyse                     |
| ---------------------------- | ----------------------------------- |
| Angebote pro Tag/Woche/Monat | Angebote pro Tag/Woche/Monat        |
| Trigger je Agent             | Ø Match-Score pro Tag/Woche/Monat   |
| Ø Score je Agent             | Score-Verteilung                    |
| Remote-Anteil                | Top-Skills                          |
| Berufsprofile                | Skill-Gaps                          |

Die Durchschnittslinie der Zeitreihe bleibt erhalten und heißt je nach Auflösung „Ø pro
Tag / Woche / Monat".

## Übersetzungen

Neue Schlüssel unter `offers.`:

- `range.30d` / `range.90d` / `range.12m` / `range.all` — „30 Tage", „90 Tage", „12 Monate",
  „Alles" (en: „30 days", „90 days", „12 months", „All")
- `range.label` — Beschriftung der Gruppe für Screenreader („Zeitraum")
- `charts.perDay` / `charts.perWeek` / `charts.perMonth` — „Angebote pro Tag/Woche/Monat"
- `charts.scoreTrendDay` / `…Week` / `…Month` — „Ø Match-Score pro Tag/Woche/Monat"
- `charts.offersLegend` — Legende der Balken („Angebote" / „Offers")
- `charts.averagePerDay` / `…Week` / `…Month` — Legende der Durchschnittslinie
  („Ø pro Tag/Woche/Monat")

Die Fensterangabe entfällt in den beiden Zeitreihen-Titeln — der Umschalter nennt das
Fenster, der Titel die Auflösung. `charts.perDay` und `charts.scoreTrend` behalten damit
ihren Schlüssel, verlieren aber den Klammerzusatz. Ersatzlos entfernt werden
`charts.perMonth` in seiner heutigen Bedeutung („Anfragen pro Monat (12 Monate)"),
`charts.perMonthOffers` und `charts.perMonthAverage`; die übrigen Chart-Titel
(`remote`, `agents`, `agentScores`, `roles`, `scores`, `topSkills`, `topGaps`) bleiben
unverändert.

## Randfälle

- **Agenten-Liste folgt dem Zeitraum.** `triggersPerAgent` rechnet künftig auf
  `rangedOffers`; ein Agent ohne Angebote im Fenster verschwindet aus dem Dropdown. Der
  bestehende `linkedSignal`-Fallback springt dann auf den stärksten verbliebenen Agenten.
- **Leeres Fenster.** Liefert der Zeitraum keine Angebote, zeigen die Charts leere Achsen;
  im Agenten-Tab greift der vorhandene Hinweis „Noch keine Angebote von Suchagenten".
- **Zeitzone.** Wie bisher lokale Zeit über `startOfDay`; Wochen beginnen Montag.

## Tests

**`offer-stats.spec.ts`** — je Fenster die Bucket-Anzahl und die Grenzen (ältestes noch
enthaltenes vs. erstes herausfallendes Angebot); Wochengrenze über einen Sonntag/Montag-Wechsel;
`all` leitet den Start aus dem ältesten Angebot ab und liefert bei leerer Liste einen Bucket;
`average` teilt durch die Bucket-Anzahl; `withinRange` schneidet korrekt zu.

**`range-picker.spec.ts`** — rendert vier Optionen, markiert die aktive über `aria-pressed`,
gibt bei Klick den Zeitraum aus.

**`offers-page.spec.ts`** — der Zeitraum aus dem Store bestimmt, was die Charts bekommen;
Umschalten auf ein engeres Fenster verkleinert die Chart-Daten nachweislich (Angebote
außerhalb fallen aus Skills und Zeitreihe).

**`e2e/offers.spec.ts`** — Umschalten auf „90 Tage" ändert den Chart-Titel auf „per week",
die Chart-Anzahl je Tab ist fünf, und die Auswahl übersteht einen Reload.

## Nicht Teil dieser Änderung

- KPI-Kacheln (feste Fenster, bewusst)
- Die Angebots-Tabelle unter `/angebote` (eigene Filter, unberührt)
- Trend-Deltas gegenüber der Vorperiode (Backlog-Punkt 5, eigener PR)
