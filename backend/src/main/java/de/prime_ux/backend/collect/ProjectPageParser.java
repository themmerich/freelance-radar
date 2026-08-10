package de.prime_ux.backend.collect;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

/**
 * Liest die Fakten aus einer Projekt-Detailseite von freelancermap.
 *
 * Die Faktenzeile im Seitenkopf (`project-header-info-list`) besteht aus Badges, die
 * ihren Typ über die Icon-Klasse tragen — `fa-euro-sign` für den Stundensatz,
 * `fa-hourglass` für die Dauer und so fort. Deshalb wird über die Icon-Klasse gesucht
 * und nicht über die Position: die Badges fehlen einzeln, je nachdem was der Einsteller
 * ausgefüllt hat.
 *
 * Erfindet nichts: was nicht dasteht oder nicht zum erwarteten Muster passt, bleibt null.
 */
@Component
public class ProjectPageParser {

	private static final String FACTS = "div.project-header-info-list .badge";
	private static final String DESCRIPTION = "div.project-body-description";

	/** „70,00 €" oder „1.250,50 €" — deutsches Zahlenformat mit Tausenderpunkt. */
	private static final Pattern MONEY = Pattern.compile("([0-9.]+,[0-9]{2}|[0-9]+)\\s*€");
	private static final Pattern MONTHS = Pattern.compile("(\\d+)\\s*Monat");
	private static final Pattern YEARS = Pattern.compile("(\\d+)\\s*Jahr");
	private static final Pattern PERCENT = Pattern.compile("(\\d+)\\s*%");
	private static final Pattern START_MONTH = Pattern.compile("(\\d{1,2})/(\\d{4})");

	public ProjectDetails parse(String html) {
		Document document = Jsoup.parse(html);

		String start = badgeText(document, "fa-calendar");
		return new ProjectDetails(
			budget(badgeText(document, "fa-euro-sign")),
			months(badgeText(document, "fa-hourglass")),
			percent(badgeText(document, "fa-briefcase")),
			percent(badgeText(document, "fa-car-side")),
			trimmed(badgeText(document, "fa-file-contract")),
			startMonth(start),
			start != null && start.toLowerCase().contains("ab sofort"),
			description(document)
		);
	}

	/** Text des Badges, dessen Icon die gesuchte Klasse trägt; null, wenn es fehlt. */
	private String badgeText(Document document, String iconClass) {
		for (Element badge : document.select(FACTS)) {
			if (!badge.select("i." + iconClass).isEmpty()) {
				return badge.text();
			}
		}
		return null;
	}

	/**
	 * Rohwert des Budget-Badges. Ohne Einheit auf der Seite bleibt die Einordnung
	 * (Stunden-, Tagessatz, Gesamtsumme) dem `BudgetKind` überlassen. 0 € ist ein leer
	 * gelassenes Feld und damit keine Angabe.
	 */
	private BigDecimal budget(String text) {
		Matcher matcher = match(MONEY, text);
		if (matcher == null) {
			return null;
		}
		String number = matcher.group(1).replace(".", "").replace(',', '.');
		BigDecimal budget = new BigDecimal(number);
		return budget.signum() <= 0 ? null : budget;
	}

	/** „Dauer 6 Monate" → 6, „Dauer 1 Jahr" → 12; alles andere null statt Rateversuch. */
	private Integer months(String text) {
		Matcher months = match(MONTHS, text);
		if (months != null) {
			return Integer.valueOf(months.group(1));
		}
		Matcher years = match(YEARS, text);
		return years == null ? null : Integer.valueOf(years.group(1)) * 12;
	}

	private Integer percent(String text) {
		Matcher matcher = match(PERCENT, text);
		return matcher == null ? null : Integer.valueOf(matcher.group(1));
	}

	/** „Start 9/2026" → 2026-09-01; „ab sofort" trägt kein Datum. */
	private LocalDate startMonth(String text) {
		Matcher matcher = match(START_MONTH, text);
		if (matcher == null) {
			return null;
		}
		int month = Integer.parseInt(matcher.group(1));
		if (month < 1 || month > 12) {
			return null;
		}
		return LocalDate.of(Integer.parseInt(matcher.group(2)), month, 1);
	}

	private String description(Document document) {
		Element block = document.selectFirst(DESCRIPTION);
		if (block == null) {
			return null;
		}
		// Die Überschrift „Beschreibung" steht mit im Block und gehört nicht in den Prompt.
		block.select("h1, h2, h3").remove();
		return trimmed(block.text());
	}

	private Matcher match(Pattern pattern, String text) {
		if (text == null) {
			return null;
		}
		Matcher matcher = pattern.matcher(text);
		return matcher.find() ? matcher : null;
	}

	private String trimmed(String text) {
		if (text == null) {
			return null;
		}
		String trimmed = text.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}
}
