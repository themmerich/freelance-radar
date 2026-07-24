package de.prime_ux.backend.profile;

import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;

public record ProfileRequest(
	@NotBlank String name,
	String role,
	String focus,
	String industries,
	String region,
	String languages,
	Map<String, List<String>> skills,
	List<String> strongSignals,
	List<String> weakSignals
) {}
