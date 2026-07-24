package de.prime_ux.backend.profile;

import java.util.List;
import java.util.Map;

public record ProfileResponse(
	Long id,
	String name,
	String role,
	String focus,
	String industries,
	String region,
	String languages,
	Map<String, List<String>> skills,
	List<String> strongSignals,
	List<String> weakSignals,
	boolean active
) {}
