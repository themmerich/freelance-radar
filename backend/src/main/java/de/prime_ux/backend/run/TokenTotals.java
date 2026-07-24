package de.prime_ux.backend.run;

/** Summen über alle Läufe — Basis für die Kostenvorschau (Ø Tokens je Angebot). */
public record TokenTotals(long inputTokens, long outputTokens, long analyzedOffers) {}
