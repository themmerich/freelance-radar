package de.prime_ux.backend.collect;

import static org.assertj.core.api.Assertions.assertThat;

import de.prime_ux.backend.offer.Remote;
import de.prime_ux.backend.offer.SourceType;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

class ParserServiceTest {

	private final ParserService parser = new ParserService(
		new RadarProperties(
			new RadarProperties.Imap("imap.gmx.net", 993, null, null),
			"freelancermap.de",
			List.of("Angular", "Architekt", "Design System", "Java Spring", "KI/GenAI"),
			8000,
			Path.of(".state")
		)
	);

	@Test
	void classifiesASearchAgentMailAndMatchesTheConfiguredAgent() {
		ParsedOffer parsed = parser.parse(
			"Neues Projekt passend zu Ihrem Suchprofil \"Angular\"",
			"Ihr Suchagent Angular hat ein Projekt gefunden.\nEinsatzort: München\nStart: 01.09.2026"
		);

		assertThat(parsed.sourceType()).isEqualTo(SourceType.AGENT);
		assertThat(parsed.agentName()).isEqualTo("Angular");
		assertThat(parsed.location()).isEqualTo("München");
		assertThat(parsed.startDate()).isEqualTo("01.09.2026");
	}

	@Test
	void classifiesAPrivateMessageEvenWhenAnAgentNameAppears() {
		ParsedOffer parsed = parser.parse(
			"Eine persönliche Nachricht für Sie",
			"Ein Interessent möchte Sie kontaktieren wegen Java Spring."
		);

		assertThat(parsed.sourceType()).isEqualTo(SourceType.PRIVATE);
		assertThat(parsed.agentName()).isEqualTo("Java Spring");
	}

	@Test
	void classifiesNewsletterMails() {
		ParsedOffer parsed = parser.parse("freelancermap Magazin", "Tipps für Freelancer im Juli.");

		assertThat(parsed.sourceType()).isEqualTo(SourceType.NEWSLETTER);
		assertThat(parsed.agentName()).isNull();
	}

	@Test
	void extractsTitleRemoteRateAndDuration() {
		ParsedOffer parsed = parser.parse(
			"Projektangebot: Senior Angular Entwickler (m/w/d)",
			"100% Remote möglich.\nStundensatz: 95,00 € pro Stunde\nLaufzeit: 6 Monate"
		);

		assertThat(parsed.projectTitle()).isEqualTo("Senior Angular Entwickler (m/w/d)");
		assertThat(parsed.remote()).isEqualTo(Remote.REMOTE);
		assertThat(parsed.rate()).startsWith("95,00 €");
		assertThat(parsed.duration()).isEqualTo("6 Monate");
	}

	@Test
	void fallsBackToTheSubjectAsTitleAndLeavesUnknownFieldsNull() {
		ParsedOffer parsed = parser.parse("Fullstack Entwickler gesucht", "Kein strukturierter Inhalt.");

		assertThat(parsed.sourceType()).isEqualTo(SourceType.OTHER);
		assertThat(parsed.projectTitle()).isEqualTo("Fullstack Entwickler gesucht");
		assertThat(parsed.location()).isNull();
		assertThat(parsed.remote()).isNull();
		assertThat(parsed.rate()).isNull();
	}
}
