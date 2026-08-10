package de.prime_ux.backend.collect;

import static org.assertj.core.api.Assertions.assertThat;

import de.prime_ux.backend.offer.DetailStatus;
import de.prime_ux.backend.offer.Offer;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class ProjectPageServiceTest {

	private static final String PAGE =
		"""
		<html><body>
		<div class="project-header-info-list">
		  <span class="badge"><i class="far fa-euro-sign"></i>85,00 € Budget</span>
		  <span class="badge"><i class="far fa-hourglass"></i>Dauer 4 Monate</span>
		  <span class="badge"><i class="far fa-car-side"></i>80% Remote</span>
		</div>
		<div class="project-body-description"><h2>Beschreibung</h2><p>Ein Projekt.</p></div>
		</body></html>
		""";

	private static Offer offer() {
		Offer offer = new Offer("<mid@example.org>", Instant.now(), "office@freelancermap.de", "Betreff");
		offer.setProjectUrl("https://www.freelancermap.de/nproj/1.html?utm_source=systemmail");
		return offer;
	}

	private ProjectPageService service(PageSource source) {
		return new ProjectPageService(source, new ProjectPageParser());
	}

	@Test
	void writesTheFactsAndMarksTheOfferDone() {
		Offer offer = offer();

		boolean fetched = service(url -> new PageSource.PageResult.Html(PAGE)).enrich(offer);

		assertThat(fetched).isTrue();
		assertThat(offer.getRateHourlyEur()).isEqualByComparingTo("85.00");
		assertThat(offer.getDurationMonths()).isEqualTo(4);
		assertThat(offer.getRemotePercent()).isEqualTo(80);
		assertThat(offer.getDescription()).isEqualTo("Ein Projekt.");
		assertThat(offer.getDetailStatus()).isEqualTo(DetailStatus.OK);
		assertThat(offer.getDetailFetchedAt()).isNotNull();
	}

	@Test
	void givesUpOnAProjectThatIsGone() {
		Offer offer = offer();

		boolean fetched = service(url -> new PageSource.PageResult.Gone()).enrich(offer);

		// NOT_FOUND ist endgültig — die Warteschlange fasst das Angebot nicht wieder an.
		assertThat(fetched).isFalse();
		assertThat(offer.getDetailStatus()).isEqualTo(DetailStatus.NOT_FOUND);
	}

	@Test
	void keepsAFailedFetchInTheQueue() {
		Offer offer = offer();

		boolean fetched = service(url -> new PageSource.PageResult.Failed("Timeout")).enrich(offer);

		assertThat(fetched).isFalse();
		assertThat(offer.getDetailStatus()).isEqualTo(DetailStatus.ERROR);
		assertThat(offer.getDetailFetchedAt()).isNull();
	}

	@Test
	void doesNotEvenTryWithoutAProjectLink() {
		Offer offer = new Offer("<mid@example.org>", Instant.now(), "office@freelancermap.de", "Betreff");

		boolean fetched = service(url -> {
			throw new AssertionError("Ohne Link darf kein Abruf stattfinden");
		}).enrich(offer);

		assertThat(fetched).isFalse();
		assertThat(offer.getDetailStatus()).isEqualTo(DetailStatus.NOT_FOUND);
	}
}
