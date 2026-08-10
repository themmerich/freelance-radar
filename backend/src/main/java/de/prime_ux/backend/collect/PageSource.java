package de.prime_ux.backend.collect;

/**
 * Holt eine Projekt-Detailseite; im Betrieb über HTTP ({@link HttpPageSource}), in Tests
 * ein Stub — Tests gehen nie ins Netz (siehe backend/AGENTS.md, gleiches Muster wie
 * {@link MailSource}).
 */
public interface PageSource {
	/**
	 * Lädt die Seite hinter {@code url}.
	 *
	 * @return das HTML, oder ein Fehlschlag mit Begründung — geworfen wird nichts, ein
	 *     unerreichbares Projekt darf den Collect-Lauf nicht abbrechen.
	 */
	PageResult fetch(String url);

	/** Ergebnis eines Abrufs: entweder HTML oder die Einordnung, warum es keins gibt. */
	sealed interface PageResult {
		record Html(String html) implements PageResult {}

		/** Projekt existiert nicht mehr (404/410) — ein erneuter Versuch lohnt nicht. */
		record Gone() implements PageResult {}

		/** Timeout, 5xx, Netzfehler — der nächste Lauf versucht es wieder. */
		record Failed(String reason) implements PageResult {}
	}
}
