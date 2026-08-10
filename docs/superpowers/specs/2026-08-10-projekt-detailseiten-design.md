# Projekt-Detailseiten abrufen und auswerten

Design-Spec, 2026-08-10. Umsetzung von Punkt 2 aus
[`docs/improvement-backlog.md`](../../improvement-backlog.md) — allerdings auf anderem Weg als
dort notiert, siehe „Warum nicht wie im Backlog".

## Ziel

Rate und Laufzeit sollen in die Marktbewertung einfließen. Beide stehen **nicht** in den
Agenten-Mails, wohl aber auf der verlinkten Projektseite. Diese Änderung holt die Seite ab,
liest die strukturierten Fakten deterministisch aus und gibt der Claude-Analyse statt der
sieben Teaser-Zeilen die echte Projektbeschreibung.

## Warum nicht wie im Backlog

Der Backlog-Eintrag vermutete, die Parser-Regex für die Rate greife nicht. Gemessen am
Bestand vom 2026-08-09 (428 primäre Angebote) ist die Ursache eine andere — die Daten fehlen
in der Quelle:

| Suchbegriff im Mailtext          | Treffer |
| -------------------------------- | ------- |
| „Stundensatz"                    | 2       |
| „Tagessatz"                      | 0       |
| €/h-, €/Std-, €/Tag-Muster       | 0       |
| „Laufzeit" / „Projektdauer"      | 0       |

Die Mails sind Teaser: Titel, Erstellungsdatum, Firma, Ort, Vertragsart, Remote-Anteil,
Start, Link — rund 1.271 Zeichen für **mehrere** Projekte. Ein LLM kann daraus nichts
extrahieren, was nicht da ist. Das erklärt zugleich, warum `industry` zu 90 % „unbekannt" ist
und die Skills praktisch nur aus dem Projekttitel stammen.

## Vorprüfung

- **robots.txt**: `User-agent: *` mit leerem `Disallow`, kein `Crawl-delay` — der Abruf ist
  nicht untersagt. Wir drosseln trotzdem und rufen jede Seite genau einmal ab.
- **Die Projektseiten sind öffentlich**, kein Login. Sechs Stichproben aus dem Bestand
  lieferten alle HTTP 200, auch ältere Projekte — der Nachlauf über den Bestand ist möglich.
- **Feldabdeckung** (7 Stichproben, indikativ): Dauer 6/6, Auslastung 5/6, Remote-Anteil und
  Vertragsart durchgängig, Stundensatz 2/7. Die echte Quote zeigt sich nach dem Nachlauf.

## Entscheidungen

| Frage                          | Entscheidung                                                            |
| ------------------------------ | ------------------------------------------------------------------------ |
| Auslöser                       | Im Collect-Lauf, direkt nach dem Parsen                                 |
| Beschreibung in der Analyse    | Ja, und der Bestand wird einmal neu bewertet                            |
| Extraktion                     | Deterministisch aus dem HTML, kein LLM für die strukturierten Felder    |
| „Budget"                       | Ist der **Stundensatz** (vom Maintainer bestätigt) → `rate_hourly_eur`  |
| Umfang                         | Nur Backend; die Auswertung im Frontend folgt als eigener PR            |

## Abruf

Neuer `ProjectPageService` im Paket `collect`, mit Javas `HttpClient`:

- Die gespeicherte URL wird vor dem Abruf von Tracking-Parametern befreit
  (`?utm_source=…&utm_medium=…&agent=…&t=…`); abgerufen wird `…/nproj/<id>.html`.
- Der 301 auf die kanonische `…/projekt/<slug>`-Adresse wird verfolgt.
- Ein Request pro Sekunde, 10 s Timeout, User-Agent
  `freelance-radar/1.0 (+https://github.com/themmerich/freelance-radar)`.

Konfiguration unter `radar.detail.*` in `application.properties`:

| Property                     | Standard | Wirkung                                        |
| ---------------------------- | -------- | ---------------------------------------------- |
| `radar.detail.enabled`       | `true`   | Schalter für den gesamten Abruf                |
| `radar.detail.delay-ms`      | `1000`   | Pause zwischen zwei Requests                   |
| `radar.detail.timeout-ms`    | `10000`  | Timeout je Request                             |
| `radar.detail.max-per-run`   | `150`    | Deckel je Collect-Lauf (neue + nachzuholende)  |

## Parsen

