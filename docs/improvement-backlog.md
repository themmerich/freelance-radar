# Verbesserungs-Backlog

Stand: 2026-08-09. Ergebnis eines Anwendungs-Reviews gegen das Ziel: aus den
freelancermap-Agenten-Mails eine belastbare **Marktbewertung** gewinnen (letzte Tage,
Monate, perspektivisch Jahre).

Die Reihenfolge innerhalb der Abschnitte ist die empfohlene Umsetzungsreihenfolge:
erst die Datenbasis, dann die Auswertungen, die darauf aufbauen.

## Befund zur Datenbasis

Gemessen am Bestand vom 2026-08-09 (428 primäre Angebote seit 2026-07-20):

| Feld        | Füllgrad                   | Bewertung                                                        |
| ----------- | -------------------------- | ---------------------------------------------------------------- |
| `rate`      | 0 von 428                  | Parser-Regex greift bei freelancermap-Mails nie — Kernsignal fehlt |
| `duration`  | 0 von 428                  | gleiches Bild                                                    |
| `startDate` | 428, verschmutzt           | Werte wie „und Auslastung" neben „08/2026" und „ab sofort"       |
| `industry`  | 40 von 428 (90 % unbekannt) | Branchenauswertung derzeit wertlos                               |
| `seniority` | 316 von 428                | gut gefüllt, aber nirgends visualisiert                          |
| `country`   | 403 von 428                | gut gefüllt, aber nirgends visualisiert                          |

## A. Fundament

1. **Collect-Automatisierung** _(Roadmap-Punkt, vorziehen — größter Hebel, kostet keine Tokens)_
   Täglicher Collect-Lauf per Task Scheduler: nur Abruf + Dedup, die kostenpflichtige
   Analyse bleibt manuell. Ohne lückenlose Sammlung ist keine Zeitreihe über Monate
   belastbar; „heute/7 Tage"-KPIs stimmen nur nach frischem Abruf.

2. **Rate und Laufzeit über die Analyse extrahieren statt per Regex**
   `OfferAssessment` um `rate` (normalisiert €/h), `duration` (Monate) und ein
   bereinigtes `startMonth` erweitern — das LLM liest den Body ohnehin, Mehrkosten
   sind ein paar Output-Tokens pro Angebot. Schaltet die Raten-Statistik frei
   (Ø Stundensatz pro Monat, Satz je Skill/Rolle/Seniorität).

3. **`industry` schärfen oder streichen**
   Entweder Prompt mit fester Kategorienliste (analog zur Berufsprofil-Clusterung)
   nachschärfen — oder das Feld bewusst aufgeben, statt 90 % „unbekannt" zu schleppen.

## B. Marktauswertungen

4. **Wählbarer Zeitraum statt fest verdrahteter Fenster**
   Umschalter „30 Tage / 90 Tage / 12 Monate / Alles" über dem Dashboard, alle Charts
   stellen um; Aggregation wechselt mit dem Fenster (Tage → Wochen → Monate).

5. **Trend-Deltas in den KPI-Kacheln** _(kleiner Eingriff, rein Frontend)_
   „30 Tage: 428 (+12 % ggü. Vorperiode)", ebenso für Ø Score und 🟢-Anteil —
   erst das Delta macht aus der Kachel eine Marktaussage.

6. **Skill-Trends über Zeit** _(Roadmap-Punkt „Wochen-Trend je Skill")_
   Top-Skills als Zeitreihe (Nennungen pro Woche/Monat, steigend/fallend) statt nur
   als Momentaufnahme: Was verlangt der Markt mehr als vor drei Monaten?

7. **Brachliegende Felder visualisieren** _(zwei Charts zum Preis von null neuen Daten)_
   Seniority-Verteilung und DE/AT/CH-Anteil aus vorhandenen Daten; Remote-Anteil
   zusätzlich als Trendlinie statt nur als Donut.

8. **Monats-/Wochenbericht als Digest** _(Weiterentwicklung des Obsidian-Export-Roadmap-Punkts)_
   Generierter Marktbericht (Volumen + Trend, Sätze, Top-Skills/Gaps, beste Matches),
   optional mit einem einzelnen günstigen Haiku-Aufruf über die _Aggregate_ als
   narrativer Marktkommentar.

## C. Bewertungsqualität

9. **Feedback-Schleife für den Match-Score**
   Angebots-Status „beworben / interessant / irrelevant" (ein Klick in der Tabelle).
   Nach ein paar Monaten prüfen, ob der Score trennt (Ø Score „beworben" vs.
   „irrelevant") — erst dann lohnt Prompt-Feintuning.

10. **Profil-Vergleichsansicht** _(Roadmap-Punkt)_
    Ø Score und 🟢-Quote je Profil nebeneinander: Als was positioniere ich mich am
    besten?

## Einordnung zu „Jahre"

Für Mehrjahres-Trends fehlt kein Code, sondern Datenhistorie (Sammlung läuft seit
2026-07-20). Postgres ist die dauerhafte Quelle, das 12-Monats-Chart füllt sich von
selbst — deshalb Punkt 1 zuerst: je früher lückenlos gesammelt wird, desto früher
werden Saisonalität und Jahresvergleiche möglich.

## Empfohlene Reihenfolge

1 (Automatisierung) → 2 (Rate/Laufzeit) → 5 (Deltas) → 6 (Skill-Trends) →
4 (Zeitraum-Umschalter) → Rest. Die Punkte 1, 2, 5 und 7 sind jeweils überschaubare
eigene PRs.
