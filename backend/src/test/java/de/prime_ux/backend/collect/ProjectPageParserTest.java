package de.prime_ux.backend.collect;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

class ProjectPageParserTest {

	private final ProjectPageParser parser = new ProjectPageParser();

	/** Ausschnitte echter Seiten (Faktenzeile + Beschreibung), gekürzt abgelegt. */
	private static String fixture(String name) {
		try {
			return new ClassPathResource("projectpages/" + name).getContentAsString(StandardCharsets.UTF_8);
		} catch (IOException e) {
			throw new UncheckedIOException(e);
		}
	}

	/** Faktenzeile mit frei wählbaren Badges — für Fälle, die keine echte Seite hergibt. */
	private static String page(String... badges) {
		return "<html><body><div class=\"project-header-info-list\">" + String.join("", badges) + "</div></body></html>";
	}

	private static String badge(String icon, String text) {
		return "<span class=\"badge badge-gray\"><i class=\"far " + icon + "\"></i>" + text + "</span>";
	}

	@Test
	void readsEveryFactFromARealPage() {
		ProjectDetails details = parser.parse(fixture("full-with-rate.html"));

		assertThat(details.budgetEur()).isEqualByComparingTo("70.00");
		assertThat(details.utilizationPercent()).isEqualTo(100);
		assertThat(details.remotePercent()).isEqualTo(100);
		assertThat(details.contractType()).isEqualTo("Freiberuflich");
		assertThat(details.startImmediate()).isTrue();
		assertThat(details.startMonth()).isNull();
		// Diese Seite nennt keine Dauer — fehlende Badges sind der Normalfall.
		assertThat(details.durationMonths()).isNull();
		assertThat(details.description()).contains("QA Engineer");
	}

	@Test
	void readsTheDurationAndLeavesTheRateEmptyWhenTheBudgetIsMissing() {
		ProjectDetails details = parser.parse(fixture("with-duration-no-rate.html"));

		assertThat(details.durationMonths()).isEqualTo(6);
		// Ein fehlendes Budget ist null, nicht 0 — sonst zöge es jeden Schnitt nach unten.
		assertThat(details.budgetEur()).isNull();
	}

	@Test
	void treatsAZeroBudgetAsNoStatementAtAll() {
		// Kommt echt vor: das Feld wurde leer gelassen und die Seite zeigt „0,00 €".
		assertThat(parser.parse(page(badge("fa-euro-sign", "0,00 € Budget"))).budgetEur()).isNull();
	}

	@Test
	void readsTheStartMonthAsTheFirstOfThatMonth() {
		ProjectDetails details = parser.parse(page(badge("fa-calendar", "Start 9/2026")));

		assertThat(details.startMonth()).isEqualTo(LocalDate.of(2026, 9, 1));
		assertThat(details.startImmediate()).isFalse();
	}

	@Test
	void convertsYearsToMonths() {
		assertThat(parser.parse(page(badge("fa-hourglass", "Dauer 1 Jahr"))).durationMonths()).isEqualTo(12);
	}

	@Test
	void keepsThousandsAndDecimalsApartInTheGermanNumberFormat() {
		assertThat(parser.parse(page(badge("fa-euro-sign", "1.250,50 € Budget"))).budgetEur())
			.isEqualByComparingTo(new BigDecimal("1250.50"));
	}

	@Test
	void returnsNothingRatherThanGuessingOnAnUnknownWording() {
		ProjectDetails details = parser.parse(page(badge("fa-hourglass", "Dauer langfristig"), badge("fa-calendar", "Start demnächst")));

		assertThat(details.durationMonths()).isNull();
		assertThat(details.startMonth()).isNull();
		assertThat(details.startImmediate()).isFalse();
	}

	@Test
	void survivesAPageWithoutAnyOfTheExpectedMarkup() {
		ProjectDetails details = parser.parse("<html><body><p>Wartungsarbeiten</p></body></html>");

		assertThat(details.budgetEur()).isNull();
		assertThat(details.durationMonths()).isNull();
		assertThat(details.contractType()).isNull();
		assertThat(details.description()).isNull();
	}

	@Test
	void dropsTheHeadingFromTheDescription() {
		String html = "<html><body><div class=\"project-body-description\"><h2>Beschreibung</h2><p>Für ein Projekt suchen wir…</p></div></body></html>";

		assertThat(parser.parse(html).description()).isEqualTo("Für ein Projekt suchen wir…");
	}
}
