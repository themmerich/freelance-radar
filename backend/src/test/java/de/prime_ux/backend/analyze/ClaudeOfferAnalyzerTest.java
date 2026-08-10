package de.prime_ux.backend.analyze;

import static org.assertj.core.api.Assertions.assertThat;

import de.prime_ux.backend.offer.Offer;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class ClaudeOfferAnalyzerTest {

	private static Offer offer(String description) {
		Offer offer = new Offer("<mid@fm.de>", Instant.now(), "office@freelancermap.de", "Betreff");
		offer.setRawBody("Teaser aus der Mail");
		offer.setDescription(description);
		return offer;
	}

	@Test
	void prefersTheProjectDescriptionOverTheTeaserMail() {
		assertThat(ClaudeOfferAnalyzer.promptText(offer("Die volle Ausschreibung."))).isEqualTo("Die volle Ausschreibung.");
	}

	@Test
	void fallsBackToTheMailWhenNoPageWasFetched() {
		assertThat(ClaudeOfferAnalyzer.promptText(offer(null))).isEqualTo("Teaser aus der Mail");
	}

	@Test
	void treatsAnEmptyDescriptionAsMissing() {
		// Eine leere Beschreibung wäre schlechter als der Teaser — dann lieber der Teaser.
		assertThat(ClaudeOfferAnalyzer.promptText(offer("   "))).isEqualTo("Teaser aus der Mail");
	}
}
