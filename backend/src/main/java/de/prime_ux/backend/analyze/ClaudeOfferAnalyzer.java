package de.prime_ux.backend.analyze;

import de.prime_ux.backend.offer.Offer;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ResponseEntity;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * Bewertet Angebote per Claude (Modell und max-tokens in application.properties,
 * API-Key nur in der git-ignorierten application-local.properties). Ein einziger
 * Batch-Request pro Lauf; profile.json steht kompakt im System-Prompt
 * (Prompt-Caching-freundlich, weil über alle Läufe identisch).
 */
@Service
public class ClaudeOfferAnalyzer implements OfferAnalyzer {

	private static final String SYSTEM_PROMPT = """
		Du bist der Analyse-Agent von "Freelance Radar", einem Marktbeobachtungstool für \
		IT-Freelance-Projektangebote von freelancermap.de. Bewerte jedes übergebene Angebot \
		gegen das Nutzerprofil (JSON unten). Beachte skills, strong_match_signals und \
		weak_or_nomatch_signals.

		Für jedes Angebot:
		- matchScore: Ganzzahl 0-100. Hoch (80-100) für Angular-Lead/Architekt-Rollen im \
		Enterprise-Umfeld, remote, mit Kern-Skills des Profils. Niedrig (0-30) für \
		React/Vue/andere Stacks, reine Junior-Rollen, Pflicht-Vor-Ort-Vollzeit, reines \
		Non-Frontend.
		- matchReason: 1-2 knappe Sätze auf Deutsch, warum der Score so ausfällt.
		- seniority: junior | mid | senior | lead | architect (falls erkennbar, sonst null).
		- industry: Branche (Banking, Insurance, Public, Automotive, ...), sonst "unbekannt".
		- role: gesuchte Rolle (z.B. "Angular Entwickler", "Fullstack", "Frontend Lead").
		- country: Land des Einsatzorts als ISO-3166-Code ("DE", "AT", "CH", ...), aus \
		Ort oder Text abgeleitet (z.B. Wien -> AT, Zürich -> CH); null falls unklar.
		- skills: ALLE geforderten Technologien/Skills aus dem Text, normalisiert \
		(z.B. "Angular", "NgRx", "Spring Boot", "Kotlin", "AWS"). gap=true für Skills, \
		die NICHT im Profil vorkommen.

		Erfinde keine Daten — wenn ein Feld nicht im Text steht, nutze null bzw. eine leere \
		Liste. offerId MUSS die übergebene id des Angebots sein.

		NUTZERPROFIL:
		%s""";

	/** Antwort-Schema für den JSON-Output des Modells. */
	record AnalysisResponse(List<OfferAnalysis> analyses) {}

	/** Kompakte Angebots-Repräsentation im User-Prompt. */
	record PromptOffer(
		long id,
		String betreff,
		String agent,
		String titel,
		String firma,
		String ort,
		String remote,
		String rate,
		String start,
		String dauer,
		String text
	) {}

	private final ChatClient chatClient;
	private final AnalysisProperties properties;
	private final ObjectMapper objectMapper;
	private final String systemPrompt;

	public ClaudeOfferAnalyzer(ChatClient.Builder chatClientBuilder, AnalysisProperties properties, ObjectMapper objectMapper) {
		this.chatClient = chatClientBuilder.build();
		this.properties = properties;
		this.objectMapper = objectMapper;
		this.systemPrompt = SYSTEM_PROMPT.formatted(loadProfile());
	}

	@Override
	public AnalysisResult analyze(List<Offer> offers) {
		ResponseEntity<ChatResponse, AnalysisResponse> response = chatClient
			.prompt()
			.system(systemPrompt)
			.user("Bewerte die folgenden Angebote:\n" + objectMapper.writeValueAsString(toPromptOffers(offers)))
			.call()
			.responseEntity(AnalysisResponse.class);

		Usage usage = response.response().getMetadata().getUsage();
		List<OfferAnalysis> analyses = response.entity() == null ? List.of() : response.entity().analyses();
		return new AnalysisResult(analyses, usage.getPromptTokens(), usage.getCompletionTokens());
	}

	private List<PromptOffer> toPromptOffers(List<Offer> offers) {
		return offers
			.stream()
			.map(offer ->
				new PromptOffer(
					offer.getId(),
					offer.getSubject(),
					offer.getAgentName(),
					offer.getProjectTitle(),
					offer.getCompany(),
					offer.getLocation(),
					offer.getRemote() == null ? null : offer.getRemote().name(),
					offer.getRate(),
					offer.getStartDate(),
					offer.getDuration(),
					truncate(offer.getRawBody())
				)
			)
			.toList();
	}

	private String truncate(String body) {
		if (body == null) {
			return null;
		}
		int max = properties.promptBodyChars();
		return body.length() <= max ? body : body.substring(0, max);
	}

	private String loadProfile() {
		try {
			return new ClassPathResource("profile.json").getContentAsString(StandardCharsets.UTF_8);
		} catch (IOException e) {
			throw new UncheckedIOException("profile.json nicht lesbar", e);
		}
	}
}
