package de.prime_ux.backend.collect;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import org.springframework.stereotype.Component;

/**
 * Startdatum-Merker: Beim ersten Lauf wird das heutige Datum festgeschrieben
 * („ab heute", Altbestand im Postfach bleibt ignoriert; Datei löschen = Reset).
 * Nach jedem erfolgreichen Lauf rückt der Merker auf das Datum der jüngsten
 * Mail vor — abgerufene Mails dürfen danach aus dem Postfach gelöscht werden,
 * ohne dass das Radar etwas verliert.
 */
@Component
public class SinceDateStore {

	private final Path sinceFile;

	public SinceDateStore(RadarProperties properties) {
		this.sinceFile = properties.stateDir().resolve("since-date.txt");
	}

	public LocalDate get() {
		try {
			if (Files.exists(sinceFile)) {
				return LocalDate.parse(Files.readString(sinceFile).strip());
			}
			LocalDate today = LocalDate.now();
			write(today);
			return today;
		} catch (IOException e) {
			throw new UncheckedIOException("Startdatum-Merker " + sinceFile + " nicht lesbar/schreibbar", e);
		}
	}

	/**
	 * Rückt den Merker auf {@code date} vor, nie zurück. Bewusst nur bis zum Tag
	 * der jüngsten Mail (nicht Tag + 1): IMAP-SINCE arbeitet tagesgenau und
	 * inklusiv, so bleiben später am selben Tag eintreffende Mails auffindbar —
	 * die Message-ID-Dedup filtert die dabei erneut gesehenen.
	 */
	public void advanceTo(LocalDate date) {
		if (date.isAfter(get())) {
			try {
				write(date);
			} catch (IOException e) {
				throw new UncheckedIOException("Startdatum-Merker " + sinceFile + " nicht schreibbar", e);
			}
		}
	}

	private void write(LocalDate date) throws IOException {
		Files.createDirectories(sinceFile.getParent());
		Files.writeString(sinceFile, date.toString());
	}
}
