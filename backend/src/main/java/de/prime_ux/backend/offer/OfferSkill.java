package de.prime_ux.backend.offer;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/** Ein nachgefragter Skill eines Angebots; {@code gap} markiert Lücken im Profil (Phase 2). */
@Entity
@Table(name = "offer_skills")
@Getter
@Setter
public class OfferSkill {

	@EmbeddedId
	private OfferSkillId id;

	@Column(name = "is_gap", nullable = false)
	private boolean gap;

	protected OfferSkill() {
		// Required by JPA.
	}

	public OfferSkill(Long offerId, String skill, boolean gap) {
		this.id = new OfferSkillId(offerId, skill);
		this.gap = gap;
	}
}
