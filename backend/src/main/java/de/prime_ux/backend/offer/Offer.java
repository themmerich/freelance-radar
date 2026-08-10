package de.prime_ux.backend.offer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "offers")
@Getter
@Setter
public class Offer {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "message_id", nullable = false, columnDefinition = "text")
	private String messageId;

	@Column(name = "project_index", nullable = false)
	private int projectIndex;

	@Column(name = "received_at", nullable = false)
	private Instant receivedAt;

	@CreationTimestamp
	@Column(name = "fetched_at", nullable = false, updatable = false)
	private Instant fetchedAt;

	@Column(name = "from_addr", columnDefinition = "text")
	private String fromAddr;

	@Column(columnDefinition = "text")
	private String subject;

	@Enumerated(EnumType.STRING)
	@Column(name = "source_type", nullable = false, columnDefinition = "text")
	private SourceType sourceType = SourceType.OTHER;

	@Column(name = "agent_name", columnDefinition = "text")
	private String agentName;

	@Column(name = "project_title", columnDefinition = "text")
	private String projectTitle;

	@Column(columnDefinition = "text")
	private String company;

	@Column(name = "fm_project_id")
	private Long fmProjectId;

	@Column(name = "project_url", columnDefinition = "text")
	private String projectUrl;

	@Column(columnDefinition = "text")
	private String role;

	@Column(columnDefinition = "text")
	private String location;

	@Column(columnDefinition = "text")
	private String country;

	@Enumerated(EnumType.STRING)
	@Column(columnDefinition = "text")
	private Remote remote;

	@Column(name = "start_date", columnDefinition = "text")
	private String startDate;

	@Column(columnDefinition = "text")
	private String seniority;

	@Column(columnDefinition = "text")
	private String industry;

	@Column(name = "dup_group", columnDefinition = "text")
	private String dupGroup;

	@Column(name = "is_primary", nullable = false)
	private boolean primary = true;

	@Column(name = "dup_count", nullable = false)
	private int dupCount = 1;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, columnDefinition = "text")
	private OfferStatus status = OfferStatus.NEW;

	@Column(name = "raw_body", columnDefinition = "text")
	private String rawBody;

	// --- Von der Projekt-Detailseite (die Mail selbst führt diese Felder nicht) ---

	/** Rohwert des Budget-Badges — je nach {@link #budgetKind} Stunden-, Tagessatz oder Gesamtsumme. */
	@Column(name = "budget_eur", precision = 12, scale = 2)
	private BigDecimal budgetEur;

	@Enumerated(EnumType.STRING)
	@Column(name = "budget_kind", columnDefinition = "text")
	private BudgetKind budgetKind;

	@Column(name = "duration_months")
	private Integer durationMonths;

	@Column(name = "utilization_percent")
	private Integer utilizationPercent;

	@Column(name = "remote_percent")
	private Integer remotePercent;

	@Column(name = "contract_type", columnDefinition = "text")
	private String contractType;

	/** Erster Tag des genannten Startmonats; null bei „ab sofort" oder fehlender Angabe. */
	@Column(name = "start_month")
	private LocalDate startMonth;

	@Column(name = "start_immediate", nullable = false)
	private boolean startImmediate = false;

	/** Projektbeschreibung — Grundlage der Claude-Analyse, sobald sie vorliegt. */
	@Column(columnDefinition = "text")
	private String description;

	@Enumerated(EnumType.STRING)
	@Column(name = "detail_status", nullable = false, columnDefinition = "text")
	private DetailStatus detailStatus = DetailStatus.PENDING;

	@Column(name = "detail_fetched_at")
	private Instant detailFetchedAt;

	protected Offer() {
		// Required by JPA.
	}

	public Offer(String messageId, Instant receivedAt, String fromAddr, String subject) {
		this.messageId = messageId;
		this.receivedAt = receivedAt;
		this.fromAddr = fromAddr;
		this.subject = subject;
	}
}
