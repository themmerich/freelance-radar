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

	@Test
	void aRunStoresNewOffersAndSkipsAlreadyKnownMessageIds() throws Exception {
		MAILS.add(
			new FetchedMail(
				"<offer-1@freelancermap.de>",
				"FreelancerMap <office@freelancermap.de>",
				"Neues Projekt passend zu Ihrem Suchprofil \"Angular\"",
				Instant.parse("2026-07-22T09:15:00Z"),
				"Ihr Suchagent Angular hat ein Projekt gefunden.\nEinsatzort: Hamburg\n100% Remote möglich"
			)
		);

		mockMvc
			.perform(post("/api/runs"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.newOffers").value(1))
			.andExpect(jsonPath("$.totalSeen").value(1));

		mockMvc
			.perform(get("/api/offers"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].sourceType").value("AGENT"))
			.andExpect(jsonPath("$[0].agentName").value("Angular"))
			.andExpect(jsonPath("$[0].location").value("Hamburg"))
			.andExpect(jsonPath("$[0].remote").value("REMOTE"))
			.andExpect(jsonPath("$[0].status").value("NEW"));

		// Second run with the same mail: Message-ID dedup keeps the offer count at 1.
		mockMvc
			.perform(post("/api/runs"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.newOffers").value(0))
			.andExpect(jsonPath("$.totalSeen").value(1));

		mockMvc.perform(get("/api/offers")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(1)));
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
