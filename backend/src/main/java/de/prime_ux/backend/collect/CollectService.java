package de.prime_ux.backend.collect;

import de.prime_ux.backend.analyze.AnalysisService;
import de.prime_ux.backend.offer.Offer;
import de.prime_ux.backend.offer.OfferRepository;
import de.prime_ux.backend.run.Run;
import de.prime_ux.backend.run.RunRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ein Abruf-Lauf: Mails seit dem Startdatum holen, per Message-ID deduplizieren,
 * pro Projekt-Block ein Offer mit status=NEW speichern, dann die neuen primären
 * Angebote per Claude analysieren (gedeckelt, siehe {@link AnalysisService}) und
 * den Lauf inklusive Token-Verbrauch protokollieren. Springen mehrere Agenten
 * auf dasselbe Projekt an (gleiche freelancermap-ID), wird nur der erste Eintrag
 * primär — die Kopien zählen den dup_count hoch und werden nie analysiert.
 */
@Service
public class CollectService {

	private static final Logger log = LoggerFactory.getLogger(CollectService.class);

	private final MailSource mailSource;
	private final ParserService parser;
	private final SinceDateStore sinceDate;
	private final OfferRepository offers;
	private final RunRepository runs;
	private final RadarProperties properties;
	private final AnalysisService analysis;

	public CollectService(
		MailSource mailSource,
		ParserService parser,
		SinceDateStore sinceDate,
		OfferRepository offers,
		RunRepository runs,
		RadarProperties properties,
		AnalysisService analysis
	) {
		this.mailSource = mailSource;
		this.parser = parser;
		this.sinceDate = sinceDate;
		this.offers = offers;
		this.runs = runs;
		this.properties = properties;
		this.analysis = analysis;
	}

	@Transactional
	public Run collect() {
		LocalDate since = sinceDate.get();
		List<FetchedMail> mails = mailSource.fetchSince(since);

		int newCount = 0;
		for (FetchedMail mail : mails) {
			if (offers.existsByMessageId(mail.messageId())) {
				continue;
			}
			newCount += saveOffers(mail);
		}

		Run run = runs.save(new Run(newCount, mails.size(), "since=" + since));
		try {
			analysis.analyzeNewOffers(run);
		} catch (Exception e) {
			// Der Abruf-Teil des Laufs bleibt gültig; die Angebote bleiben NEW
			// und werden beim nächsten Lauf erneut angeboten.
			log.warn("Claude-Analyse fehlgeschlagen", e);
			run.setNote(run.getNote() + "; analyse-fehler: " + e.getMessage());
		}

		// Erst ganz am Ende vorrücken: schlägt vorher etwas fehl, bleibt das
		// alte Fenster bestehen und der nächste Lauf holt die Mails erneut.
		mails
			.stream()
			.map(FetchedMail::receivedAt)
			.max(Instant::compareTo)
			.ifPresent(newest -> sinceDate.advanceTo(LocalDate.ofInstant(newest, ZoneId.systemDefault())));

		return run;
	}

	private int saveOffers(FetchedMail mail) {
		ParsedMail parsed = parser.parse(mail.subject(), mail.body());
		int index = 0;
		for (ParsedProject project : parsed.projects()) {
			Offer offer = new Offer(mail.messageId(), mail.receivedAt(), mail.fromAddr(), mail.subject());
			offer.setProjectIndex(index++);
			offer.setSourceType(parsed.sourceType());
			offer.setAgentName(parsed.agentName());
			offer.setProjectTitle(project.title());
			offer.setCompany(project.company());
			offer.setLocation(project.location());
			offer.setRemote(project.remote());
			offer.setRate(project.rate());
			offer.setStartDate(project.startDate());
			offer.setDuration(project.duration());
			offer.setFmProjectId(project.fmProjectId());
			offer.setProjectUrl(project.url());
			offer.setRawBody(truncateBody(mail.body()));
			markDuplicate(offer);
			offers.save(offer);
		}
		return index;
	}

	/**
	 * Cross-Agent-Dedup: Projekte mit freelancermap-ID bilden eine Gruppe. Existiert
	 * schon ein primärer Eintrag, wird das neue Offer als Kopie markiert und der
	 * dup_count des primären hochgezählt (Badge „N×" im Dashboard).
	 */
	private void markDuplicate(Offer offer) {
		if (offer.getFmProjectId() == null) {
			return;
		}
		String dupGroup = "fm-" + offer.getFmProjectId();
		offer.setDupGroup(dupGroup);
		offers
			.findFirstByDupGroupAndPrimaryTrue(dupGroup)
			.ifPresent(primary -> {
				offer.setPrimary(false);
				primary.setDupCount(primary.getDupCount() + 1);
			});
	}

	private String truncateBody(String body) {
		int max = properties.maxBodyChars();
		return body.length() <= max ? body : body.substring(0, max);
	}
}
