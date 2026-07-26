-- Die Cross-Agent-Dedup fragt pro Projekt-Block findFirstByDupGroupAndPrimaryTrue,
-- also `dup_group = ? and is_primary` — bisher ohne Index, damit ein Sequential Scan
-- über alle Angebote je Block. Partieller Index, weil nur primäre Zeilen gesucht werden.
create index idx_offers_dup_group_primary on offers (dup_group) where is_primary;
