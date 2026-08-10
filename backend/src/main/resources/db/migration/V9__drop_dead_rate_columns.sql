-- Die beiden Textspalten stammen aus dem Mail-Parser und waren über 431 Angebote hinweg
-- ausnahmslos leer: die Agenten-Mails sind Teaser und nennen weder Satz noch Laufzeit.
-- Beides kommt jetzt strukturiert von der Projektseite (`budget_eur`, `duration_months`).
alter table offers
    drop column rate,
    drop column duration;
