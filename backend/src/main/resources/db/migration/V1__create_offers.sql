-- Freelance Radar — Kernschema (an v1 angelehnt, siehe Obsidian-Plan).
-- offers: ein Projektangebot pro Mail; Analyse-Spalten werden erst in
-- Phase 2 (Claude-Analyse) befüllt und bleiben bis dahin null.
create table offers (
    id            bigint generated always as identity primary key,
    message_id    text not null unique,
    received_at   timestamptz not null,
    fetched_at    timestamptz not null default now(),
    from_addr     text,
    subject       text,

    -- Klassifizierung (Heuristik in Phase 1, LLM-verfeinert in Phase 2)
    source_type   text not null default 'OTHER',   -- AGENT | PRIVATE | NEWSLETTER | OTHER
    agent_name    text,                            -- welcher der 5 Suchagenten getriggert hat

    -- Extrahierte Projektdaten
    project_title text,
    role          text,
    location      text,
    remote        text,                            -- REMOTE | HYBRID | ONSITE
    rate          text,
    start_date    text,
    duration      text,

    -- LLM-Analyse (Phase 2)
    match_score   int,
    match_reason  text,
    seniority     text,
    industry      text,

    -- Dedup-Gruppen (Phase 2): dasselbe Projekt über mehrere Agenten
    dup_group     text,
    is_primary    boolean not null default true,
    dup_count     int not null default 1,

    status        text not null default 'NEW',     -- NEW | ANALYZED | ERROR
    raw_body      text
);

create index idx_offers_received on offers (received_at);
create index idx_offers_status on offers (status);
create index idx_offers_source on offers (source_type);
create index idx_offers_match on offers (match_score);

-- Normalisierte Skill-Nachfrage (ein Skill pro Zeile, Flag is_gap)
create table offer_skills (
    offer_id bigint not null references offers (id) on delete cascade,
    skill    text not null,
    is_gap   boolean not null default false,
    primary key (offer_id, skill)
);

create index idx_offer_skills_skill on offer_skills (skill);
create index idx_offer_skills_gap on offer_skills (is_gap);

-- Lauf-Protokoll; Token-/Analyse-Spalten werden ab Phase 2 befüllt.
create table runs (
    id              bigint generated always as identity primary key,
    ran_at          timestamptz not null default now(),
    new_offers      int not null default 0,
    total_seen      int not null default 0,
    analyzed_offers int not null default 0,
    input_tokens    bigint not null default 0,
    output_tokens   bigint not null default 0,
    note            text
);
