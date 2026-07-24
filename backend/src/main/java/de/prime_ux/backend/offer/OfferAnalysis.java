package de.prime_ux.backend.offer;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Analyse-Ergebnis eines Angebots gegen genau ein Profil — Scores verschiedener Profile koexistieren. */
@Entity
@Table(name = "offer_analyses")
@Getter
@Setter
public class OfferAnalysis {

	@EmbeddedId
	private OfferAnalysisId id;

	@Column(name = "match_score")
	private Integer matchScore;

	@Column(name = "match_reason", columnDefinition = "text")
	private String matchReason;

	@CreationTimestamp
	@Column(name = "analyzed_at", nullable = false, updatable = false)
	private Instant analyzedAt;

	protected OfferAnalysis() {
		// Required by JPA.
	}

	public OfferAnalysis(Long offerId, Long profileId, Integer matchScore, String matchReason) {
		this.id = new OfferAnalysisId(offerId, profileId);
		this.matchScore = matchScore;
		this.matchReason = matchReason;
	}
}
