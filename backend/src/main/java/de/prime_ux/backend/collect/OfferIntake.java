package de.prime_ux.backend.collect;

import de.prime_ux.backend.offer.Offer;
import de.prime_ux.backend.offer.OfferRepository;
import de.prime_ux.backend.run.Run;
import de.prime_ux.backend.run.RunRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Der transaktionale Teil eines Abruf-Laufs: Mails in Angebote überführen und den Lauf
 * protokollieren.
 *
 * Bewusst von {@link CollectService} getrennt — der Detailseiten-Abruf dauert je Lauf
 * Minuten (gedrosselt, eine Seite pro Sekunde) und darf dabei keine Transaktion und keine
 * Datenbankverbindung offenhalten. Deshalb orchestriert CollectService ohne Transaktion und
 * ruft hier kurze, abgeschlossene Einheiten auf.
 */
@Service
public class OfferIntake {

	private final ParserService parser;
	private final OfferRepository offers;
	private final RunRepository runs;
	private final RadarProperties properties;
	private final ProjectPageService projectPages;

	public OfferIntake(
		ParserService parser,
		OfferRepository offers,
		RunRepository runs,
		RadarProperties properties,
		ProjectPageService projectPages
	) {
		this.parser = parser;
		this.offers = offers;
		this.runs = runs;
		this.properties = properties;
		this.projectPages = projectPages;
	}

	/** Speichert die Angebote aller neuen Mails und legt den Lauf an. */
	@Transactional
	public Stored store(LocalDate since, List<FetchedMail> mails) {
		List<Long> newOfferIds = new ArrayList<>();
		for (FetchedMail mail : mails) {
			if (offers.existsByMessageId(mail.messageId())) {
				continue;
			}
			newOfferIds.addAll(saveOffers(mail));
		}
		Run run = runs.save(new Run(newOfferIds.size(), mails.size(), "since=" + since));
		return new Stored(run, newOfferIds);
	}

	/** Ergebnis des Abrufs: der protokollierte Lauf und die IDs der neu angelegten Angebote. */
	public record Stored(Run run, List<Long> newOfferIds) {}

	/**
	 * Holt die Detailseite eines Angebots in einer kurzen eigenen Transaktion. Die Drosselung
	 * zwischen zwei Abrufen liegt beim Aufrufer und damit außerhalb jeder Transaktion.
	 */
	@Transactional
	public boolean enrichDetail(Long offerId) {
		return offers.findById(offerId).map(projectPages::enrich).orElse(false);
	}

	@Transactional
	public void recordDetails(Long runId, int fetched, int failed) {
		runs
			.findById(runId)
			.ifPresent(run -> {
				run.setDetailsFetched(fetched);
				run.setDetailsFailed(failed);
			});
	}

	private List<Long> saveOffers(FetchedMail mail) {
		ParsedMail parsed = parser.parse(mail.subject(), mail.body());
		List<Long> ids = new ArrayList<>();
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
			ids.add(offers.save(offer).getId());
		}
		return ids;
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
