package de.prime_ux.backend.run;

import java.time.Instant;

public record RunResponse(
	Long id,
	Instant ranAt,
	int newOffers,
	int totalSeen,
	int analyzedOffers,
	long inputTokens,
	long outputTokens,
	String note
) {
	public static RunResponse from(Run run) {
		return new RunResponse(
			run.getId(),
			run.getRanAt(),
			run.getNewOffers(),
			run.getTotalSeen(),
			run.getAnalyzedOffers(),
			run.getInputTokens(),
			run.getOutputTokens(),
			run.getNote()
		);
	}
}
