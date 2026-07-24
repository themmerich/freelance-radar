-- Land des Einsatzorts (ISO 3166-1 alpha-2, z.B. DE/AT/CH), von der
-- Claude-Analyse aus Ort/Text abgeleitet — die Mails haben kein eigenes Feld.
alter table offers
    add column country text;
