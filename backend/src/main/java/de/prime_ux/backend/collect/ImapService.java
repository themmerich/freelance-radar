package de.prime_ux.backend.collect;

import jakarta.mail.Address;
import jakarta.mail.Folder;
import jakarta.mail.Message;
import jakarta.mail.MessagingException;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.Store;
import jakarta.mail.internet.MimeMessage;
import jakarta.mail.internet.MimeUtility;
import jakarta.mail.search.AndTerm;
import jakarta.mail.search.ComparisonTerm;
import jakarta.mail.search.FromStringTerm;
import jakarta.mail.search.ReceivedDateTerm;
import jakarta.mail.search.SearchTerm;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import org.springframework.stereotype.Service;

/**
 * Holt Angebots-Mails per IMAPS aus dem GMX-Postfach. Server-seitig wird auf
 * Empfangsdatum und Absender-Domain gefiltert; die Domain wird nach dem Abruf
 * noch einmal lokal geprüft (FROM-Suche matcht auch Display-Namen).
 */
@Service
public class ImapService implements MailSource {

	private final RadarProperties properties;

	public ImapService(RadarProperties properties) {
		this.properties = properties;
	}

	@Override
	public List<FetchedMail> fetchSince(LocalDate since) {
		RadarProperties.Imap imap = properties.imap();
		Properties sessionProperties = new Properties();
		sessionProperties.put("mail.store.protocol", "imaps");
		Session session = Session.getInstance(sessionProperties);

		try (Store store = session.getStore("imaps")) {
			store.connect(imap.host(), imap.port(), imap.email(), imap.password());
			try (Folder inbox = store.getFolder("INBOX")) {
				inbox.open(Folder.READ_ONLY);
				Date sinceDate = Date.from(since.atStartOfDay(ZoneId.systemDefault()).toInstant());
				SearchTerm criteria = new AndTerm(
					new ReceivedDateTerm(ComparisonTerm.GE, sinceDate),
					new FromStringTerm(properties.mailDomain())
				);

				List<FetchedMail> mails = new ArrayList<>();
				for (Message message : inbox.search(criteria)) {
					FetchedMail mail = toFetchedMail(message);
					if (mail != null) {
						mails.add(mail);
					}
				}
				return mails;
			}
		} catch (MessagingException e) {
			throw new MailFetchException("IMAP-Abruf von " + imap.host() + " fehlgeschlagen", e);
		}
	}

	private FetchedMail toFetchedMail(Message message) throws MessagingException {
		String fromAddr = firstFrom(message);
		// Sicherheits-Recheck: Domain wirklich die konfigurierte?
		if (!fromAddr.toLowerCase(Locale.ROOT).contains(properties.mailDomain().toLowerCase(Locale.ROOT))) {
			return null;
		}

		String messageId = message instanceof MimeMessage mime && mime.getMessageID() != null
			? mime.getMessageID().strip()
			: "nomsgid-" + message.getMessageNumber();
		Date received = message.getReceivedDate() != null ? message.getReceivedDate() : message.getSentDate();
		Instant receivedAt = received != null ? received.toInstant() : Instant.now();
		String subject = decode(message.getSubject());

		return new FetchedMail(messageId, fromAddr, subject, receivedAt, extractBody(message));
	}

	private String firstFrom(Message message) throws MessagingException {
		Address[] from = message.getFrom();
		return from != null && from.length > 0 ? decode(from[0].toString()) : "";
	}

	private String decode(String raw) {
		if (raw == null) {
			return "";
		}
		try {
			return MimeUtility.decodeText(raw);
		} catch (IOException e) {
			return raw;
		}
	}

	/** Bevorzugt text/plain; fällt auf grob enttaggtes text/html zurück. */
	private String extractBody(Part part) throws MessagingException {
		String plain = findText(part, "text/plain");
		if (plain != null) {
			return normalize(plain);
		}
		String html = findText(part, "text/html");
		if (html != null) {
			return normalize(html.replaceAll("<[^>]+>", " ").replace("&nbsp;", " ").replace("&amp;", "&"));
		}
		return "";
	}

	private String findText(Part part, String mimeType) throws MessagingException {
		try {
			if (part.isMimeType(mimeType) && !Part.ATTACHMENT.equalsIgnoreCase(part.getDisposition())) {
				Object content = part.getContent();
				return content instanceof String text ? text : null;
			}
			if (part.getContent() instanceof Multipart multipart) {
				for (int i = 0; i < multipart.getCount(); i++) {
					String text = findText(multipart.getBodyPart(i), mimeType);
					if (text != null) {
						return text;
					}
				}
			}
		} catch (IOException e) {
			return null;
		}
		return null;
	}

	private String normalize(String body) {
		return body.replaceAll("[ \\t]+", " ").replaceAll("\\n{3,}", "\n\n").strip();
	}
}
