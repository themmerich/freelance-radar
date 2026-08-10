-- Das Geld-Badge der Projektseite heißt immer „Budget" und trägt keine Einheit. Gemessen
-- an den ersten 149 abgerufenen Seiten steckt darin dreierlei: Stundensätze (62–90 €),
-- Tagessätze (600–649 €) und einmal ein Gesamtbudget (750.000 €). Eine Spalte namens
-- `rate_hourly_eur` behauptet für einen Teil der Zeilen also etwas Falsches.
--
-- Deshalb: der Rohwert bleibt als `budget_eur` stehen, und `budget_kind` sagt, wie er zu
-- lesen ist. Was welche Einordnung bekommt, entscheidet die Größenordnung — die Seite
-- selbst gibt nichts her.
alter table offers rename column rate_hourly_eur to budget_eur;

-- 750.000,00 passt nicht in numeric(8,2).
alter table offers
    alter column budget_eur type numeric(12, 2);

alter table offers
    add column budget_kind text;

-- Bestehende Zeilen nach derselben Regel einordnen, die der Parser ab jetzt anwendet.
-- 0,00 € ist ein leer gelassenes Feld, kein Stundensatz von null.
update offers set budget_eur = null where budget_eur is not null and budget_eur <= 0;

update offers
set budget_kind = case
    when budget_eur <= 250 then 'HOURLY'
    when budget_eur <= 2000 then 'DAILY'
    else 'TOTAL'
end
where budget_eur is not null;
