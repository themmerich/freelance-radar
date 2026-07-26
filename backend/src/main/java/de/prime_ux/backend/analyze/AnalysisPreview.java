package de.prime_ux.backend.analyze;

/** Kostenvorschau einer Re-Analyse: wie viele Angebote und welcher Token-Verbrauch zu erwarten ist. */
public record AnalysisPreview(int candidates, long estimatedInputTokens, long estimatedOutputTokens) {}
