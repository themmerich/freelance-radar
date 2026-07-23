package de.prime_ux.backend.offer;

import java.time.Instant;

public record OfferResponse(
	Long id,
	Instant receivedAt,
	String fromAddr,
	String subject,
	SourceType sourceType,
	String agentName,
	String projectTitle,
	String company,
	String role,
	String location,
	Remote remote,
	String rate,
	String startDate,
	String duration,
	String projectUrl,
	Integer matchScore,
	String matchReason,
	String seniority,
	String industry,
	boolean primary,
	int dupCount,
	OfferStatus status
) {
	static OfferResponse from(Offer offer) {
		return new OfferResponse(
			offer.getId(),
			offer.getReceivedAt(),
			offer.getFromAddr(),
			offer.getSubject(),
			offer.getSourceType(),
			offer.getAgentName(),
			offer.getProjectTitle(),
			offer.getCompany(),
			offer.getRole(),
			offer.getLocation(),
			offer.getRemote(),
			offer.getRate(),
			offer.getStartDate(),
			offer.getDuration(),
			offer.getProjectUrl(),
			offer.getMatchScore(),
			offer.getMatchReason(),
			offer.getSeniority(),
			offer.getIndustry(),
			offer.isPrimary(),
			offer.getDupCount(),
			offer.getStatus()
		);
	}
}
