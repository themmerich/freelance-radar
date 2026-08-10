package de.prime_ux.backend.collect;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import de.prime_ux.backend.TestcontainersConfiguration;
import de.prime_ux.backend.analyze.AnalysisResult;
import de.prime_ux.backend.analyze.AnalyzedSkill;
import de.prime_ux.backend.analyze.OfferAnalyzer;
import de.prime_ux.backend.analyze.OfferAssessment;
import de.prime_ux.backend.offer.BudgetKind;
import de.prime_ux.backend.offer.DetailStatus;
import de.prime_ux.backend.offer.Offer;
import de.prime_ux.backend.offer.OfferRepository;
import de.prime_ux.backend.run.RunRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

// Full slice against PostgreSQL (Testcontainers); the IMAP, Claude and project-page edges
// are stubbed so neither a real mailbox noch ein API-Key noch freelancermap gebraucht wird.
// @Primary replaces ImapService/ClaudeOfferAnalyzer/HttpPageSource.
@SpringBootTest(
	properties = { "radar.state-dir=build/test-state", "spring.ai.anthropic.api-key=test-key", "radar.detail.delay-ms=0" }
)
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, CollectControllerTest.StubEdges.class })
class CollectControllerTest {

	private static final List<FetchedMail> MAILS = new ArrayList<>();
	/** Lässt den gestubbten Seitenabruf für einen Test scheitern. */
	private static final AtomicBoolean PAGE_FAILS = new AtomicBoolean(false);

	@TestConfiguration(proxyBeanMethods = false)
	static class StubEdges {

		@Bean
		@Primary
		MailSource stubbedMailSource() {
			return since -> List.copyOf(MAILS);
		}

		/**
		 * Liefert für jedes Projekt dieselbe Faktenzeile — der Lauf darf freelancermap
		 * niemals wirklich aufrufen.
		 */
		@Bean
		@Primary
		PageSource stubbedPageSource() {
			String page =
				"""
				<html><body>
				<div class="project-header-info-list">
				  <span class="badge"><i class="far fa-euro-sign"></i>95,00 € Budget</span>
				  <span class="badge"><i class="far fa-hourglass"></i>Dauer 3 Monate</span>
				</div>
				<div class="project-body-description"><h2>Beschreibung</h2><p>Beschreibung aus der Detailseite.</p></div>
				</body></html>
				""";
			return url -> PAGE_FAILS.get() ? new PageSource.PageResult.Failed("Timeout") : new PageSource.PageResult.Html(page);
		}

		/** Bewertet jedes Angebot deterministisch: Score 85, ein Skill + ein Gap. */
		@Bean
		@Primary
		OfferAnalyzer stubbedAnalyzer() {
			return (profile, offers) ->
				new AnalysisResult(
					offers
						.stream()
						.map(offer ->
							new OfferAssessment(
								offer.getId(),
								85,
								"Passt gut zum Profil (" + profile.getName() + ").",
								"senior",
								"unbekannt",
								"Angular Entwickler",
								"AT",
								List.of(new AnalyzedSkill("Angular", false), new AnalyzedSkill("Kotlin", true))
							)
						)
						.toList(),
					1200,
					300
				);
		}
	}

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private OfferRepository offers;

	@Autowired
	private RunRepository runs;

