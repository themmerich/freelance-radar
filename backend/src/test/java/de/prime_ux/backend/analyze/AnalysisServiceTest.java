package de.prime_ux.backend.analyze;

import static org.assertj.core.api.Assertions.assertThat;

import de.prime_ux.backend.TestcontainersConfiguration;
import de.prime_ux.backend.offer.Offer;
import de.prime_ux.backend.offer.OfferAnalysisId;
import de.prime_ux.backend.offer.OfferAnalysisRepository;
import de.prime_ux.backend.offer.OfferRepository;
import de.prime_ux.backend.profile.Profile;
import de.prime_ux.backend.profile.ProfileRepository;
import de.prime_ux.backend.run.Run;
import de.prime_ux.backend.run.RunRepository;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;

// Kostendeckel-Verhalten mit deckel=1: nur das älteste unbewertete Angebot wird
// analysiert, der Rest bleibt offen; Kopien (is_primary=false) kosten nie Tokens.
@SpringBootTest(
	properties = {
		"radar.analysis.max-offers-per-run=1",
		"radar.state-dir=build/test-state",
		"spring.ai.anthropic.api-key=test-key",
	}
)
@Import({ TestcontainersConfiguration.class, AnalysisServiceTest.StubAnalyzer.class })
class AnalysisServiceTest {

	@TestConfiguration(proxyBeanMethods = false)
	static class StubAnalyzer {

		@Bean
		@Primary
		OfferAnalyzer stubbedAnalyzer() {
			return (profile, offers) ->
				new AnalysisResult(
					offers
						.stream()
						.map(offer -> new OfferAssessment(offer.getId(), 70, "Solide Passung.", "senior", "Banking", "Angular", "DE", List.of()))
						.toList(),
					500,
					100
				);
		}
	}

	@Autowired
	private AnalysisService analysis;

	@Autowired
	private OfferRepository offers;

	@Autowired
	private OfferAnalysisRepository analyses;

	@Autowired
	private ProfileRepository profiles;

	@Autowired
	private RunRepository runs;

	private Long activeProfileId;

	@BeforeEach
	void reset() {
		offers.deleteAll();
		runs.deleteAll();
		activeProfileId = profiles.findByActiveTrue().map(Profile::getId).orElseThrow();
	}

	@Test
	void capsTheBatchAtMaxOffersPerRunAndNotesTheLeftover() {
		Offer oldest = offers.save(newOffer("<old@fm.de>", "2026-07-23T06:00:00Z"));
		Offer newest = offers.save(newOffer("<new@fm.de>", "2026-07-23T08:00:00Z"));
		Run run = runs.save(new Run(2, 2, "since=2026-07-23"));

		analysis.analyzeNewOffers(run);

		assertThat(run.getAnalyzedOffers()).isEqualTo(1);
		assertThat(run.getInputTokens()).isEqualTo(500);
		assertThat(run.getNote()).contains("deckel=1", "offen=1");

		assertThat(analyses.findById(new OfferAnalysisId(oldest.getId(), activeProfileId)))
			.hasValueSatisfying(result -> assertThat(result.getMatchScore()).isEqualTo(70));
		assertThat(analyses.findById(new OfferAnalysisId(newest.getId(), activeProfileId))).isEmpty();
	}

	@Test
	void neverAnalyzesNonPrimaryCopies() {
		Offer copy = newOffer("<copy@fm.de>", "2026-07-23T06:00:00Z");
		copy.setPrimary(false);
		offers.save(copy);
		Run run = runs.save(new Run(1, 1, "since=2026-07-23"));

		analysis.analyzeNewOffers(run);

		assertThat(run.getAnalyzedOffers()).isZero();
		assertThat(run.getInputTokens()).isZero();
		assertThat(analyses.count()).isZero();
	}

	private Offer newOffer(String messageId, String receivedAt) {
		return new Offer(messageId, Instant.parse(receivedAt), "office@freelancermap.de", "Angular - Anzahl neue Projekte: 1");
	}
}
