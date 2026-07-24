package de.prime_ux.backend.offer;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class OfferAnalysisSkillId implements Serializable {

	@Column(name = "offer_id", nullable = false)
	private Long offerId;

	@Column(name = "profile_id", nullable = false)
	private Long profileId;

	@Column(nullable = false, columnDefinition = "text")
	private String skill;

	protected OfferAnalysisSkillId() {
		// Required by JPA.
	}

	public OfferAnalysisSkillId(Long offerId, Long profileId, String skill) {
		this.offerId = offerId;
		this.profileId = profileId;
		this.skill = skill;
	}

	public Long getOfferId() {
		return offerId;
	}

	public Long getProfileId() {
		return profileId;
	}

	public String getSkill() {
		return skill;
	}

	@Override
	public boolean equals(Object other) {
		if (this == other) {
			return true;
		}
		if (!(other instanceof OfferAnalysisSkillId that)) {
			return false;
		}
		return Objects.equals(offerId, that.offerId) && Objects.equals(profileId, that.profileId) && Objects.equals(skill, that.skill);
	}

	@Override
	public int hashCode() {
		return Objects.hash(offerId, profileId, skill);
	}
}
