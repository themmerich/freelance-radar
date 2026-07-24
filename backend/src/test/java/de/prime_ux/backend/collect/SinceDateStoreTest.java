package de.prime_ux.backend.collect;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SinceDateStoreTest {

	@TempDir
	Path tempDir;

	private SinceDateStore store() {
		return new SinceDateStore(
			new RadarProperties(new RadarProperties.Imap("imap.gmx.net", 993, null, null), "freelancermap.de", List.of(), 8000, tempDir)
		);
	}

	@Test
	void initializesWithTodayOnFirstAccessAndSticksToIt() {
		SinceDateStore store = store();

		assertThat(store.get()).isEqualTo(LocalDate.now());
		// Zweiter Zugriff liest die Datei statt neu zu initialisieren.
		assertThat(store().get()).isEqualTo(LocalDate.now());
	}

	@Test
	void advancesForwardButNeverBack() {
		SinceDateStore store = store();
		LocalDate today = store.get();

		store.advanceTo(today.plusDays(2));
		assertThat(store.get()).isEqualTo(today.plusDays(2));

		store.advanceTo(today.minusDays(5));
		assertThat(store.get()).isEqualTo(today.plusDays(2));
	}
}
