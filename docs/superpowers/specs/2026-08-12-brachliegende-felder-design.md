# Brachliegende Felder visualisieren

Design-Spec, 2026-08-12. Umsetzung von Punkt 7 aus
[`docs/improvement-backlog.md`](../../improvement-backlog.md).

## Ziel

`seniority` (316 von 428 gefüllt) und `country` (403 von 428) liegen seit der Analyse in der
Datenbank, tauchen aber in keiner Auswertung auf. Der Global-Tab bekommt dafür zwei neue
Verteilungs-Charts. Dazu kommt der Remote-Anteil als Zeitreihe: Erst der Verlauf zeigt, ob
der Markt remote-freundlicher wird — die vorhandene Verteilung ist nur eine Momentaufnahme.

Der Backlog-Punkt nennt beim Remote-Teil noch ein Donut-Chart; das gibt es seit der
Projektseiten-Änderung nicht mehr. An seine Stelle sind die Verteilung über den
Remote-Prozentwert und die Ø-Kennzahl der Marktzeile getreten — die Trendlinie ergänzt
beide, ersetzt nichts.

## Entscheidungen

| Frage                           | Entscheidung                                                    |
| ------------------------------- | --------------------------------------------------------------- |
| Remote-Trend                    | Ø Remote-Prozent je Bucket als Linien-Chart, feste 0–100-Achse  |
| Ländergruppierung               | Feste Gruppen DE / AT / CH / Andere / Unbekannt                 |
| Seniority-Gruppierung           | Feste Reihenfolge junior → architect plus Unbekannt             |
| Platzierung                     | Ins bestehende Chart-Raster des Global-Tabs (7 → 10 Charts)     |
| Datenquelle für den Ø je Bucket | `averageScorePerBucket` wird zum generischen `averagePerBucket` |

Verworfen: gestapelte Remote-Klassen je Bucket (mehr Detail, aber unruhig und schwer
lesbar); dynamische Länderliste (Exoten mit einem Treffer erzeugen einen langen Schwanz
ohne Aussage); eine parallele Funktion `averageRemotePerBucket` (dieselbe
Bucket-Arithmetik ein zweites Mal gebaut und getestet).

## Aggregationen

Alles in `frontend/src/app/offers/util/offer-stats.ts` (framework-frei, `type:util`):

- `StatsOffer` wächst um `seniority: string | null` und `country: string | null`.
- `SENIORITY_ORDER = ['junior', 'mid', 'senior', 'lead', 'architect'] as const` — die fünf
  Werte, die der Analyse-Prompt vorgibt (`ClaudeOfferAnalyzer`).
- `countBySeniority(offers): number[]` zählt in dieser Reihenfolge; der sechste Eintrag ist
  Unbekannt. Werte außerhalb der Liste zählen ebenfalls als Unbekannt, statt still
  herauszufallen — sollte der Prompt je abweichen, wird das im Chart sichtbar.
- `COUNTRY_GROUPS = ['DE', 'AT', 'CH'] as const`. `countByCountryGroup(offers): number[]`
  liefert fünf Zählwerte: DE, AT, CH, Andere, Unbekannt. Gleiche Bauart wie das bisherige
  `countByRemote` (Zahlen in fester Reihenfolge, Labels liefert die Komponente).
- `averageScorePerBucket(offers, range, today)` wird zu
  `averagePerBucket(offers, value, range, today)` mit `value: (offer: StatsOffer) => number | null`.
  Verhalten unverändert: Buckets ohne Werte bleiben `null` (Lücke in der Linie), Rundung
  auf ganze Zahlen. Der Score-Trend im Agenten-Tab ruft sie mit `matchScore` auf, der
  neue Remote-Trend mit `remotePercent`.
- **Aufräumen im selben Zug:** das ungenutzte `countByRemote` (Rest des alten
  Donut-Charts) entfällt samt Test. `REMOTE_ORDER` bleibt — darauf baut der
  Spaltenfilter der Angebotstabelle.

## Charts und Datenfluss

