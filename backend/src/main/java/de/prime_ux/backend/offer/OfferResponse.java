package de.prime_ux.backend.offer;

import java.time.Instant;
import java.util.List;

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
	String country,
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
	OfferStatus status,
	List<SkillResponse> skills
) {
	public record SkillResponse(String name, boolean gap) {}

	static OfferResponse from(Offer offer, List<OfferSkill> offerSkills) {
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
			offer.getCountry(),
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
			offer.getStatus(),
			offerSkills.stream().map(skill -> new SkillResponse(skill.getId().getSkill(), skill.isGap())).toList()
		);
	}
}
