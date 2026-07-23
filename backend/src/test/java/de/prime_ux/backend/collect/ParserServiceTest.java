package de.prime_ux.backend.collect;

import static org.assertj.core.api.Assertions.assertThat;

import de.prime_ux.backend.offer.Remote;
import de.prime_ux.backend.offer.SourceType;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

class ParserServiceTest {

	/** Nachbau einer echten Projektagent-Mail (Format vom 23.07.2026, zwei Projekte). */
	private static final String AGENT_MAIL_BODY = """
		Hallo Thomas Hemmerich,

		unser Projektagent hat neue Aufträge zu Ihrer gespeicherten Suche gefunden:


		Angular Developer (m/w/d) (10266-20260723)
		Erstellt: 23.07.2026 um 08:29 Uhr
		von: softwareXperts GmbH
		Ort: Wien
		Vertragsart: Freiberuflich
		Remote: 0 %
		Start: 07/2026

		https://www.freelancermap.de/nproj/3026991.html?utm_source=systemmail&html=0

		-----------------------------

		Senior Fullstack Developer Java/Angular (m/w/d) (10260-20260723)
		Erstellt: 23.07.2026 um 08:29 Uhr
		von: softwareXperts GmbH
		Ort: Wien
		Vertragsart: Freiberuflich
		Remote: 100 %
		Start: 07/2026

		https://www.freelancermap.de/nproj/3026990.html?utm_source=systemmail&html=0

		-----------------------------
		Sie erhalten diese Vorschläge auf Basis Ihrer aktuellen Projektagent-Einstellungen.
		https://www.freelancermap.de/edit/projektagent/177780?ref=project-agent-edit-cta

		Freelancermap GmbH
		""";

	private final ParserService parser = new ParserService(
		new RadarProperties(
			new RadarProperties.Imap("imap.gmx.net", 993, null, null),
			"freelancermap.de",
			List.of("Angular", "Architekt", "Design System", "Java Spring", "AI"),
			8000,
			Path.of(".state")
		)
	);

	@Test
	void takesTheAgentNameFromTheSubjectEvenWhenOtherAgentNamesAppearInTheBody() {
		ParsedMail parsed = parser.parse("Java Spring - Anzahl neue Projekte: 2", AGENT_MAIL_BODY);

		assertThat(parsed.sourceType()).isEqualTo(SourceType.AGENT);
		assertThat(parsed.agentName()).isEqualTo("Java Spring");
	}

	@Test
	void parsesOneProjectPerBlockWithAllStructuredFields() {
		ParsedMail parsed = parser.parse("Angular - Anzahl neue Projekte: 2", AGENT_MAIL_BODY);

		assertThat(parsed.projects()).hasSize(2);

		ParsedProject first = parsed.projects().getFirst();
		assertThat(first.title()).isEqualTo("Angular Developer (m/w/d)");
		assertThat(first.company()).isEqualTo("softwareXperts GmbH");
		assertThat(first.location()).isEqualTo("Wien");
		assertThat(first.remote()).isEqualTo(Remote.ONSITE);
		assertThat(first.startDate()).isEqualTo("07/2026");
		assertThat(first.fmProjectId()).isEqualTo(3026991L);
		assertThat(first.url()).startsWith("https://www.freelancermap.de/nproj/3026991.html");

		ParsedProject second = parsed.projects().get(1);
		assertThat(second.title()).isEqualTo("Senior Fullstack Developer Java/Angular (m/w/d)");
		assertThat(second.remote()).isEqualTo(Remote.REMOTE);
		assertThat(second.fmProjectId()).isEqualTo(3026990L);
	}

	@Test
	void classifiesAsAgentByBodyBlocksEvenWithoutTheSubjectPattern() {
		ParsedMail parsed = parser.parse("Neue Projekte für Sie", AGENT_MAIL_BODY);

		assertThat(parsed.sourceType()).isEqualTo(SourceType.AGENT);
		assertThat(parsed.projects()).hasSize(2);
	}

	@Test
	void classifiesAPrivateMessageWithTheConfiguredAgentAsFallbackName() {
		ParsedMail parsed = parser.parse(
			"Eine persönliche Nachricht für Sie",
			"Ein Interessent möchte Sie kontaktieren wegen Java Spring."
		);

		assertThat(parsed.sourceType()).isEqualTo(SourceType.PRIVATE);
		assertThat(parsed.agentName()).isEqualTo("Java Spring");
		assertThat(parsed.projects()).hasSize(1);
		assertThat(parsed.projects().getFirst().fmProjectId()).isNull();
	}

	@Test
	void classifiesNewsletterMails() {
		ParsedMail parsed = parser.parse("freelancermap Magazin", "Tipps für Freelancer im Juli.");

		assertThat(parsed.sourceType()).isEqualTo(SourceType.NEWSLETTER);
	}

	@Test
	void fallsBackToV1HeuristicsForUnstructuredMails() {
		ParsedMail parsed = parser.parse(
			"Projektangebot: Senior Angular Entwickler (m/w/d)",
			"100% Remote möglich.\nStundensatz: 95,00 € pro Stunde\nLaufzeit: 6 Monate"
		);

		assertThat(parsed.projects()).hasSize(1);
		ParsedProject project = parsed.projects().getFirst();
		assertThat(project.title()).isEqualTo("Senior Angular Entwickler (m/w/d)");
		assertThat(project.remote()).isEqualTo(Remote.REMOTE);
		assertThat(project.rate()).startsWith("95,00 €");
		assertThat(project.duration()).isEqualTo("6 Monate");
	}
}
