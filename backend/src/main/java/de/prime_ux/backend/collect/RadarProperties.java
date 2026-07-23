package de.prime_ux.backend.collect;

import java.nio.file.Path;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Konfiguration des Mail-Abrufs. Zugangsdaten kommen aus der git-ignorierten
 * application-local.properties (siehe backend/AGENTS.md — niemals committen).
 */
@ConfigurationProperties(prefix = "radar")
public record RadarProperties(
	Imap imap,
	/** Nur Mails von dieser Absender-Domain werden verarbeitet. */
	String mailDomain,
	/** Namen der freelancermap-Suchagenten, die die Heuristik im Mailtext matcht. */
	List<String> agents,
	/** Klartext-Body wird vor dem Speichern auf diese Länge gekürzt. */
	int maxBodyChars,
	/** Ablage des Startdatum-Merkers („ab heute"; Datei löschen = Reset). */
	Path stateDir
) {
	public record Imap(String host, int port, String email, String password) {}
}
