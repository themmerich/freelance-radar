package de.prime_ux.backend.offer;

/** Verarbeitungsstatus: NEW wartet auf die Claude-Analyse (Phase 2). */
public enum OfferStatus {
	NEW,
	ANALYZED,
	ERROR,
}
