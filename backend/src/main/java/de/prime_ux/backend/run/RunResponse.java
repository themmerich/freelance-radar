package de.prime_ux.backend.run;

import java.time.Instant;

public record RunResponse(
	Long id,
	Instant ranAt,
	int newOffers,
	int totalSeen,
	int analyzedOffers,
	/** Abgerufene Projekt-Detailseiten — ein Lauf ohne neue Mails arbeitet oft nur diese Warteschlange ab. */
	int detailsFetched,
	int detailsFailed,
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
			run.getDetailsFetched(),
			run.getDetailsFailed(),
			run.getInputTokens(),
			run.getOutputTokens(),
			run.getNote()
		);
	}
}
