# Detaildaten sichtbar machen

Design-Spec, 2026-08-10. Folge-PR zu
[`2026-08-10-projekt-detailseiten-design.md`](2026-08-10-projekt-detailseiten-design.md).

## Ziel

Die Projektseiten sind abgerufen, die Daten liegen vollständig in der Datenbank — sichtbar
ist davon nichts. `OfferResponse` liefert die neuen Felder nicht aus; die Angebotstabelle
zeigt stattdessen die alten Textspalten `rate` und `duration`, die zu 100 % leer sind.
Sichtbar ist also das Feld ohne Daten, unsichtbar das Feld mit Daten.

Dieser PR liefert die Felder aus, ersetzt die toten Spalten und wertet aus, was die Datenlage
trägt.

## Datenlage (Stand 2026-08-10, 431 primäre Angebote)

| Feld          | Abdeckung | Konsequenz für die Darstellung                        |
| ------------- | --------- | ------------------------------------------------------ |
| Beschreibung  | 428       | Ø 2.325 Zeichen — siehe „Was draußen bleibt"           |
| Remote-Anteil | 388       | trägt eine eigene Verteilung                           |
| Laufzeit      | 326       | Ø 8,8 Monate, Median 6 — trägt eine Verteilung         |
| Auslastung    | 257       | reicht für den Aufklapper, nicht für ein eigenes Chart |
| Budget gesamt | 44        |                                                        |
| davon Stundensatz | **31** | Ø 83,35 € — **nur mit Fallzahl** darstellbar          |

## Entscheidungen

| Frage                        | Entscheidung                                                          |
| ---------------------------- | --------------------------------------------------------------------- |
| Ø Stundensatz als Zeitreihe? | **Nein.** 31 Werte auf 12 Monate hieße 2–3 Werte je Monat — die Kurve zeigte Rauschen, nicht Markt. Stattdessen Verteilung plus Kennzahl mit Fallzahl. |
| Fallzahl                     | Steht an jeder Kennzahl und in jedem Chart-Titel, der auf dünner Basis steht. |
| Tote Spalten `rate`/`duration` | Fallen in diesem PR — samt der Regex-Zweige im `ParserService`.      |
| Beschreibung ausliefern      | **Nein**, siehe unten.                                                |
| Zeitraum                     | Alle neuen Auswertungen hängen wie alle anderen an `withinRange`.     |

## Backend

`OfferResponse` bekommt: `budgetEur`, `budgetKind`, `durationMonths`, `utilizationPercent`,
`remotePercent`, `startMonth`, `startImmediate`.

Migration `V9` entfernt die Spalten `rate` und `duration` von `offers`; die zugehörigen
Regex-Zweige in `ParserService` und die Felder in `Offer`/`OfferResponse` gehen mit. Belegt
ist ihre Nutzlosigkeit über 431 Angebote: kein einziger Treffer.

`start_date` (Rohtext aus der Mail, 428/431 gefüllt) **bleibt** — sie ist die einzige
Startangabe für Angebote, deren Detailseite kein Startdatum nennt.

### Was draußen bleibt: die Beschreibung

Die 428 Beschreibungen messen im Schnitt 2.325 Zeichen. Über die Liste ausgeliefert wären das
rund **1 MB zusätzlich** bei jedem Laden von `/api/offers` — für ein Feld, das nur im
aufgeklappten Detail einer einzelnen Zeile sichtbar wäre. Der Aufklapper verlinkt bereits auf
die Projektseite.

Wenn die Beschreibung in die Oberfläche soll, dann über einen eigenen Endpunkt
`GET /api/offers/{id}`, den der Aufklapper bei Bedarf nachlädt — das ist ein eigener,
kleiner PR und keine Erweiterung dieses hier.

## Frontend — Angebotstabelle

**Zwei neue Spalten**, sortierbar, ohne Filter (Filter brauchen Wertebereiche, die bei
9 % Abdeckung wenig hergeben):

| Spalte | Inhalt                                                                 |
| ------ | ---------------------------------------------------------------------- |
| Satz   | `budgetEur` **nur wenn `budgetKind === 'HOURLY'`**, formatiert „83 €/h"; sonst „—" |
| Dauer  | `durationMonths` als „6 Mon."; sonst „—"                                |

