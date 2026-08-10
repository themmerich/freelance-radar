package de.prime_ux.backend.collect;

import de.prime_ux.backend.collect.PageSource.PageResult;
import de.prime_ux.backend.offer.DetailStatus;
import de.prime_ux.backend.offer.Offer;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Füllt ein Angebot mit dem, was seine Projekt-Detailseite hergibt.
 *
 * Der Status am Angebot steuert die Warteschlange des nächsten Laufs: OK und NOT_FOUND sind
 * endgültig, PENDING und ERROR kommen wieder dran.
 */
@Service
public class ProjectPageService {

	private static final Logger log = LoggerFactory.getLogger(ProjectPageService.class);

	private final PageSource pageSource;
	private final ProjectPageParser parser;

	public ProjectPageService(PageSource pageSource, ProjectPageParser parser) {
		this.pageSource = pageSource;
		this.parser = parser;
	}

	/**
	 * Holt die Detailseite und überträgt die Felder ins Angebot.
	 *
	 * @return true, wenn die Seite ankam — der Aufrufer zählt Erfolge und Fehlschläge mit.
	 */
	public boolean enrich(Offer offer) {
		if (offer.getProjectUrl() == null || offer.getProjectUrl().isBlank()) {
			// Ohne Link gibt es nichts zu holen; erneute Versuche wären sinnlos.
			offer.setDetailStatus(DetailStatus.NOT_FOUND);
			return false;
		}

		switch (pageSource.fetch(offer.getProjectUrl())) {
			case PageResult.Html(String html) -> {
				apply(offer, parser.parse(html));
				return true;
			}
			case PageResult.Gone() -> {
				offer.setDetailStatus(DetailStatus.NOT_FOUND);
				return false;
			}
			case PageResult.Failed(String reason) -> {
				log.info("Detailseite zu Angebot {} nicht geladen: {}", offer.getId(), reason);
				offer.setDetailStatus(DetailStatus.ERROR);
				return false;
			}
		}
	}

	private void apply(Offer offer, ProjectDetails details) {
		offer.setRateHourlyEur(details.rateHourlyEur());
		offer.setDurationMonths(details.durationMonths());
		offer.setUtilizationPercent(details.utilizationPercent());
		offer.setRemotePercent(details.remotePercent());
		offer.setContractType(details.contractType());
		offer.setStartMonth(details.startMonth());
		offer.setStartImmediate(details.startImmediate());
		offer.setDescription(details.description());
		offer.setDetailStatus(DetailStatus.OK);
		offer.setDetailFetchedAt(Instant.now());
	}
}
