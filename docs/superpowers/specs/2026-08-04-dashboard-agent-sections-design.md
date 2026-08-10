# Dashboard: globale und agentenspezifische Sektion

Design-Spec vom 2026-08-04. Betrifft nur das Frontend (`frontend/src/app/offers/`),
keine Backend-Änderung.

## Ziel

Das Dashboard (`offers-page`) zeigt heute neun Charts, die alle über sämtliche
primären Angebote aggregieren. Skills, Skill-Gaps und Score-Auswertungen vermischen
dabei die Domänen der Suchagenten (z. B. KI- und Angular-Projekte). Das Dashboard
wird in zwei Sektionen geteilt:

1. **Global** — Charts, die über alle Agenten sinnvoll sind, insbesondere die
   Agenten-*Vergleiche*.
2. **Agenten-Analyse** — ein Dropdown wählt einen freelancermap-Suchagenten
   (z. B. „AI Agent", „Angular Agent"); darunter stehen die Charts, die nur pro
   Agent aussagekräftig sind (Skill-Gaps, Match-Score usw.).

## Entscheidungen (geklärt)

- **Dropdown listet nur echte Suchagenten.** Angebote ohne Agent
  (`sourceType` `PRIVATE`/`NEWSLETTER`/`OTHER`) fließen ausschließlich in die
  globalen Charts ein; es gibt keinen Eintrag „Ohne Agent" und keine Option „Alle".
- **Kein doppelter Inhalt:** Die vier Detail-Charts erscheinen nur noch in der
  Agenten-Sektion, ihre bisherigen globalen Varianten entfallen.
- **Keine eigenen KPI-Kacheln pro Agent.** Die KPI-Zeile oben bleibt global;
  die Agenten-Sektion enthält nur die vier Charts.

## Seitenstruktur

`offers-page` rendert innerhalb der bestehenden Card von oben nach unten:

1. KPI-Kacheln (`app-kpi-tiles`, unverändert, global)
2. Globale Charts (`app-offer-charts`):
   - Angebote pro Tag (30 Tage)
   - Trigger pro Agent
   - Ø Match-Score pro Agent
   - Remote-Anteil
   - Angefragte Berufsprofile
3. Zwischenüberschrift „Agenten-Analyse" mit dem Agent-Dropdown — ein natives,
   Tailwind-gestyltes `<select>` mit sichtbarem Label, wie der Profil-Umschalter
   der App-Shell. (Ursprünglich war PrimeNG `p-select` geplant; dessen
   `BaseInput` erbt `min`/`max` als number-Inputs und kollidiert mit der
   Typprüfung der Signal-Forms-`FormField`-Direktive bei String-Feldern.)
4. Agenten-Charts (`app-agent-charts`), gefiltert auf den gewählten Agenten:
   - Ø Match-Score pro Tag (30 Tage)
   - Match-Score-Verteilung
   - Top nachgefragte Skills
   - Top Skill-Gaps

## Komponenten

Alle in `frontend/src/app/offers/ui/`, reine Präsentationskomponenten ohne
eigene Services:

- **`OfferCharts`** (bestehend): behält die fünf globalen Charts; die Inputs
  `scoreTrend`, `skills`, `gaps`, `histogram` sowie `greenThreshold`/
  `yellowThreshold` entfallen.
- **`AgentCharts`** (neu, Selektor `app-agent-charts`): die vier Detail-Charts
  mit den Inputs `scoreTrend`, `histogram`, `skills`, `gaps`,
  `greenThreshold`, `yellowThreshold`, `dark` — Optik und Chart-Optionen wie
  bisher (feste 0–100-Werteachse für Score-Charts, Ampelfarben im Histogramm).
- **`chart-theme.ts`** (neu): gemeinsame Farbpalette (`PALETTE`) und der
  `axisOptions`-Helfer, von beiden Chart-Komponenten genutzt — keine Duplikate.

Das Dropdown liegt in der Seite, nicht in `AgentCharts`; die Chart-Komponente
bleibt rein präsentierend.

## Agentenauswahl und Datenfluss

- Die Agentenliste kommt aus den vorhandenen Angeboten:
  `triggersPerAgent(primaryOffers())` liefert alle Agentennamen absteigend nach
  Angebotszahl. Kein zusätzlicher Backend-Aufruf.
- Die Auswahl ist ein `linkedSignal` in der Seite: vorbelegt mit dem Agenten mit
  den meisten Angeboten; verschwindet der gewählte Agent nach einem Reload,
  fällt die Auswahl auf den ersten Eintrag zurück. Die Auswahl wird nicht
  persistiert (bewusst, YAGNI).
- Die vier Detail-Aggregationen sind `computed`-Signale über die gefilterte
  Liste: `sourceType === 'AGENT' && agentName === auswahl`, weiterhin nur
  primäre Angebote.
- Alle Aggregationsfunktionen in `offers/util/offer-stats.ts` bleiben
  unverändert; sie erhalten lediglich eine vorgefilterte Liste.

## Randfälle

- **Keine Agent-Angebote vorhanden:** Die komplette Agenten-Sektion
  (Überschrift, Dropdown, Charts) wird durch einen kurzen Hinweistext ersetzt —
  kein leeres Dropdown.
- **Gewählter Agent ohne analysierte Angebote:** Score-Trend und -Verteilung
  zeigen leere Achsen, Skills/Gaps leere Balkenlisten — gleiches Verhalten wie
  heute bei leeren Daten, kein Sonder-UI.

## i18n

Neue Transloco-Keys in `frontend/public/i18n/de.json` und `en.json` unterhalb
von `offers`: Sektionsüberschrift „Agenten-Analyse", Label des Dropdowns und der
Hinweistext für „keine Agent-Angebote". Die bestehenden Chart-Titel-Keys unter
`offers.charts` bleiben unverändert und werden von der jeweils neuen Komponente
weiterverwendet.

## Tests

- `offer-stats.spec.ts` bleibt unberührt (keine Funktionsänderung).
- Neu: Tests für die Auswahl-Logik der Seite — Vorbelegung mit dem stärksten
  Agenten, Fallback bei verschwundenem Agenten, korrekte Filterung der
  Detail-Daten.
- Neu: schlanker Rendering-Test für `AgentCharts` analog zu den bestehenden
  UI-Specs (`kpi-tiles.spec.ts`).

## Nicht im Scope

- Backend-/API-Änderungen
- Persistenz der Agentenauswahl (Settings/URL)
- KPI-Kacheln pro Agent
- Deep-Links oder eigene Routen pro Agent
