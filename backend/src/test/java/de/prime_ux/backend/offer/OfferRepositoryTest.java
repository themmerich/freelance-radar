package de.prime_ux.backend.offer;

import static org.assertj.core.api.Assertions.assertThat;

import de.prime_ux.backend.TestcontainersConfiguration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase.Replace;
import org.springframework.context.annotation.Import;

// @DataJpaTest normally swaps in an embedded database; keep the real one so the
// Flyway migration runs and queries hit PostgreSQL via Testcontainers.
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
@Import(TestcontainersConfiguration.class)
class OfferRepositoryTest {

	@Autowired
	private OfferRepository offers;

	@Test
	void persistsAnOfferWithDefaultsAndFindsItByMessageId() {
		Offer saved = offers.save(
			new Offer("<mail-1@freelancermap.de>", Instant.parse("2026-07-22T08:00:00Z"), "office@freelancermap.de", "Projekt")
		);

		assertThat(saved.getId()).isNotNull();
		assertThat(saved.getFetchedAt()).isNotNull();
		assertThat(saved.getStatus()).isEqualTo(OfferStatus.NEW);
		assertThat(saved.getSourceType()).isEqualTo(SourceType.OTHER);
		assertThat(offers.existsByMessageId("<mail-1@freelancermap.de>")).isTrue();
		assertThat(offers.existsByMessageId("<unknown@freelancermap.de>")).isFalse();
	}

	@Test
	void listsOffersNewestFirst() {
		offers.save(new Offer("<old@freelancermap.de>", Instant.parse("2026-07-20T08:00:00Z"), "office@", "Alt"));
		offers.save(new Offer("<new@freelancermap.de>", Instant.parse("2026-07-22T08:00:00Z"), "office@", "Neu"));

		assertThat(offers.findAllByOrderByReceivedAtDesc()).extracting(Offer::getSubject).containsExactly("Neu", "Alt");
	}
}
