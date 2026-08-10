package de.prime_ux.backend.collect;

import de.prime_ux.backend.offer.Remote;
import de.prime_ux.backend.offer.SourceType;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Regelbasierte Auswertung einer freelancermap-Mail.
 *
 * <p>Agent-Mails haben den Betreff {@code <Agentenname> - Anzahl neue Projekte: N} und
 * 1..n Projekt-Blöcke im Body (durch {@code -----} getrennt) mit Titel, Firma, Ort,
 * Remote-Prozent, Start und einer {@code /nproj/<id>.html}-URL — die ID ist der stabile
 * Dedup-Schlüssel, wenn mehrere Agenten dasselbe Projekt einfangen. Für alle anderen
 * Mails greifen die v1-Heuristiken (Klassifizierung + grobe Feld-Extraktion).
 */
@Service
public class ParserService {

	private static final Pattern AGENT_SUBJECT = Pattern.compile("^(.{2,60}?)\\s*-\\s*Anzahl neue Projekte:\\s*\\d+");
	private static final Pattern BLOCK_SEPARATOR = Pattern.compile("(?m)^-{5,}\\s*$");
	private static final Pattern NPROJ_URL = Pattern.compile("https?://www\\.freelancermap\\.de/nproj/(\\d+)\\.html\\S*");
	/** Interne Referenz am Titelende, z.B. "(10266-20260723)" — nicht Teil des Titels. */
	private static final Pattern EXTERNAL_REF = Pattern.compile("\\s*\\(\\d+-\\d+\\)$");
	private static final Pattern BLOCK_COMPANY = Pattern.compile("(?m)^von:\\s*(.+)$");
	private static final Pattern BLOCK_LOCATION = Pattern.compile("(?m)^Ort:\\s*(.+)$");
	private static final Pattern BLOCK_REMOTE = Pattern.compile("(?m)^Remote:\\s*(\\d+)\\s*%");
	private static final Pattern BLOCK_START = Pattern.compile("(?m)^Start:\\s*(.+)$");

	private static final List<String> PRIVATE_HINTS = List.of(
		"persönliche nachricht",
		"private nachricht",
		"hat ihnen eine nachricht",
		"möchte sie kontaktieren",
		"direkt kontaktiert",
		"anfrage von",
		"nachricht von",
		"hat ihr profil",
		"interessiert an ihrem profil"
	);

	private static final List<String> AGENT_HINTS = List.of(
		"projektagent",
		"projekt-agent",
		"ihr projektagent",
		"ihr suchagent",
		"suchagent",
		"neues projekt passend",
		"passend zu ihrem suchprofil",
		"ihre projektsuche",
		"gefundene projekte",
		"neue projekte für sie"
	);

	private static final List<String> NEWSLETTER_HINTS = List.of(
		"newsletter",
		"magazin",
		"webinar",
		"blog",
		"tipps für freelancer"
	);

	private static final Pattern FALLBACK_TITLE = Pattern.compile(
		"(?:projekt|projektangebot|neues projekt)[:\\-\\s]+(.{5,120})",
		Pattern.CASE_INSENSITIVE
	);
	private static final Pattern FALLBACK_FULL_REMOTE = Pattern.compile(
		"\\b(100%\\s*remote|voll\\s*remote|remote möglich|komplett remote)\\b"
	);
	private static final Pattern FALLBACK_ONSITE = Pattern.compile("\\b(vor ort|onsite|präsenz)\\b");
	private static final Pattern FALLBACK_LOCATION = Pattern.compile(
		"(?:einsatzort|standort|ort)[:\\s]+([A-Za-zÄÖÜäöüß.\\- ]{2,40})",
		Pattern.CASE_INSENSITIVE
	);
	private static final Pattern FALLBACK_START = Pattern.compile(
		"(?:start|beginn|projektstart)[:\\s]+([A-Za-z0-9./ ]{3,25})",
		Pattern.CASE_INSENSITIVE
	);

	private final RadarProperties properties;

	public ParserService(RadarProperties properties) {
		this.properties = properties;
	}

