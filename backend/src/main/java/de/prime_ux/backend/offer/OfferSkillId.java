package de.prime_ux.backend.offer;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class OfferSkillId implements Serializable {

	@Column(name = "offer_id", nullable = false)
	private Long offerId;

	@Column(nullable = false, columnDefinition = "text")
	private String skill;

	protected OfferSkillId() {
		// Required by JPA.
	}

	public OfferSkillId(Long offerId, String skill) {
		this.offerId = offerId;
		this.skill = skill;
	}

	public Long getOfferId() {
		return offerId;
	}

	public String getSkill() {
		return skill;
	}

	@Override
	public boolean equals(Object other) {
		if (this == other) {
			return true;
		}
		if (!(other instanceof OfferSkillId that)) {
			return false;
		}
		return Objects.equals(offerId, that.offerId) && Objects.equals(skill, that.skill);
	}

	@Override
	public int hashCode() {
		return Objects.hash(offerId, skill);
	}
}
