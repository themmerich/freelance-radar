package de.prime_ux.backend.collect;

/** Der IMAP-Abruf ist fehlgeschlagen (Verbindung, Login oder Postfachzugriff). */
public class MailFetchException extends RuntimeException {

	public MailFetchException(String message, Throwable cause) {
		super(message, cause);
	}
}
