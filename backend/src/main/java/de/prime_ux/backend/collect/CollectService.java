package de.prime_ux.backend.collect;

import de.prime_ux.backend.analyze.AnalysisService;
import de.prime_ux.backend.offer.DetailStatus;
import de.prime_ux.backend.offer.Offer;
import de.prime_ux.backend.offer.OfferRepository;
import de.prime_ux.backend.run.Run;
import de.prime_ux.backend.run.RunRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

/**
 * Ein Abruf-Lauf: Mails seit dem Startdatum holen, per Message-ID deduplizieren, pro
 * Projekt-Block ein Offer mit status=NEW speichern ({@link OfferIntake}), die Detailseiten
 * dazuholen und dann die neuen primären Angebote per Claude analysieren (gedeckelt, siehe
 * {@link AnalysisService}). Springen mehrere Agenten auf dasselbe Projekt an (gleiche
 * freelancermap-ID), wird nur der erste Eintrag primär — die Kopien zählen den dup_count
 * hoch und werden nie analysiert.
 *
 * Diese Klasse ist bewusst **nicht** transaktional: der Detailseiten-Abruf ist gedrosselt
 * und braucht je Lauf Minuten. Die Arbeit steckt in kurzen Transaktionen der Mitspieler.
 */
@Service
public class CollectService {

	private static final Logger log = LoggerFactory.getLogger(CollectService.class);

	/** Detailseiten dieser Zustände stehen in der Warteschlange. */
	private static final List<DetailStatus> OPEN = List.of(DetailStatus.PENDING, DetailStatus.ERROR);

	private final MailSource mailSource;
	private final SinceDateStore sinceDate;
	private final OfferIntake intake;
	private final OfferRepository offers;
	private final RunRepository runs;
	private final DetailProperties detailProperties;
	private final AnalysisService analysis;

	public CollectService(
		MailSource mailSource,
		SinceDateStore sinceDate,
		OfferIntake intake,
		OfferRepository offers,
		RunRepository runs,
		DetailProperties detailProperties,
		AnalysisService analysis
	) {
		this.mailSource = mailSource;
		this.sinceDate = sinceDate;
		this.intake = intake;
		this.offers = offers;
		this.runs = runs;
		this.detailProperties = detailProperties;
		this.analysis = analysis;
	}

	public Run collect() {
		LocalDate since = sinceDate.get();
		List<FetchedMail> mails = mailSource.fetchSince(since);

		OfferIntake.Stored stored = intake.store(since, mails);
		Run run = stored.run();

		DetailOutcome details = fetchDetails(stored.newOfferIds());
		intake.recordDetails(run.getId(), details.fetched(), details.failed());

		try {
			analysis.analyzeNewOffers(run.getId());
		} catch (Exception e) {
			// Der Abruf-Teil des Laufs bleibt gültig; die Angebote bleiben NEW
			// und werden beim nächsten Lauf erneut angeboten.
			log.warn("Claude-Analyse fehlgeschlagen", e);
		}

		// Erst ganz am Ende vorrücken: schlägt vorher etwas fehl, bleibt das
		// alte Fenster bestehen und der nächste Lauf holt die Mails erneut.
		mails
			.stream()
			.map(FetchedMail::receivedAt)
			.max(Instant::compareTo)
			.ifPresent(newest -> sinceDate.advanceTo(LocalDate.ofInstant(newest, ZoneId.systemDefault())));

		// Frisch laden: Detailzähler und Analyse-Ergebnis wurden in eigenen Transaktionen
		// geschrieben, die hier gehaltene Instanz kennt sie nicht.
		return runs.findById(run.getId()).orElse(run);
	}

	/**
	 * Erst die frisch eingesammelten Angebote, dann die Warteschlange der noch offenen —
	 * die neuen Angebote sind das, was gleich analysiert wird, der Bestand kann warten.
	 * Zwischen zwei Abrufen wird gedrosselt; ein Fehlschlag beendet den Lauf nie.
	 */
	private DetailOutcome fetchDetails(List<Long> newOfferIds) {
		if (!detailProperties.enabled()) {
			return new DetailOutcome(0, 0);
		}

		Set<Long> queue = new LinkedHashSet<>(newOfferIds);
		int remaining = detailProperties.maxPerRun() - queue.size();
		if (remaining > 0) {
			queue.addAll(backlog(remaining));
		}

		int fetched = 0;
		int failed = 0;
		boolean first = true;
		for (Long offerId : queue.stream().limit(detailProperties.maxPerRun()).toList()) {
			if (!first) {
				pause();
			}
			first = false;
			if (intake.enrichDetail(offerId)) {
				fetched++;
			} else {
				failed++;
			}
		}
		log.info("Detailseiten: {} geholt, {} offen geblieben", fetched, failed);
		return new DetailOutcome(fetched, failed);
	}

	private List<Long> backlog(int limit) {
		List<Offer> open = offers.findByPrimaryTrueAndDetailStatusInOrderByReceivedAtAsc(OPEN, PageRequest.of(0, limit));
		List<Long> ids = new ArrayList<>(open.size());
		for (Offer offer : open) {
			ids.add(offer.getId());
		}
		return ids;
	}

	private void pause() {
		try {
			Thread.sleep(detailProperties.delayMs());
		} catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		}
	}

	/** Zählwerk des Detailseiten-Abrufs für das Lauf-Protokoll. */
	private record DetailOutcome(int fetched, int failed) {}
}
