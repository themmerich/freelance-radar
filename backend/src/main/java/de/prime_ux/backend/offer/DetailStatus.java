package de.prime_ux.backend.offer;

/**
 * Stand des Abrufs der Projekt-Detailseite. PENDING und ERROR kommen im nächsten
 * Collect-Lauf erneut dran, NOT_FOUND und OK sind endgültig.
 */
public enum DetailStatus {
	PENDING,
	OK,
	NOT_FOUND,
	ERROR,
}
