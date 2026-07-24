package de.prime_ux.backend.offer;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** Gefordertes Skill aus einer Analyse; {@code gap} ist profilabhängig. */
@Entity
@Table(name = "offer_analysis_skills")
@Getter
@Setter
public class OfferAnalysisSkill {

	@EmbeddedId
	private OfferAnalysisSkillId id;

	@Column(name = "is_gap", nullable = false)
	private boolean gap;

	protected OfferAnalysisSkill() {
		// Required by JPA.
	}

	public OfferAnalysisSkill(Long offerId, Long profileId, String skill, boolean gap) {
		this.id = new OfferAnalysisSkillId(offerId, profileId, skill);
		this.gap = gap;
	}
}
