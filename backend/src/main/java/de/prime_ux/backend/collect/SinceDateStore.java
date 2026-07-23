package de.prime_ux.backend.collect;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import org.springframework.stereotype.Component;

/**
 * „Ab heute"-Merker wie in v1: Beim ersten Lauf wird das heutige Datum
 * festgeschrieben, Altbestand im Postfach bleibt ignoriert. Datei löschen = Reset.
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
			Files.createDirectories(sinceFile.getParent());
			Files.writeString(sinceFile, today.toString());
			return today;
		} catch (IOException e) {
			throw new UncheckedIOException("Startdatum-Merker " + sinceFile + " nicht lesbar/schreibbar", e);
		}
	}
}
