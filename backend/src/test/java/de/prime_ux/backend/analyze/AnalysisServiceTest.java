package de.prime_ux.backend.analyze;

import static org.assertj.core.api.Assertions.assertThat;

import de.prime_ux.backend.TestcontainersConfiguration;
import de.prime_ux.backend.offer.Offer;
import de.prime_ux.backend.offer.OfferRepository;
import de.prime_ux.backend.offer.OfferStatus;
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

// Kostendeckel-Verhalten mit deckel=1: nur das älteste NEW-Angebot wird analysiert,
// der Rest bleibt NEW; Kopien (is_primary=false) kosten nie Tokens.
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
			return offers ->
				new AnalysisResult(
					offers
						.stream()
						.map(offer -> new OfferAnalysis(offer.getId(), 70, "Solide Passung.", "senior", "Banking", "Angular", "DE", List.of()))
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
	private RunRepository runs;

	@BeforeEach
	void reset() {
		offers.deleteAll();
		runs.deleteAll();
	}

	@Test
	void capsTheBatchAtMaxOffersPerRunAndNotesTheLeftover() {
		offers.save(newOffer("<old@fm.de>", "2026-07-23T06:00:00Z"));
		offers.save(newOffer("<new@fm.de>", "2026-07-23T08:00:00Z"));
		Run run = runs.save(new Run(2, 2, "since=2026-07-23"));

		analysis.analyzeNewOffers(run);

		assertThat(run.getAnalyzedOffers()).isEqualTo(1);
		assertThat(run.getInputTokens()).isEqualTo(500);
		assertThat(run.getNote()).contains("deckel=1", "offen=1");

		List<Offer> all = offers.findAllByOrderByReceivedAtDesc();
		assertThat(all.get(0).getStatus()).isEqualTo(OfferStatus.NEW);
		assertThat(all.get(1).getStatus()).isEqualTo(OfferStatus.ANALYZED);
		assertThat(all.get(1).getMatchScore()).isEqualTo(70);
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
		assertThat(offers.findAllByOrderByReceivedAtDesc().getFirst().getStatus()).isEqualTo(OfferStatus.NEW);
	}

	private Offer newOffer(String messageId, String receivedAt) {
		return new Offer(messageId, Instant.parse(receivedAt), "office@freelancermap.de", "Angular - Anzahl neue Projekte: 1");
	}
}
