package de.prime_ux.backend.offer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
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

	@Column(columnDefinition = "text")
	private String rate;

	@Column(name = "start_date", columnDefinition = "text")
	private String startDate;

	@Column(columnDefinition = "text")
	private String duration;

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
