package de.prime_ux.backend.collect;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.prime_ux.backend.TestcontainersConfiguration;
import de.prime_ux.backend.offer.OfferRepository;
import de.prime_ux.backend.run.RunRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.web.servlet.MockMvc;

// Full slice against PostgreSQL (Testcontainers); only the IMAP edge is stubbed
// so no real mailbox is needed. The stub replaces ImapService via @Primary.
@SpringBootTest(properties = "radar.state-dir=build/test-state")
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, CollectControllerTest.StubMailSource.class })
class CollectControllerTest {

	private static final List<FetchedMail> MAILS = new ArrayList<>();

	@TestConfiguration(proxyBeanMethods = false)
	static class StubMailSource {

		@Bean
		@Primary
		MailSource stubbedMailSource() {
			return since -> List.copyOf(MAILS);
		}
	}

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private OfferRepository offers;

	@Autowired
	private RunRepository runs;

	@BeforeEach
	void reset() {
		MAILS.clear();
		offers.deleteAll();
		runs.deleteAll();
	}

	private static String projectBlock(String title, long fmProjectId) {
		return """
			%s (10266-20260723)
			Erstellt: 23.07.2026 um 08:29 Uhr
			von: softwareXperts GmbH
			Ort: Wien
			Vertragsart: Freiberuflich
			Remote: 100 %%
			Start: 07/2026

			https://www.freelancermap.de/nproj/%d.html?utm_source=systemmail&html=0

			-----------------------------
			""".formatted(title, fmProjectId);
	}

	private static String agentMailBody(String... projectBlocks) {
		return """
			Hallo Thomas Hemmerich,

			unser Projektagent hat neue Aufträge zu Ihrer gespeicherten Suche gefunden:


			""" +
		String.join("\n", projectBlocks) +
		"Sie erhalten diese Vorschläge auf Basis Ihrer aktuellen Projektagent-Einstellungen.\n";
	}

	@Test
	void aRunStoresOneOfferPerProjectAndSkipsAlreadyKnownMessageIds() throws Exception {
		MAILS.add(
			new FetchedMail(
				"<offer-1@freelancermap.de>",
				"FreelancerMap <office@freelancermap.de>",
				"Angular - Anzahl neue Projekte: 2",
				Instant.parse("2026-07-23T06:35:00Z"),
				agentMailBody(
					projectBlock("Angular Developer (m/w/d)", 3026991L),
					projectBlock("Senior Fullstack Developer Java/Angular (m/w/d)", 3026990L)
				)
			)
		);

		mockMvc
			.perform(post("/api/runs"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.newOffers").value(2))
			.andExpect(jsonPath("$.totalSeen").value(1));

		mockMvc
			.perform(get("/api/offers"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].sourceType").value("AGENT"))
			.andExpect(jsonPath("$[0].agentName").value("Angular"))
			.andExpect(jsonPath("$[0].company").value("softwareXperts GmbH"))
			.andExpect(jsonPath("$[0].status").value("NEW"));

		// Second run with the same mail: Message-ID dedup keeps the offer count at 2.
		mockMvc
			.perform(post("/api/runs"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.newOffers").value(0))
			.andExpect(jsonPath("$.totalSeen").value(1));

		mockMvc.perform(get("/api/offers")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(2)));
	}

	@Test
	void marksTheSameProjectFromASecondAgentAsDuplicate() throws Exception {
		MAILS.add(
			new FetchedMail(
				"<offer-1@freelancermap.de>",
				"office@freelancermap.de",
				"Angular - Anzahl neue Projekte: 1",
				Instant.parse("2026-07-23T06:35:00Z"),
				agentMailBody(projectBlock("Senior Angular Entwickler (m/w/d)", 3026991L))
			)
		);
		MAILS.add(
			new FetchedMail(
				"<offer-2@freelancermap.de>",
				"office@freelancermap.de",
				"Java Spring - Anzahl neue Projekte: 1",
				Instant.parse("2026-07-23T07:05:00Z"),
				agentMailBody(projectBlock("Senior Angular Entwickler (m/w/d)", 3026991L))
			)
		);

		mockMvc.perform(post("/api/runs")).andExpect(status().isCreated()).andExpect(jsonPath("$.newOffers").value(2));

		// Newest first: the second agent's copy is not primary; the first carries dupCount 2.
		mockMvc
			.perform(get("/api/offers"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].agentName").value("Java Spring"))
			.andExpect(jsonPath("$[0].primary").value(false))
			.andExpect(jsonPath("$[1].agentName").value("Angular"))
			.andExpect(jsonPath("$[1].primary").value(true))
			.andExpect(jsonPath("$[1].dupCount").value(2));
	}

	@Test
	void latestRunReflectsTheMostRecentTrigger() throws Exception {
		mockMvc.perform(get("/api/runs/latest")).andExpect(status().isNoContent());

		mockMvc.perform(post("/api/runs")).andExpect(status().isCreated());

		mockMvc
			.perform(get("/api/runs/latest"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.newOffers").value(0))
			.andExpect(jsonPath("$.ranAt").isNotEmpty());
	}
}
