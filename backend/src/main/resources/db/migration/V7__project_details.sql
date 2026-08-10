-- Stundensatz und Laufzeit stehen nicht in den Agenten-Mails: die sind Teaser mit
-- Titel, Firma, Ort, Vertragsart, Remote-Anteil und Start (gemessen an 428 Angeboten
-- nennt keine einzige eine Laufzeit, zwei einen Stundensatz). Beides steht auf der
-- verlinkten Projektseite, die öffentlich erreichbar ist — diese Spalten nehmen auf,
-- was von dort geholt wird.
alter table offers
    add column rate_hourly_eur numeric(8, 2),
    add column duration_months integer,
    add column utilization_percent integer,
    add column remote_percent integer,
    add column contract_type text,
    add column start_month date,
    add column start_immediate boolean not null default false,
    add column description text,
    add column detail_status text not null default 'PENDING',
    add column detail_fetched_at timestamptz;

-- Der Nachlauf im Collect-Lauf arbeitet die Warteschlange über diesen Index ab:
-- `detail_status in ('PENDING','ERROR')`, älteste zuerst.
create index idx_offers_detail_status on offers (detail_status, received_at);

-- Abdeckung je Lauf nachvollziehbar machen — wie viele Detailseiten kamen an,
-- wie viele scheiterten.
alter table runs
    add column details_fetched integer not null default 0,
    add column details_failed integer not null default 0;
