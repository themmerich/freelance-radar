-- Phase 4: Profil-Verwaltung. Das bisher statische profile.json wandert in die
-- DB; Analyse-Ergebnisse hängen ab jetzt am Paar (Angebot, Profil), damit die
-- Scores mehrerer Profile nebeneinander vergleichbar bleiben.

create table profiles (
    id                   bigint generated always as identity primary key,
    name                 text not null unique,
    role                 text,
    focus                text,
    industries           text,
    region               text,
    languages            text,
    -- Strukturierte Listen als JSON-Text: Kategorien -> Skills bzw. Signal-Listen.
    skills_json          text not null default '{}',
    strong_signals_json  text not null default '[]',
    weak_signals_json    text not null default '[]',
    active               boolean not null default false,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

-- Genau ein aktives Profil (bestimmt Dashboard-Sicht und künftige Analysen).
create unique index uq_profiles_active on profiles (active) where active;

-- Analyse-Ergebnis pro (Angebot, Profil) — ersetzt match_score/-reason am Angebot.
create table offer_analyses (
    offer_id     bigint not null references offers (id) on delete cascade,
    profile_id   bigint not null references profiles (id) on delete cascade,
    match_score  int,
    match_reason text,
    analyzed_at  timestamptz not null default now(),
    primary key (offer_id, profile_id)
);

create index idx_offer_analyses_profile on offer_analyses (profile_id);

-- Skills inkl. Gap-Flag pro Analyse (Gaps sind profilabhängig).
create table offer_analysis_skills (
    offer_id   bigint not null,
    profile_id bigint not null,
    skill      text not null,
    is_gap     boolean not null default false,
    primary key (offer_id, profile_id, skill),
    foreign key (offer_id, profile_id) references offer_analyses (offer_id, profile_id) on delete cascade
);

create index idx_analysis_skills_profile on offer_analysis_skills (profile_id, skill);

-- Standard-Profil aus dem bisherigen profile.json (aktiv).
insert into profiles (name, role, focus, industries, region, languages, skills_json, strong_signals_json, weak_signals_json, active)
values (
    'Standard',
    'Frontend Architect / Angular Lead / Coach',
    'Agentic UI / AI Engineering, Design Systems & Frontend-Architektur, Angular Modernization, Lead & Coaching',
    'Banking, Insurance, Public Sector, Industry',
    'DACH, remote',
    'Deutsch (native), Englisch (fließend)',
    '{"ai_agentic":["Agentic UI Patterns","A2UI","AI-Driven Development","LLM-Integration","Spring AI","Claude Code","Agent Skills & Guard Rails","Agent Evals","MCP (Model Context Protocol)","Design Systems mit AI","Prompt Engineering"],"frontend":["Angular (2-22)","TypeScript","Signals","SignalStore","NgRx","RxJS","Nx","Micro-Frontends","Tailwind CSS","PrimeNG","Angular Material","Barrierefreiheit (A11y)","OpenAPI","zoneless","Sheriff","Web Components"],"backend":["Java","Spring Boot","JPA","Hibernate","QueryDSL","REST","OAuth2","Kafka","RabbitMQ","PostgreSQL","Oracle","Flyway","Liquibase","Spring Batch","Keycloak","JavaEE"],"devops_testing":["Docker","Kubernetes","Jenkins","GitHub Actions","Playwright","Cypress","Jest","JUnit","Cucumber","SonarQube","AWS","Terraform"],"methods":["Domain-Driven Design","Clean Code","TDD","BDD","Microservices","Scrum","Agile","Teamführung","Coaching"]}',
    '["Angular","Frontend Architect","Lead","Design System","Micro-Frontend","Nx","Signals","Spring Boot","Java","Agentic","AI","LLM","MCP","Coaching","Modernisierung","Enterprise","remote"]',
    '["React","Vue","PHP","Python (als Hauptsprache)",".NET","C#","Mobile (iOS/Android nativ)","Data Engineering","Pflicht Vor-Ort 5 Tage","Junior","Pure Backend ohne Frontend"]',
    true
);

-- Vorhandene Ergebnisse dem Standard-Profil zuschreiben (Migration ohne neue Kosten).
insert into offer_analyses (offer_id, profile_id, match_score, match_reason)
select o.id, p.id, o.match_score, o.match_reason
from offers o, profiles p
where p.name = 'Standard' and o.match_score is not null;

insert into offer_analysis_skills (offer_id, profile_id, skill, is_gap)
select s.offer_id, p.id, s.skill, s.is_gap
from offer_skills s
join offers o on o.id = s.offer_id, profiles p
where p.name = 'Standard' and o.match_score is not null;

-- Alte Spalten/Tabelle sind damit abgelöst.
alter table offers drop column match_score;
alter table offers drop column match_reason;
drop table offer_skills;