	@BeforeEach
	void reset() {
		MAILS.clear();
		PAGE_FAILS.set(false);
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
			.andExpect(jsonPath("$.totalSeen").value(1))
			// 2 Angebote × 2 geseedete Profile: ein Abruf-Lauf analysiert gegen alle Profile.
			.andExpect(jsonPath("$.analyzedOffers").value(4))
			.andExpect(jsonPath("$.inputTokens").value(2400))
			.andExpect(jsonPath("$.outputTokens").value(600));

		mockMvc
			.perform(get("/api/offers"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].sourceType").value("AGENT"))
			.andExpect(jsonPath("$[0].agentName").value("Angular"))
			.andExpect(jsonPath("$[0].company").value("softwareXperts GmbH"))
			.andExpect(jsonPath("$[0].status").value("ANALYZED"))
			.andExpect(jsonPath("$[0].country").value("AT"))
			.andExpect(jsonPath("$[0].matchScore").value(85))
			.andExpect(jsonPath("$[0].matchReason").value("Passt gut zum Profil (Frontend Architect & Angular Lead)."))
			.andExpect(jsonPath("$[0].skills", hasSize(2)))
			.andExpect(jsonPath("$[0].skills[?(@.name=='Kotlin')].gap", contains(true)))
			// Die Felder der Detailseite gehen jetzt raus …
			.andExpect(jsonPath("$[0].budgetEur").value(95.0))
			.andExpect(jsonPath("$[0].budgetKind").value("HOURLY"))
			.andExpect(jsonPath("$[0].durationMonths").value(3))
			// … und die beiden toten Textfelder aus dem Mail-Parser nicht mehr.
			.andExpect(jsonPath("$[0].rate").doesNotExist())
			.andExpect(jsonPath("$[0].duration").doesNotExist());

		// Second run with the same mail: Message-ID dedup keeps the offer count at 2.
		mockMvc
			.perform(post("/api/runs"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.newOffers").value(0))
			.andExpect(jsonPath("$.totalSeen").value(1));

		mockMvc.perform(get("/api/offers")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(2)));
	}

	@Test
	void fillsTheNewOffersFromTheirProjectPageAndCountsThemOnTheRun() throws Exception {
		MAILS.add(
			new FetchedMail(
				"<offer-1@freelancermap.de>",
				"office@freelancermap.de",
				"Angular - Anzahl neue Projekte: 1",
				Instant.parse("2026-07-23T06:35:00Z"),
				agentMailBody(projectBlock("Angular Developer (m/w/d)", 3026991L))
			)
		);

		mockMvc
			.perform(post("/api/runs"))
			.andExpect(status().isCreated())
			// Der Lauf sagt, was er getan hat — sonst sieht ein Lauf ohne neue Mails wie ein Nulllauf aus.
			.andExpect(jsonPath("$.detailsFetched").value(1))
			.andExpect(jsonPath("$.detailsFailed").value(0));

		Offer stored = offers.findAll().getFirst();
		assertThat(stored.getBudgetEur()).isEqualByComparingTo("95.00");
		assertThat(stored.getBudgetKind()).isEqualTo(BudgetKind.HOURLY);
		assertThat(stored.getDurationMonths()).isEqualTo(3);
		assertThat(stored.getDescription()).isEqualTo("Beschreibung aus der Detailseite.");
		assertThat(stored.getDetailStatus()).isEqualTo(DetailStatus.OK);
		assertThat(runs.findAll().getFirst().getDetailsFetched()).isEqualTo(1);
	}

	@Test
	void survivesAProjectPageThatCannotBeLoaded() throws Exception {
		PAGE_FAILS.set(true);
		MAILS.add(
			new FetchedMail(
				"<offer-1@freelancermap.de>",
				"office@freelancermap.de",
				"Angular - Anzahl neue Projekte: 1",
				Instant.parse("2026-07-23T06:35:00Z"),
				agentMailBody(projectBlock("Angular Developer (m/w/d)", 3026991L))
			)
		);

		// Der Lauf läuft trotzdem durch — inklusive Analyse.
		mockMvc.perform(post("/api/runs")).andExpect(status().isCreated()).andExpect(jsonPath("$.newOffers").value(1));

		Offer stored = offers.findAll().getFirst();
		// ERROR bleibt in der Warteschlange: der nächste Lauf versucht es erneut.
		assertThat(stored.getDetailStatus()).isEqualTo(DetailStatus.ERROR);
		assertThat(stored.getDescription()).isNull();
		assertThat(runs.findAll().getFirst().getDetailsFailed()).isEqualTo(1);
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
	void reanalyzingAgainstASecondProfileKeepsBothResults() throws Exception {
		MAILS.add(
			new FetchedMail(
				"<offer-1@freelancermap.de>",
				"office@freelancermap.de",
				"Angular - Anzahl neue Projekte: 1",
				Instant.parse("2026-07-23T06:35:00Z"),
				agentMailBody(projectBlock("Senior Angular Entwickler (m/w/d)", 3026991L))
			)
		);
		// Lauf 1 analysiert gegen beide geseedeten Profile.
		mockMvc.perform(post("/api/runs")).andExpect(status().isCreated());

		String created = mockMvc
			.perform(
				post("/api/profiles")
					.contentType(MediaType.APPLICATION_JSON)
					.content(objectMapper.writeValueAsString(Map.of("name", "Fullstack", "role", "Fullstack Developer")))
			)
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		long fullstackId = objectMapper.readTree(created).get("id").asLong();

		// Kostenvorschau: 1 unbewerteter Kandidat für das neue Profil.
		mockMvc
			.perform(get("/api/analyses/preview").param("profileId", String.valueOf(fullstackId)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.candidates").value(1))
			.andExpect(jsonPath("$.estimatedInputTokens").value(1200));

		mockMvc
			.perform(
				post("/api/analyses")
					.contentType(MediaType.APPLICATION_JSON)
					.content(objectMapper.writeValueAsString(Map.of("profileId", fullstackId)))
			)
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.analyzedOffers").value(1));

		// Beide Ergebnisse existieren nebeneinander — je nach angefragtem Profil.
		mockMvc
			.perform(get("/api/offers").param("profileId", String.valueOf(fullstackId)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].matchReason").value("Passt gut zum Profil (Fullstack)."));

		mockMvc
			.perform(get("/api/offers"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].matchReason").value("Passt gut zum Profil (Frontend Architect & Angular Lead)."));

		mockMvc.perform(delete("/api/profiles/{id}", fullstackId)).andExpect(status().isNoContent());
	}

	@Test
	void forceReanalyzeOverwritesAlreadyScoredOffersAfterAProfileChange() throws Exception {
		MAILS.add(
			new FetchedMail(
				"<offer-1@freelancermap.de>",
				"office@freelancermap.de",
				"Angular - Anzahl neue Projekte: 1",
				Instant.parse("2026-07-23T06:35:00Z"),
				agentMailBody(projectBlock("Senior Angular Entwickler (m/w/d)", 3026991L))
			)
		);
		// Lauf 1 analysiert das eine Angebot gegen beide geseedeten Profile — für keines bleibt danach ein Kandidat.
		mockMvc.perform(post("/api/runs")).andExpect(status().isCreated());
		mockMvc
			.perform(get("/api/analyses/preview").param("profileId", "1"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.candidates").value(0));

		// Ohne force bleibt eine Re-Analyse wirkungslos: das Angebot gilt schon als bewertet.
		mockMvc
			.perform(
				post("/api/analyses")
					.contentType(MediaType.APPLICATION_JSON)
					.content(objectMapper.writeValueAsString(Map.of("profileId", 1)))
			)
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.analyzedOffers").value(0));

		// Mit force zählt es trotz vorhandenem Ergebnis wieder als Kandidat — das Profil hat sich geändert.
		mockMvc
			.perform(get("/api/analyses/preview").param("profileId", "1").param("force", "true"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.candidates").value(1));

		mockMvc
			.perform(
				post("/api/analyses")
					.contentType(MediaType.APPLICATION_JSON)
					.content(objectMapper.writeValueAsString(Map.of("profileId", 1, "force", true)))
			)
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.analyzedOffers").value(1));
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

	@Test
	void listsAllRunsNewestFirst() throws Exception {
		mockMvc.perform(get("/api/runs")).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));

		MAILS.add(
			new FetchedMail(
				"<offer-1@freelancermap.de>",
				"office@freelancermap.de",
				"Angular - Anzahl neue Projekte: 1",
				Instant.parse("2026-07-23T06:35:00Z"),
				agentMailBody(projectBlock("Senior Angular Entwickler (m/w/d)", 3026991L))
			)
		);
		// Erster Lauf analysiert das eine Angebot gegen beide geseedeten Profile (2 × 1200/300
		// Tokens laut Stub-Analyzer), der zweite findet keine neue Mail mehr und analysiert
		// nichts (0 Tokens).
		mockMvc.perform(post("/api/runs")).andExpect(status().isCreated());
		mockMvc.perform(post("/api/runs")).andExpect(status().isCreated());

		mockMvc
			.perform(get("/api/runs"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(2)))
			.andExpect(jsonPath("$[0].inputTokens").value(0))
			.andExpect(jsonPath("$[1].inputTokens").value(2400));
	}
}
