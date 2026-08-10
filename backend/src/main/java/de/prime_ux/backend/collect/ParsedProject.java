package de.prime_ux.backend.collect;

import de.prime_ux.backend.offer.Remote;

/**
 * Ein Projekt aus einer Mail. Agent-Mails liefern strukturierte Blöcke
 * (Firma, freelancermap-ID, URL); für alle anderen Mails wird ein einzelnes
 * Projekt aus den alten v1-Heuristiken synthetisiert (dann ohne Firma/ID).
 */
public record ParsedProject(
	String title,
	String company,
	String location,
	Remote remote,
	String startDate,
	Long fmProjectId,
	String url
) {}
