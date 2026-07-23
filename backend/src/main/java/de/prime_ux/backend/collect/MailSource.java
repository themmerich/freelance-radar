package de.prime_ux.backend.collect;

import java.time.LocalDate;
import java.util.List;

/** Liefert neue Angebots-Mails; im Betrieb IMAP ({@link ImapService}), in Tests ein Stub. */
public interface MailSource {

	/** Alle Mails der konfigurierten Domain seit {@code since} (einschließlich). */
	List<FetchedMail> fetchSince(LocalDate since);
}
