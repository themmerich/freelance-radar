package de.prime_ux.backend.offer;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class OfferAnalysisId implements Serializable {

	@Column(name = "offer_id", nullable = false)
	private Long offerId;

	@Column(name = "profile_id", nullable = false)
	private Long profileId;

	protected OfferAnalysisId() {
		// Required by JPA.
	}

	public OfferAnalysisId(Long offerId, Long profileId) {
		this.offerId = offerId;
		this.profileId = profileId;
	}

	public Long getOfferId() {
		return offerId;
	}

	public Long getProfileId() {
		return profileId;
	}

	@Override
	public boolean equals(Object other) {
		if (this == other) {
			return true;
		}
		if (!(other instanceof OfferAnalysisId that)) {
			return false;
		}
		return Objects.equals(offerId, that.offerId) && Objects.equals(profileId, that.profileId);
	}

	@Override
	public int hashCode() {
		return Objects.hash(offerId, profileId);
	}
}
