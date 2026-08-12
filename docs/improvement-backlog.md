# Verbesserungs-Backlog

Stand: 2026-08-09. Ergebnis eines Anwendungs-Reviews gegen das Ziel: aus den
freelancermap-Agenten-Mails eine belastbare **Marktbewertung** gewinnen (letzte Tage,
Monate, perspektivisch Jahre).

Die Reihenfolge innerhalb der Abschnitte ist die empfohlene Umsetzungsreihenfolge:
erst die Datenbasis, dann die Auswertungen, die darauf aufbauen.

## Befund zur Datenbasis

Gemessen am Bestand vom 2026-08-09 (428 primäre Angebote seit 2026-07-20):

| Feld        | Füllgrad                    | Bewertung                                                          |
| ----------- | --------------------------- | ------------------------------------------------------------------ |
| `rate`      | 0 von 428                   | Parser-Regex greift bei freelancermap-Mails nie — Kernsignal fehlt |
| `duration`  | 0 von 428                   | gleiches Bild                                                      |
| `startDate` | 428, verschmutzt            | Werte wie „und Auslastung" neben „08/2026" und „ab sofort"         |
| `industry`  | 40 von 428 (90 % unbekannt) | Branchenauswertung derzeit wertlos                                 |
| `seniority` | 316 von 428                 | gut gefüllt, aber nirgends visualisiert                            |
| `country`   | 403 von 428                 | gut gefüllt, aber nirgends visualisiert                            |

## A. Fundament

1. ~~**Collect-Automatisierung**~~ — **verworfen am 2026-08-10**, der Collect-Lauf bleibt
   Handarbeit. Damit bleibt die Einschränkung bestehen: „heute/7 Tage"-KPIs stimmen nur nach
   frischem Abruf, und Lücken in der Sammlung schlagen auf jede Zeitreihe durch.

2. ~~**Rate und Laufzeit über die Analyse extrahieren statt per Regex**~~ — **erledigt am
   2026-08-10, aber anders als hier vermutet.** Die Annahme, die Regex greife nicht, war
   falsch: Rate und Laufzeit stehen überhaupt nicht in den Mails (0 von 428 nennen eine
   Laufzeit). Beide stehen auf der verlinkten, öffentlich erreichbaren Projektseite, die
   jetzt beim Collect-Lauf mit abgerufen wird — deterministisch geparst, ohne Tokens. Die
   Beschreibung von dort geht zusätzlich in die Analyse, weil die Teaser-Mail für Skills und
   Branche zu dünn ist. Entwurf:
   [`2026-08-10-projekt-detailseiten-design.md`](superpowers/specs/2026-08-10-projekt-detailseiten-design.md).
   **Abdeckung laut Stichprobe:** Laufzeit praktisch immer, Stundensatz nur bei rund einem
   Viertel der Projekte — die echte Quote zeigt sich nach dem Nachlauf über den Bestand.

3. **`industry` schärfen oder streichen**
   Entweder Prompt mit fester Kategorienliste (analog zur Berufsprofil-Clusterung)
   nachschärfen — oder das Feld bewusst aufgeben, statt 90 % „unbekannt" zu schleppen.

## B. Marktauswertungen

4. ~~**Wählbarer Zeitraum statt fest verdrahteter Fenster**~~ — **erledigt am 2026-08-10.**
   Umschalter „30 Tage / 90 Tage / 12 Monate / Alles" über den Tabs, alle Charts beider Tabs
   stellen um; die Auflösung wandert mit (Tage → Wochen → Monate). Entwurf:
   [`2026-08-10-dashboard-zeitraum-design.md`](superpowers/specs/2026-08-10-dashboard-zeitraum-design.md).

5. ~~**Trend-Deltas in den KPI-Kacheln**~~ — **erledigt am 2026-08-10.** „7 Tage" und
   „30 Tage" tragen das relative Delta zur gleich langen Vorperiode, Ø Score und 🟢-Anteil
   das absolute (Punkte bzw. Prozentpunkte). Beide Qualitätskacheln zeigen dafür statt des
   Allzeit-Werts die letzten 30 Tage — sonst würden Wert und Delta Verschiedenes messen.
   Das Delta entfällt, solange der Bestand die Vorperiode nicht deckt: bei den drei
   30-Tage-Kacheln also bis zum 2026-09-17, weil die Sammlung erst am 2026-07-20 begann.
   Entwurf:
   [`2026-08-10-kpi-trend-deltas-design.md`](superpowers/specs/2026-08-10-kpi-trend-deltas-design.md).

6. **Skill-Trends über Zeit** _(Roadmap-Punkt „Wochen-Trend je Skill")_
   Top-Skills als Zeitreihe (Nennungen pro Woche/Monat, steigend/fallend) statt nur
   als Momentaufnahme: Was verlangt der Markt mehr als vor drei Monaten?

7. ~~**Brachliegende Felder visualisieren**~~ — **erledigt am 2026-08-12.** Drei neue
   Charts im Global-Tab: Seniority-Verteilung (junior → architect plus Unbekannt),
   Einsatzland (DE/AT/CH/Andere/Unbekannt) und Ø Remote-Anteil als Zeitreihe. Das im
   Backlog erwähnte Donut gab es zu dem Zeitpunkt schon nicht mehr — die Trendlinie
   ergänzt die Remote-Verteilung, die an seine Stelle getreten war. Entwurf:
   [`2026-08-12-brachliegende-felder-design.md`](superpowers/specs/2026-08-12-brachliegende-felder-design.md).

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
selbst. Weil der Collect-Lauf Handarbeit bleibt (Punkt 1), hängt die Belastbarkeit
dieser Auswertungen daran, wie regelmäßig abgerufen wird — je lückenloser, desto eher
werden Saisonalität und Jahresvergleiche möglich.

## Empfohlene Reihenfolge

Erledigt sind 2 (Rate/Laufzeit), 4 (Zeitraum-Umschalter), 5 (Deltas) und 7 (brachliegende
Felder); 1 (Automatisierung) ist verworfen. Offen und in dieser Reihenfolge sinnvoll:
6 (Skill-Trends) → 3 (`industry`) → Rest. Punkt 6 ist ein überschaubarer eigener PR.