Ein Tagessatz oder Gesamtbudget erscheint **nicht** in der Satz-Spalte — dort stünde sonst
„649 €/h". Beide Werte sind im Aufklapper sichtbar, dort mit ihrer Einordnung.

**Aufklapper**: die Zeilen `rate` und `duration` (immer leer) weichen den strukturierten
Angaben — Budget mit Einordnung („649 € pro Tag", „750.000 € gesamt"), Laufzeit, Auslastung,
Remote-Anteil in Prozent und Start („ab sofort" bzw. Monat, sonst der Rohtext aus der Mail).

## Frontend — Dashboard

Zwei neue Charts in der Gesamtauswertung, beide dem gewählten Zeitraum folgend:

1. **Laufzeit-Verteilung** — Balken über die Klassen **bis 3**, 4–6, 7–12, über 12 Monate.
   326 Werte tragen das. Die erste Klasse ist nach unten offen, damit kein Wert lautlos
   herausfällt.
2. **Stundensatz-Verteilung** — Balken über die Klassen **unter 60**, 60–79, 80–99, 100–119,
   **ab 120** €. Nur `HOURLY`, also alles zwischen 0 und 250 € — beide Randklassen sind offen.
   Der Titel nennt die Fallzahl.

Das bestehende **Remote-Donut wird ersetzt** durch eine Verteilung über den Prozentwert
(0 %, 1–49 %, 50–99 %, 100 %) — dieselbe Aussage, aber feiner und aus 388 statt aus einer
Dreistufung. Die Gesamtauswertung zeigt damit sieben Charts.

Zusätzlich eine Zeile **Marktkennzahlen** über den Charts — **nur in der Gesamtauswertung**,
nicht im Agenten-Tab, wo die Fallzahlen je Agent noch dünner wären. Sie zeigt Ø Stundensatz,
Ø Laufzeit und Ø Remote-Anteil, jeweils mit Fallzahl in der Form „83 €/h · 31 Angebote". Die
Zeile folgt dem Zeitraum und steht damit bewusst getrennt von der KPI-Kachel-Zeile, die feste
Fenster trägt. Fehlt eine Kennzahl mangels Daten, steht dort „—" und keine 0.

**Zahlenformate:** Stundensatz ganzzahlig gerundet („83 €/h"), Laufzeit mit einer
Nachkommastelle („8,8 Monate"), Remote-Anteil ganzzahlig („74 %").

## Aggregationen

Neu in `offers/util/offer-stats.ts`, alle auf der bereits zeitgefilterten Liste:

- drei Extraktoren, die je Angebot den Wert herausziehen und Fehlendes überspringen:
  `hourlyRates(offers)` (nur `budgetKind === 'HOURLY'`), `durations(offers)`,
  `remotePercents(offers)` — alle `number[]`
- `averageWithCount(values): { average: number | null; count: number }` — Kennzahl samt
  Fallzahl, `null` bei leerer Liste (nicht `0`); die drei Kennzahlen der Marktzeile bauen
  darauf auf
- `durationBuckets(offers)`, `rateBuckets(offers)`, `remotePercentBuckets(offers)` — je
  `NamedCount[]`

Die Klassengrenzen liegen als Konstanten neben den Funktionen — ein Ort, getestet.

## Tests

- **`offer-stats.spec.ts`**: Klassengrenzen (ein Wert genau auf der Grenze je Klasse),
  `averageWithCount` liefert `null` statt `0` bei leerer Liste, `hourlyRates` ignoriert
  `DAILY`/`TOTAL`.
- **`offer-table.spec.ts`**: Die Satz-Spalte zeigt einen Stundensatz, aber „—" bei `DAILY`.
- **Dashboard-Specs**: die neuen Charts bekommen die zeitgefilterten Daten; die
  Kennzahl-Zeile nennt die Fallzahl.
- **`CollectControllerTest`**: `/api/offers` liefert die neuen Felder und **nicht** mehr
  `rate`/`duration`.
- **e2e**: Chart-Anzahl je Tab, Satz-Spalte sichtbar.

## Nicht Teil dieser Änderung

- Beschreibung in der Oberfläche (eigener Endpunkt, eigener PR)
- Ø Stundensatz als Zeitreihe — erst wenn die Fallzahl es trägt
- Umrechnung von Tagessätzen in Stundensätze: eine Annahme (÷ 8) auf einer Heuristik
  (`budget_kind`) wäre eine Zahl, die niemand mehr hinterfragen kann
