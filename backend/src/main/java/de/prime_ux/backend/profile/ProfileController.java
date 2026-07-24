package de.prime_ux.backend.profile;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profiles")
public class ProfileController {

	private final ProfileRepository profiles;
	private final ProfileMapper mapper;

	public ProfileController(ProfileRepository profiles, ProfileMapper mapper) {
		this.profiles = profiles;
		this.mapper = mapper;
	}

	@GetMapping
	public List<ProfileResponse> findAll() {
		return profiles.findAllByOrderByNameAsc().stream().map(mapper::toResponse).toList();
	}

	@PostMapping
	public ResponseEntity<ProfileResponse> create(@Valid @RequestBody ProfileRequest request) {
		Profile profile = new Profile();
		mapper.apply(request, profile);
		Profile saved = profiles.save(profile);
		return ResponseEntity.created(URI.create("/api/profiles/" + saved.getId())).body(mapper.toResponse(saved));
	}

	@PutMapping("/{id}")
	@Transactional
	public ProfileResponse update(@PathVariable Long id, @Valid @RequestBody ProfileRequest request) {
		Profile profile = profiles.findById(id).orElseThrow(() -> new ProfileNotFoundException(id));
		mapper.apply(request, profile);
		return mapper.toResponse(profile);
	}

	/** Aktiviert das Profil; das bisher aktive wird deaktiviert (genau eines ist aktiv). */
	@PostMapping("/{id}/activate")
	@Transactional
	public ProfileResponse activate(@PathVariable Long id) {
		Profile profile = profiles.findById(id).orElseThrow(() -> new ProfileNotFoundException(id));
		profiles.findByActiveTrue().ifPresent(active -> active.setActive(false));
		// Deaktivierung vor der Aktivierung in die DB schreiben, sonst kollidiert
		// der partielle Unique-Index uq_profiles_active bei Hibernates Flush-Reihenfolge.
		profiles.flush();
		profile.setActive(true);
		return mapper.toResponse(profile);
	}

	/** Analyse-Ergebnisse des Profils fallen per ON DELETE CASCADE mit weg. */
	@DeleteMapping("/{id}")
	public ResponseEntity<Object> delete(@PathVariable Long id) {
		Profile profile = profiles.findById(id).orElseThrow(() -> new ProfileNotFoundException(id));
		if (profile.isActive()) {
			return ResponseEntity
				.unprocessableEntity()
				.body(ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, "Das aktive Profil kann nicht gelöscht werden."));
		}
		profiles.delete(profile);
		return ResponseEntity.noContent().build();
	}

	@ExceptionHandler(ProfileNotFoundException.class)
	public ProblemDetail handleNotFound(ProfileNotFoundException e) {
		return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
	}
}
