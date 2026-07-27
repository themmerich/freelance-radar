package de.prime_ux.backend.profile;

import static org.hamcrest.Matchers.contains;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.prime_ux.backend.TestcontainersConfiguration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(properties = { "radar.state-dir=build/test-state", "spring.ai.anthropic.api-key=test-key" })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ProfileControllerTest {

	private static final String DEFAULT_PROFILE = "Frontend Architect & Angular Lead";
	private static final String ANGULAR_PROFILE = "Senior Angular Frontend";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private ProfileRepository profiles;

	/**
	 * Der Kontext (und damit die DB) wird zwischen Testklassen geteilt: beide geseedeten Profile
	 * bleiben erhalten, Reste weg. Erst Fremde löschen/das zweite Profil deaktivieren, dann das
	 * Standard-Profil aktivieren — sonst kollidiert der partielle Unique-Index bei zwei aktiven Zeilen.
	 */
	@AfterEach
	void restoreSeededState() {
		for (Profile profile : profiles.findAll()) {
			if (DEFAULT_PROFILE.equals(profile.getName())) {
				continue;
			}
			if (ANGULAR_PROFILE.equals(profile.getName())) {
				if (profile.isActive()) {
					profile.setActive(false);
					profiles.save(profile);
				}
			} else {
				profiles.delete(profile);
			}
		}
		Profile standard = profiles.findAll().stream().filter(p -> DEFAULT_PROFILE.equals(p.getName())).findFirst().orElseThrow();
		if (!standard.isActive()) {
			standard.setActive(true);
			profiles.save(standard);
		}
	}

	@Test
	void listsTheSeededProfilesWithTheDefaultActive() throws Exception {
		mockMvc
			.perform(get("/api/profiles"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].name").value(DEFAULT_PROFILE))
			.andExpect(jsonPath("$[0].active").value(true))
			.andExpect(jsonPath("$[0].skills.frontend[0]").value("Angular (2-22)"))
			.andExpect(jsonPath("$[0].strongSignals[0]").value("Angular"))
			.andExpect(jsonPath("$[1].name").value(ANGULAR_PROFILE))
			.andExpect(jsonPath("$[1].active").value(false));
	}

	@Test
	void supportsCreateUpdateActivateAndDelete() throws Exception {
		String created = mockMvc
			.perform(
				post("/api/profiles")
					.contentType(MediaType.APPLICATION_JSON)
					.content(
						objectMapper.writeValueAsString(
							Map.of(
								"name",
								"Agentic UI",
								"role",
								"AI Engineer",
								"skills",
								Map.of("ai_agentic", List.of("Agentic UI Patterns", "LLM-Integration")),
								"strongSignals",
								List.of("Agentic", "AI")
							)
						)
					)
			)
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.name").value("Agentic UI"))
			.andExpect(jsonPath("$.active").value(false))
			.andReturn()
			.getResponse()
			.getContentAsString();
		long id = objectMapper.readTree(created).get("id").asLong();

		mockMvc
			.perform(
				put("/api/profiles/{id}", id)
					.contentType(MediaType.APPLICATION_JSON)
					.content(
						objectMapper.writeValueAsString(
							Map.of("name", "Agentic UI", "role", "AI Engineer", "skills", Map.of("ai_agentic", List.of("Spring AI")))
						)
					)
			)
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.skills.ai_agentic[0]").value("Spring AI"));

		mockMvc
			.perform(post("/api/profiles/{id}/activate", id))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(true));

		// Genau eines ist aktiv: der Default wurde dabei deaktiviert.
		mockMvc
			.perform(get("/api/profiles"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[?(@.name=='" + DEFAULT_PROFILE + "')].active", contains(false)));

		// Das aktive Profil ist nicht löschbar; nach Rückwechsel schon.
		mockMvc.perform(delete("/api/profiles/{id}", id)).andExpect(status().isUnprocessableEntity());

		long standardId = profiles
			.findAllByOrderByNameAsc()
			.stream()
			.filter(p -> p.getName().equals(DEFAULT_PROFILE))
			.findFirst()
			.orElseThrow()
			.getId();
		mockMvc.perform(post("/api/profiles/{id}/activate", standardId)).andExpect(status().isOk());
		mockMvc.perform(delete("/api/profiles/{id}", id)).andExpect(status().isNoContent());
	}

	@Test
	void returns404ForAnUnknownProfile() throws Exception {
		mockMvc.perform(post("/api/profiles/{id}/activate", 99999)).andExpect(status().isNotFound());
	}
}
