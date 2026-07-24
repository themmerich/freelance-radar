# freelance-radar

Markt-Radar für freelancermap-Projektangebote — Nachfolger des Hermes-basierten v1.
Ein Klick im Dashboard holt neue Angebots-Mails aus dem GMX-Postfach (IMAP), parst und
dedupliziert sie und bewertet **nur die neuen** Angebote per Claude API (Haiku) mit
Match-Score, Skill-Gaps und Agent-Klassifizierung. **Button-getrieben statt Cronjob** —
Tokens werden nur verbraucht, wenn bewusst ein Lauf ausgelöst wird.

Der vollständige Entwicklungsplan (Phasen, Datenmodell, Token-Budget) liegt im
Obsidian-Vault: `02 Projekte/Freelance Radar 2.md`.

## Stack

| Path                                         | Contents                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [`frontend/`](frontend/README.md)            | Angular 22 single-page app — pnpm, PrimeNG, Transloco, NgRx Signals, Tailwind             |
| [`backend/`](backend/AGENTS.md)              | Spring Boot 4.1 service — Gradle (Kotlin DSL), Java 25, JPA, Flyway, Spring AI 2.0        |
| [`style-guide/`](style-guide/style-guide.md) | Per-file-type style guides (TypeScript, templates, SCSS, a11y, tests, npm, git, markdown) |
| [`.claude/skills/`](SKILLS.md)               | Task-specific agent skills, indexed in [`SKILLS.md`](SKILLS.md)                           |
| [`scripts/`](scripts/)                       | Repo verification — shared check runner, full-suite verify, Claude Code Stop hook         |

Das Repo basiert auf dem tapout-ai-Referenz-Setup (Angular/Spring-Boot-Monorepo mit
Style-Guides, Skills, Sheriff-Modulgrenzen und Verify-Skripten). Die vertikale Slice:
Flyway-Schema (`offers`, `offer_skills`, `runs`) → JPA → `ImapService`/`ParserService`
→ `AnalysisService` (Spring AI, `claude-haiku-4-5`, ein Batch-Request pro Lauf mit
Kostendeckel) → REST (`GET /api/offers`, `POST /api/runs`) → Angular-Dashboard
(Sheriff-Scope `offers`) mit Score-Ampel, Kostenanzeige und Detail-Ansicht.

## Prerequisites

- **Node.js 26+** mit **Corepack** (`corepack enable`) — Version gepinnt in [`.nvmrc`](.nvmrc);
  pnpm gepinnt via `packageManager` in [`frontend/package.json`](frontend/package.json);
  niemals npm oder yarn
- **Java 25** (Gradle kommt über den Wrapper)
- **Docker** — PostgreSQL: Container `freelance-radar2-db` auf **Port 5435** via
  [`backend/compose.yaml`](backend/compose.yaml) im Dev-Betrieb, Testcontainers in Tests
  (die alte v1-Datenbank auf 5434 bleibt unberührt)

## Quick start

Frontend:

```bash
cd frontend
pnpm install
pnpm start        # dev server on http://localhost:4200/
```

Backend:

```bash
cd backend
./gradlew bootRun # startet PostgreSQL via Docker Compose automatisch
```

Full verification (lint, format, unit tests, builds, backend):

```bash
node scripts/verify.mjs
```

## Secrets

GMX-Zugangsdaten und der Anthropic-API-Key liegen ausschließlich lokal in git-ignorierten
Dateien (`application-local.properties` / `environment.local.ts`) — niemals im Repo.
Gleiches gilt für den PrimeNG-License-Key
(siehe [`environment.local.example.ts`](frontend/src/environments/environment.local.example.ts)).

## Verification

| Command                                | Scope                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `node scripts/verify.mjs`              | Everything: frontend lint/format/test/build + backend build              |
| `pnpm lint` / `pnpm test` / `pnpm e2e` | Frontend, run inside `frontend/`                                         |
| `./gradlew build`                      | Backend, run inside `backend/` (needs Docker — tests use Testcontainers) |

## Roadmap

Siehe Entwicklungsphasen im Obsidian-Plan:

1. **Phase 1** — Gerüst & Datenfluss ohne LLM (IMAP, Parser, Minimal-Dashboard)
2. **Phase 2** — Analyse mit Kostendeckel (Spring AI + Claude Haiku, Batch-Prompt)
3. **Phase 3** — Auswertungen (KPI-Kacheln, 6 Charts)
4. **Phase 4** — Ausbau (Raten-Statistik, Trends, Obsidian-Export, Collect-Automatisierung)
