package de.prime_ux.backend.collect;

import de.prime_ux.backend.offer.Remote;
import de.prime_ux.backend.offer.SourceType;

/** Ergebnis der regelbasierten Extraktion; das LLM verfeinert ab Phase 2. */
public record ParsedOffer(
	SourceType sourceType,
	String agentName,
	String projectTitle,
	String location,
	Remote remote,
	String rate,
	String startDate,
	String duration
) {}
