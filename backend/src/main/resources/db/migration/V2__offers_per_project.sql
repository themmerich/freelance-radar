-- Echte Agent-Mails enthalten 1..n Projekt-Blöcke: ein Offer pro Projekt.
-- message_id ist damit nicht mehr eindeutig; eindeutig ist (message_id, project_index).
alter table offers drop constraint offers_message_id_key;

alter table offers
    add column project_index int    not null default 0,  -- Position des Projekts in der Mail
    add column company       text,                       -- "von:" im Projekt-Block
    add column fm_project_id bigint,                     -- stabile freelancermap-ID aus der /nproj/-URL
    add column project_url   text;

create unique index uq_offers_message_project on offers (message_id, project_index);
create index idx_offers_fm_project on offers (fm_project_id);
