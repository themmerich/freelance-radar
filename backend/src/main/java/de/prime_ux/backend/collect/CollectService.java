package de.prime_ux.backend.collect;

import de.prime_ux.backend.offer.Offer;
import de.prime_ux.backend.offer.OfferRepository;
import de.prime_ux.backend.run.Run;
import de.prime_ux.backend.run.RunRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ein Abruf-Lauf: Mails seit dem Startdatum holen, per Message-ID deduplizieren,
 * heuristisch parsen, als status=NEW speichern und den Lauf protokollieren.
 * Verbraucht keine Tokens — die Claude-Analyse kommt erst in Phase 2.
 */
@Service
public class CollectService {

	private final MailSource mailSource;
	private final ParserService parser;
	private final SinceDateStore sinceDate;
	private final OfferRepository offers;
	private final RunRepository runs;
	private final RadarProperties properties;

	public CollectService(
		MailSource mailSource,
		ParserService parser,
		SinceDateStore sinceDate,
		OfferRepository offers,
		RunRepository runs,
		RadarProperties properties
	) {
		this.mailSource = mailSource;
		this.parser = parser;
		this.sinceDate = sinceDate;
		this.offers = offers;
		this.runs = runs;
		this.properties = properties;
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
			offers.save(toOffer(mail));
			newCount++;
		}

		return runs.save(new Run(newCount, mails.size(), "since=" + since));
	}

	private Offer toOffer(FetchedMail mail) {
		Offer offer = new Offer(mail.messageId(), mail.receivedAt(), mail.fromAddr(), mail.subject());
		ParsedOffer parsed = parser.parse(mail.subject(), mail.body());
		offer.setSourceType(parsed.sourceType());
		offer.setAgentName(parsed.agentName());
		offer.setProjectTitle(parsed.projectTitle());
		offer.setLocation(parsed.location());
		offer.setRemote(parsed.remote());
		offer.setRate(parsed.rate());
		offer.setStartDate(parsed.startDate());
		offer.setDuration(parsed.duration());
		offer.setRawBody(truncateBody(mail.body()));
		return offer;
	}

	private String truncateBody(String body) {
		int max = properties.maxBodyChars();
		return body.length() <= max ? body : body.substring(0, max);
	}
}
