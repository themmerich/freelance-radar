package de.prime_ux.backend.run;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Protokoll eines Abruf-Laufs; Token-/Analyse-Felder werden ab Phase 2 befüllt. */
@Entity
@Table(name = "runs")
@Getter
@Setter
public class Run {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@CreationTimestamp
	@Column(name = "ran_at", nullable = false, updatable = false)
	private Instant ranAt;

	@Column(name = "new_offers", nullable = false)
	private int newOffers;

	@Column(name = "total_seen", nullable = false)
	private int totalSeen;

	@Column(name = "analyzed_offers", nullable = false)
	private int analyzedOffers;

	@Column(name = "input_tokens", nullable = false)
	private long inputTokens;

	@Column(name = "output_tokens", nullable = false)
	private long outputTokens;

	@Column(name = "details_fetched", nullable = false)
	private int detailsFetched;

	@Column(name = "details_failed", nullable = false)
	private int detailsFailed;

	@Column(columnDefinition = "text")
	private String note;

	protected Run() {
		// Required by JPA.
	}

	public Run(int newOffers, int totalSeen, String note) {
		this.newOffers = newOffers;
		this.totalSeen = totalSeen;
		this.note = note;
	}
}
