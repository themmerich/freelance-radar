# AGENTS.md — backend

Guidance for the Spring Boot backend. See the repository root `AGENTS.md` for
monorepo-wide conventions (git/PR workflow, secrets, layout).

## Stack

- **Spring Boot 4.1**, **Java 25**, **Gradle** (Kotlin DSL, `build.gradle.kts`)
- Spring Data JPA, **Flyway** (PostgreSQL), Bean Validation, Spring Web MVC
- **jakarta.mail** (via `spring-boot-starter-mail`) für den IMAP-Abruf (GMX)
- **Spring AI 2.0** (`spring-ai-starter-model-anthropic`) für die Claude-Analyse
  (`claude-haiku-4-5`, ein Batch-Request pro Lauf, Kostendeckel via
  `radar.analysis.max-offers-per-run`; Profil-Baseline in `src/main/resources/profile.json`)
- **Lombok** (compile-time), Spring Boot DevTools, Spring Boot Docker Compose
- Base package: `de.prime_ux.backend`

## Commands (run inside `backend/`)

| Command             | Purpose                                                       |
| ------------------- | ------------------------------------------------------------- |
| `./gradlew bootRun` | Run the app (starts PostgreSQL via `compose.yaml` in dev)     |
| `./gradlew build`   | Compile + run tests (needs Docker — see Testcontainers below) |
| `./gradlew test`    | Run tests only (needs Docker)                                 |

Use the Gradle wrapper (`./gradlew`); do not rely on a globally installed Gradle.

## Conventions

- **Database schema is owned by Flyway.** Add versioned migrations under
  `src/main/resources/db/migration` (`V<n>__<description>.sql`); never rely on
  Hibernate `ddl-auto` to mutate the schema.
- Prefer **constructor injection** for Spring beans (no field injection).
- Use Bean Validation (`jakarta.validation`) annotations on request DTOs and
  validate at the controller boundary.
- Lombok is available; keep entities and DTOs lean and avoid `@Data` on JPA
  entities (prefer explicit `@Getter`/`@Setter` to avoid equals/hashCode pitfalls).
- Local development expects a PostgreSQL instance; `compose.yaml` provides one and
  Spring Boot Docker Compose wires it up automatically on `bootRun`.
- **Tests never use a locally running database.** Integration tests import
  `TestcontainersConfiguration` (in `src/test/java`), which provisions a PostgreSQL
  container via Testcontainers and `@ServiceConnection` — only Docker is required.
- **Tests never touch a real mailbox.** `CollectService` depends on the `MailSource`
  interface; tests stub it (`@Primary`-Bean) statt `ImapService`.
- **Tests never call the Claude API.** `AnalysisService` depends on the `OfferAnalyzer`
  interface; tests stub it statt `ClaudeOfferAnalyzer` und setzen einen Dummy-Key
  (`spring.ai.anthropic.api-key=test-key`), damit die Autokonfiguration startet.
- **GMX-Zugangsdaten und Anthropic-API-Key** liegen nur in der git-ignorierten
  `application-local.properties` (Vorlage: `application-local.example.properties`) —
  niemals committen.