Mit **jsoup** (neue Dependency). Die Fakten hängen in `div.project-header-info-list .badge`,
jeweils mit einer Icon-Klasse — primärer Zugriff über diese Klasse, das Textlabel dient als
Rückfall:

> **Korrektur gegenüber dem ersten Entwurf** (beim Bau der Fixtures aufgefallen): dort stand
> `div.project-body-badges`. Dieser Container führt Branche und Skill-Tags, nicht die
> Faktenzeile — die sitzt im Kopfbereich unter `project-header-info-list`.

| Icon-Klasse        | Badge-Text            | Feld                  |
| ------------------ | --------------------- | --------------------- |
| `fa-euro-sign`     | „70,00 € Budget"      | `rateHourlyEur`       |
| `fa-hourglass`     | „Dauer 6 Monate"      | `durationMonths`      |
| `fa-briefcase`     | „100% Auslastung"     | `utilizationPercent`  |
| `fa-car-side`      | „60% Remote"          | `remotePercent`       |
| `fa-file-contract` | „Freiberuflich"       | `contractType`        |
| `fa-calendar`      | „ab sofort" / „Start 9/2026" | `startMonth` bzw. `startImmediate` |

Die Beschreibung kommt aus `div.project-body-description` als Text (Markup entfernt).

Normalisierung im Einzelnen:

- **Stundensatz**: deutsches Zahlenformat, „70,00 €" → `70.00`. Fehlt das Badge, bleibt das
  Feld `null` — ein fehlender Satz ist kein `0`.
- **Dauer**: „Dauer 6 Monate" → `6`; Jahresangaben werden in Monate umgerechnet. Eine
  Formulierung, die keiner der beiden Formen entspricht, ergibt `null` statt eines Rateversuchs.
- **Start**: „Start 9/2026" → `start_month = 2026-09-01`, `start_immediate = false`;
  „ab sofort" → `start_month = null`, `start_immediate = true`; kein Badge → `null` und `false`.
- **Prozentwerte**: „100% Auslastung", „60% Remote" → `100`, `60`.

Fehlt ein Badge, bleibt das Feld `null` — die Seiten sind erkennbar unterschiedlich befüllt,
das ist der Normalfall und kein Fehler.

**Branche bleibt beim LLM.** Sie steht nicht auf allen Seiten, und mit der vollen Beschreibung
wird die Schätzung ohnehin belastbarer; ein zweiter Pfad brächte nur Konfliktregeln.

**Nicht ausgelesen und nicht gespeichert:** Ansprechpartner und Kontaktdaten. Personenbezogen
und für eine Marktbewertung ohne Wert.

## Persistenz

Flyway `V7` auf `offers`:

| Spalte                | Typ            | Inhalt                                              |
| --------------------- | -------------- | --------------------------------------------------- |
| `rate_hourly_eur`     | `numeric(8,2)` | Stundensatz laut Budget-Badge                       |
| `duration_months`     | `int`          | Projektdauer in Monaten                             |
| `utilization_percent` | `int`          | Auslastung                                          |
| `remote_percent`      | `int`          | Remote-Anteil als Zahl                              |
| `contract_type`       | `text`         | Vertragsart                                         |
| `start_month`         | `date`         | Erster Tag des genannten Startmonats, sonst `null`  |
| `start_immediate`     | `boolean`      | `true` bei „ab sofort"                              |
| `description`         | `text`         | Projektbeschreibung für die Analyse                 |
| `detail_status`       | `text`         | `PENDING` / `OK` / `NOT_FOUND` / `ERROR`            |
| `detail_fetched_at`   | `timestamptz`  | Zeitpunkt des erfolgreichen Abrufs                  |

Bestehende Zeilen bekommen `detail_status = 'PENDING'`, damit der Nachlauf sie findet.

Die vorhandene Enum-Spalte `remote` bleibt unberührt — `remote_percent` tritt daneben, die
Auswertung darauf ist Sache des Folge-PRs.

Die alten Text-Spalten `rate` und `duration` sind über 428 Angebote hinweg zu 100 % leer (die
Regex kann auf Teaser-Mails nicht greifen) und werden von den neuen Spalten abgelöst. Sie
**bleiben in diesem PR trotzdem stehen**: `OfferResponse` und der Angebots-Typ im Frontend
führen sie, ein Wegfall hier würde die API mittendrin durchschneiden. Sie fallen samt der
toten Regex-Zweige in `ParserService` im Folge-PR, der das Frontend ohnehin anfasst.
`start_date` (428/428 gefüllt) bleibt dauerhaft, sie trägt die Roh-Angabe aus der Mail.