	public ParsedMail parse(String subject, String body) {
		String trimmedSubject = subject == null ? "" : subject.strip();
		Matcher agentSubject = AGENT_SUBJECT.matcher(trimmedSubject);
		boolean isAgentSubject = agentSubject.find();
		List<ParsedProject> projects = projectBlocks(body);

		if (isAgentSubject || !projects.isEmpty()) {
			String agentName = isAgentSubject ? agentSubject.group(1).strip() : configuredAgent(lower(trimmedSubject, body));
			List<ParsedProject> result = projects.isEmpty() ? List.of(fallbackProject(trimmedSubject, body)) : projects;
			return new ParsedMail(SourceType.AGENT, agentName, result);
		}

		String lower = lower(trimmedSubject, body);
		return new ParsedMail(classify(lower), configuredAgent(lower), List.of(fallbackProject(trimmedSubject, body)));
	}

	/** Zerlegt den Body in Projekt-Blöcke; nur Blöcke mit "Erstellt:" und nproj-URL zählen. */
	private List<ParsedProject> projectBlocks(String body) {
		List<ParsedProject> projects = new ArrayList<>();
		for (String block : BLOCK_SEPARATOR.split(body == null ? "" : body)) {
			Matcher url = NPROJ_URL.matcher(block);
			if (!block.contains("Erstellt:") || !url.find()) {
				continue;
			}
			projects.add(
				new ParsedProject(
					blockTitle(block),
					firstGroup(BLOCK_COMPANY, block),
					firstGroup(BLOCK_LOCATION, block),
					remoteFromPercent(firstGroup(BLOCK_REMOTE, block)),
					firstGroup(BLOCK_START, block),
					Long.valueOf(url.group(1)),
					url.group()
				)
			);
		}
		return projects;
	}

	/** Titel = letzte nicht-leere Zeile vor "Erstellt:", ohne interne Referenz am Ende. */
	private String blockTitle(String block) {
		String title = null;
		for (String line : block.split("\\n")) {
			String stripped = line.strip();
			if (stripped.startsWith("Erstellt:")) {
				break;
			}
			if (!stripped.isEmpty()) {
				title = stripped;
			}
		}
		return title == null ? null : truncate(EXTERNAL_REF.matcher(title).replaceFirst(""), 200);
	}

	private Remote remoteFromPercent(String percent) {
		if (percent == null) {
			return null;
		}
		int value = Integer.parseInt(percent);
		if (value == 0) {
			return Remote.ONSITE;
		}
		return value >= 100 ? Remote.REMOTE : Remote.HYBRID;
	}

	private SourceType classify(String lower) {
		if (PRIVATE_HINTS.stream().anyMatch(lower::contains)) {
			return SourceType.PRIVATE;
		}
		if (AGENT_HINTS.stream().anyMatch(lower::contains)) {
			return SourceType.AGENT;
		}
		if (NEWSLETTER_HINTS.stream().anyMatch(lower::contains)) {
			return SourceType.NEWSLETTER;
		}
		return SourceType.OTHER;
	}

	private String configuredAgent(String lower) {
		return properties
			.agents()
			.stream()
			.filter(agent -> lower.contains(agent.toLowerCase(Locale.ROOT)))
			.findFirst()
			.orElse(null);
	}

	/** v1-Heuristik für Mails ohne strukturierte Projekt-Blöcke. */
	private ParsedProject fallbackProject(String subject, String body) {
		String lower = lower(subject, body);
		Matcher title = FALLBACK_TITLE.matcher(subject);
		Remote remote = null;
		if (FALLBACK_FULL_REMOTE.matcher(lower).find()) {
			remote = Remote.REMOTE;
		} else if (lower.contains("hybrid") || lower.contains("teilweise remote")) {
			remote = Remote.HYBRID;
		} else if (FALLBACK_ONSITE.matcher(lower).find()) {
			remote = Remote.ONSITE;
		}
		return new ParsedProject(
			truncate((title.find() ? title.group(1) : subject).strip(), 200),
			null,
			firstGroup(FALLBACK_LOCATION, body),
			remote,
			truncate(firstGroup(FALLBACK_START, body), 40),
			null,
			null
		);
	}

	private String lower(String subject, String body) {
		return (subject + "\n" + body).toLowerCase(Locale.ROOT);
	}

	private String firstGroup(Pattern pattern, String text) {
		Matcher matcher = pattern.matcher(text == null ? "" : text);
		return matcher.find() ? matcher.group(1).strip() : null;
	}

	private String truncate(String value, int maxLength) {
		if (value == null) {
			return null;
		}
		return value.length() <= maxLength ? value : value.substring(0, maxLength);
	}
}
