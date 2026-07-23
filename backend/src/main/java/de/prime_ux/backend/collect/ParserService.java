package de.prime_ux.backend.collect;

import de.prime_ux.backend.offer.Remote;
import de.prime_ux.backend.offer.SourceType;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Regelbasierte Erstauswertung einer Mail (portiert aus v1 collect.py):
 * Klassifizierung Agent/Privat/Newsletter, Zuordnung zu einem der konfigurierten
 * Suchagenten und grobe Feld-Extraktion. Das LLM verfeinert ab Phase 2.
 */
@Service
public class ParserService {

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

	private static final List<String> NEWSLETTER_HINTS = List.of(
		"newsletter",
		"magazin",
		"webinar",
		"blog",
		"tipps für freelancer"
	);

	private static final Pattern AGENT_NAME = Pattern.compile(
		"(?:suchagent|projektagent|suchprofil)[:\\s\"»]+([\\wÄÖÜäöüß/+\\- ]{3,40})",
		Pattern.CASE_INSENSITIVE
	);
	private static final Pattern TITLE = Pattern.compile(
		"(?:projekt|projektangebot|neues projekt)[:\\-\\s]+(.{5,120})",
		Pattern.CASE_INSENSITIVE
	);
	private static final Pattern FULL_REMOTE = Pattern.compile(
		"\\b(100%\\s*remote|voll\\s*remote|remote möglich|komplett remote)\\b"
	);
	private static final Pattern ONSITE = Pattern.compile("\\b(vor ort|onsite|präsenz)\\b");
	private static final Pattern LOCATION = Pattern.compile(
		"(?:einsatzort|standort|ort)[:\\s]+([A-Za-zÄÖÜäöüß.\\- ]{2,40})",
		Pattern.CASE_INSENSITIVE
	);
	private static final Pattern RATE = Pattern.compile(
		"(?:stundensatz|tagessatz|rate|vergütung)[:\\s]*([0-9.,]+\\s*(?:€|eur)[^\\n]{0,20})",
		Pattern.CASE_INSENSITIVE
	);
	private static final Pattern START = Pattern.compile(
		"(?:start|beginn|projektstart)[:\\s]+([A-Za-z0-9./ ]{3,25})",
		Pattern.CASE_INSENSITIVE
	);
	private static final Pattern DURATION = Pattern.compile(
		"(?:dauer|laufzeit|projektdauer)[:\\s]+([A-Za-z0-9./ ]{2,30})",
		Pattern.CASE_INSENSITIVE
	);

	private final RadarProperties properties;

	public ParserService(RadarProperties properties) {
		this.properties = properties;
	}

	public ParsedOffer parse(String subject, String body) {
		String text = subject + "\n" + body;
		String lower = text.toLowerCase(Locale.ROOT);

		return new ParsedOffer(
			classify(lower),
			agentName(text, lower),
			projectTitle(subject),
			firstGroup(LOCATION, body),
			remote(lower),
			truncate(firstGroup(RATE, body), 60),
			truncate(firstGroup(START, body), 40),
			truncate(firstGroup(DURATION, body), 40)
		);
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

	/** Bevorzugt einen der konfigurierten Agenten-Namen; sonst das v1-Regex-Muster. */
	private String agentName(String text, String lower) {
		for (String agent : properties.agents()) {
			if (lower.contains(agent.toLowerCase(Locale.ROOT))) {
				return agent;
			}
		}
		Matcher matcher = AGENT_NAME.matcher(text);
		return matcher.find() ? matcher.group(1).strip() : null;
	}

	private String projectTitle(String subject) {
		Matcher matcher = TITLE.matcher(subject);
		String title = matcher.find() ? matcher.group(1) : subject;
		return truncate(title.strip(), 200);
	}

	private Remote remote(String lower) {
		if (FULL_REMOTE.matcher(lower).find()) {
			return Remote.REMOTE;
		}
		if (lower.contains("hybrid") || lower.contains("teilweise remote")) {
			return Remote.HYBRID;
		}
		if (ONSITE.matcher(lower).find()) {
			return Remote.ONSITE;
		}
		return null;
	}

	private String firstGroup(Pattern pattern, String body) {
		Matcher matcher = pattern.matcher(body);
		return matcher.find() ? matcher.group(1).strip() : null;
	}

	private String truncate(String value, int maxLength) {
		if (value == null) {
			return null;
		}
		return value.length() <= maxLength ? value : value.substring(0, maxLength);
	}
}