Der Global-Tab wächst von 7 auf 10 Charts; bei drei Spalten (`xl`) gehen die Reihen genau
auf. Reihenfolge im Raster:

| Position | Chart                                                                          |
| -------- | ------------------------------------------------------------------------------ |
| 1–4      | unverändert (Zeitreihe, Trigger je Agent, Ø Score je Agent, Remote-Verteilung) |
| 5        | **Ø Remote-Anteil pro Tag/Woche/Monat** (neu)                                  |
| 6–8      | unverändert (Laufzeiten, Sätze, Berufsprofile)                                 |
| 9        | **Seniorität** (neu)                                                           |
| 10       | **Einsatzland** (neu)                                                          |

- **Remote-Trend** — Linien-Chart in `OfferCharts`, Daten als `BucketedAverages`-Input.
  Feste 0–100-Werteachse (ein Anteil in Prozent; ohne feste Achse überzeichneten kleine
  Schwankungen), dieselbe Begründung wie beim Agenten-Score-Vergleich. Der Titel trägt die
  Auflösung, das Fenster nennt der Umschalter — wie bei den anderen Zeitreihen.
- **Seniorität** — vertikale Balken, sechs Positionen in fester Reihenfolge, Labels aus
  `offers.seniority.*`.
- **Einsatzland** — vertikale Balken, fünf Positionen. DE/AT/CH stehen als ISO-Codes da
  (sprachneutral), nur „Andere" und „Unbekannt" kommen aus Transloco.
- **`OffersPage`** berechnet die drei neuen Chart-Eingaben aus `rangedOffers` — alle folgen
  dem Zeitraum-Umschalter, wie alles im Raster. Keine neuen Komponenten, keine
  Backend-Änderung: beide Felder liegen schon in der API-Antwort (`OfferResponse`).

Keine Fallzahl in den beiden neuen Verteilungs-Titeln: anders als bei Laufzeit und Satz
steht die Datenlücke als eigener „Unbekannt"-Balken sichtbar im Chart.

## Übersetzungen

Neue Schlüssel unter `offers.` (de/en):

- `charts.remoteTrendDay` / `…Week` / `…Month` — „Ø Remote-Anteil pro Tag/Woche/Monat"
  (en: „Avg. remote share per day/week/month")
- `charts.seniority` — „Seniorität" (en: „Seniority")
- `charts.countries` — „Einsatzland" (en: „Project country")
- `seniority.junior` / `mid` / `senior` / `lead` / `architect` / `unknown` — „Junior",
  „Mid", „Senior", „Lead", „Architekt", „Unbekannt" (en: „…", „Architect", „Unknown")
- `countries.other` / `countries.unknown` — „Andere" / „Unbekannt" (en: „Other" / „Unknown")

## Tests

**`offer-stats.spec.ts`** — `countBySeniority`: feste Reihenfolge, `null` und ein
unerwarteter Wert zählen als Unbekannt; `countByCountryGroup`: DE/AT/CH getroffen, anderes
Land als Andere, `null` als Unbekannt; `averagePerBucket`: rechnet mit dem übergebenen
Selektor, Buckets ohne Werte bleiben `null` (angepasste Fassung der bisherigen
`averageScorePerBucket`-Tests). Die `countByRemote`-Tests entfallen mit der Funktion.

**`offers-page.spec.ts`** — die drei neuen Chart-Eingaben folgen dem Zeitraum: Umschalten
auf ein engeres Fenster verkleinert die Zählwerte nachweislich.

**`e2e/offers.spec.ts`** — Chart-Anzahl im Global-Tab steigt auf 10; einer der neuen
Titel („Seniority") ist sichtbar.

## Nicht Teil dieser Änderung

- KPI-Kacheln und Marktzeile (unverändert)
- Die Angebotstabelle unter `/angebote` (kein neuer Spaltenfilter für Seniorität/Land)
- `industry` (Backlog-Punkt 3, eigener PR)
- Skill-Trends über Zeit (Backlog-Punkt 6, eigener PR)