Die API bleibt in diesem PR unverändert: die neuen Felder werden erst im Folge-PR über
`OfferResponse` ausgeliefert. Dieser PR sammelt nur.

## Analyse

`PromptOffer.text` bekommt `description` statt `rawBody`; fehlt die Beschreibung (Abruf
fehlgeschlagen oder abgeschaltet), fällt es auf `rawBody` zurück. Die Kürzung über
`radar.analysis.prompt-body-chars` (2000) bleibt unverändert — sie begrenzt jetzt echten
Fließtext statt Teaser-Zeilen, wodurch der Input-Token-Verbrauch je Angebot steigt.

Der System-Prompt bleibt bis auf einen Zusatz gleich: Rate, Dauer und Auslastung liegen
strukturiert vor und sollen **nicht** geschätzt werden.

## Bestand nachholen

Der Collect-Lauf arbeitet nach den neu eingesammelten Angeboten die Warteschlange der
Angebote mit `detail_status IN ('PENDING','ERROR')` ab, bis `max-per-run` erreicht ist
(älteste zuerst). Die 425 bestehenden Angebote sind damit nach drei Läufen versorgt.

Danach einmal „gesamten Bestand neu bewerten" über die vorhandene Funktion mit Kostenvorschau
— damit alte und neue Angebote in den Zeitreihen dieselbe Datenqualität tragen.

## Fehlerverhalten

| Fall                    | `detail_status` | Folge                                    |
| ----------------------- | --------------- | ---------------------------------------- |
| Abruf erfolgreich       | `OK`            | Felder gefüllt, `detail_fetched_at` gesetzt |
| HTTP 404 / 410          | `NOT_FOUND`     | kein erneuter Versuch                    |
| Timeout, 5xx, 429       | `ERROR`         | nächster Lauf versucht es erneut         |
| Kein `project_url`      | `NOT_FOUND`     | nichts abzurufen (3 von 428)             |

Ein fehlgeschlagener Abruf bricht den Collect-Lauf nie ab; er wird gezählt und im
Lauf-Ergebnis mitgeführt.

## Tests

- **Parser** gegen gespeicherte HTML-Ausschnitte als Fixtures (aus den Stichproben gekürzt):
  vollständige Badge-Zeile, Seite ohne Budget-Badge, Seite ohne Dauer, „ab sofort" gegen
  „Start 9/2026", Beschreibung mit Markup.
- **`ProjectPageService`** mit gestubbtem HTTP-Client: URL-Bereinigung, 404 → `NOT_FOUND`,
  Timeout → `ERROR`.
- **`CollectService`**: Deckel `max-per-run` greift, ein Fehler beendet den Lauf nicht,
  `enabled=false` überspringt den Abruf vollständig.
- Keine echten Netzwerkzugriffe in Tests.

## Ergebnis der Gegenprobe

Der fertige Parser gegen sechs echte Seiten (2026-08-10):

| Feld         | Treffer | Anmerkung                                        |
| ------------ | ------- | ------------------------------------------------ |
| Laufzeit     | 6/6     | 4 bis 8 Monate                                   |
| Remote-Anteil| 6/6     | 20 % bis 100 %                                   |
| Auslastung   | 4/6     |                                                  |
| Start        | 6/6     | 2× Monat, 4× „ab sofort"                         |
| Stundensatz  | 1/6     | zusammen mit der siebten Stichprobe: 2/7         |
| Beschreibung | 6/6     | 1.483 bis 3.506 Zeichen                          |

**Beobachtung zur Kürzung:** Vier der sechs Beschreibungen sind länger als die 2.000 Zeichen,
auf die `radar.analysis.prompt-body-chars` kürzt — die Analyse sieht dann den Anfang. Das ist
immer noch ein Vielfaches des Teasers (1.271 Zeichen für *mehrere* Projekte). Ob der Deckel
steigen soll, ist eine Kostenentscheidung und bleibt bewusst offen.

## Nicht Teil dieser Änderung

- Auswertung im Frontend (Ø Stundensatz je Zeitraum, Laufzeit-Verteilung, Tabellenspalten) —
  eigener PR direkt im Anschluss, dort auch `OfferResponse` um die neuen Felder erweitern und
  die toten Spalten `rate` / `duration` entfernen
- Nutzung von `remote_percent` anstelle der groben Remote-Stufen
- Collect-Automatisierung (Backlog-Punkt 1)
