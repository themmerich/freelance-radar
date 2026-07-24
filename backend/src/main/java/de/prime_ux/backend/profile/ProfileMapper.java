package de.prime_ux.backend.profile;

import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/** Übersetzt zwischen den strukturierten DTO-Listen und den JSON-Textspalten der Entity. */
@Component
public class ProfileMapper {

	private static final TypeReference<Map<String, List<String>>> SKILLS_TYPE = new TypeReference<>() {};
	private static final TypeReference<List<String>> LIST_TYPE = new TypeReference<>() {};

	private final ObjectMapper objectMapper;

	public ProfileMapper(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	public ProfileResponse toResponse(Profile profile) {
		return new ProfileResponse(
			profile.getId(),
			profile.getName(),
			profile.getRole(),
			profile.getFocus(),
			profile.getIndustries(),
			profile.getRegion(),
			profile.getLanguages(),
			objectMapper.readValue(profile.getSkillsJson(), SKILLS_TYPE),
			objectMapper.readValue(profile.getStrongSignalsJson(), LIST_TYPE),
			objectMapper.readValue(profile.getWeakSignalsJson(), LIST_TYPE),
			profile.isActive()
		);
	}

	public void apply(ProfileRequest request, Profile profile) {
		profile.setName(request.name());
		profile.setRole(request.role());
		profile.setFocus(request.focus());
		profile.setIndustries(request.industries());
		profile.setRegion(request.region());
		profile.setLanguages(request.languages());
		profile.setSkillsJson(objectMapper.writeValueAsString(request.skills() == null ? Map.of() : request.skills()));
		profile.setStrongSignalsJson(objectMapper.writeValueAsString(request.strongSignals() == null ? List.of() : request.strongSignals()));
		profile.setWeakSignalsJson(objectMapper.writeValueAsString(request.weakSignals() == null ? List.of() : request.weakSignals()));
	}
}
