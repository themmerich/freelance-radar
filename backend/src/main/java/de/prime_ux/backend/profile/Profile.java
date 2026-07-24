package de.prime_ux.backend.profile;

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
import org.hibernate.annotations.UpdateTimestamp;

/**
 * Ein Bewerbungs-/Suchprofil, gegen das Angebote bewertet werden. Genau eines
 * ist aktiv (Dashboard-Sicht + künftige Analysen); die strukturierten Listen
 * (Skills je Kategorie, Strong-/Weak-Signale) liegen als JSON-Text.
 */
@Entity
@Table(name = "profiles")
@Getter
@Setter
public class Profile {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, columnDefinition = "text")
	private String name;

	@Column(columnDefinition = "text")
	private String role;

	@Column(columnDefinition = "text")
	private String focus;

	@Column(columnDefinition = "text")
	private String industries;

	@Column(columnDefinition = "text")
	private String region;

	@Column(columnDefinition = "text")
	private String languages;

	@Column(name = "skills_json", nullable = false, columnDefinition = "text")
	private String skillsJson = "{}";

	@Column(name = "strong_signals_json", nullable = false, columnDefinition = "text")
	private String strongSignalsJson = "[]";

	@Column(name = "weak_signals_json", nullable = false, columnDefinition = "text")
	private String weakSignalsJson = "[]";

	@Column(nullable = false)
	private boolean active;

	@CreationTimestamp
	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@UpdateTimestamp
	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;
}
