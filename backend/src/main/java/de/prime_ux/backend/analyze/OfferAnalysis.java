package de.prime_ux.backend.analyze;

import java.util.List;

/** Bewertung eines einzelnen Angebots durch das LLM. */
public record OfferAnalysis(
	Long offerId,
	Integer matchScore,
	String matchReason,
	String seniority,
	String industry,
	String role,
	String country,
	List<AnalyzedSkill> skills
) {}
