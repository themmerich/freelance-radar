package de.prime_ux.backend.analyze;

import java.util.List;

/** Ergebnis eines Batch-Aufrufs inklusive Token-Verbrauch (Kostenprotokoll). */
public record AnalysisResult(List<OfferAssessment> assessments, long inputTokens, long outputTokens) {}
