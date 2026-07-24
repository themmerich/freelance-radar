package de.prime_ux.backend.analyze;

import de.prime_ux.backend.offer.Offer;
import de.prime_ux.backend.profile.Profile;
import java.util.List;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.ResponseEntity;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * Bewertet Angebote per Claude (Modell und max-tokens in application.properties,
 * API-Key nur in der git-ignorierten application-local.properties). Ein einziger
 * Batch-Request pro Lauf; das Profil steht als kompaktes JSON im System-Prompt —
 * pro Profil byte-identisch über alle Läufe (Prompt-Caching-freundlich).
 */
@Service
public class ClaudeOfferAnalyzer implements OfferAnalyzer {

	private static final String SYSTEM_PROMPT = """
		Du bist der Analyse-Agent von "Freelance Radar", einem Marktbeobachtungstool für \
		IT-Freelance-Projektangebote von freelancermap.de. Bewerte jedes übergebene Angebot \
		gegen das Nutzerprofil (JSON unten). Beachte skills, strong_match_signals und \
		weak_or_nomatch_signals.

		Für jedes Angebot:
		- matchScore: Ganzzahl 0-100. Hoch (80-100) für Rollen, die Profil-Rolle und \
		Kern-Skills treffen, remote-freundlich im Enterprise-Umfeld. Niedrig (0-30) für \
		andere Stacks, reine Junior-Rollen, Pflicht-Vor-Ort-Vollzeit oder Rollen, die \
		den weak_or_nomatch_signals entsprechen.
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
	record AnalysisResponse(List<OfferAssessment> analyses) {}

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

	/** Profil-Repräsentation im System-Prompt (Feldnamen wie im v1-profile.json). */
	record PromptProfile(
		String name,
		String role,
		String focus,
		String industries,
		String region,
		String languages,
		Object skills,
		Object strong_match_signals,
		Object weak_or_nomatch_signals
	) {}

	private final ChatClient chatClient;
	private final AnalysisProperties properties;
	private final ObjectMapper objectMapper;

	public ClaudeOfferAnalyzer(ChatClient.Builder chatClientBuilder, AnalysisProperties properties, ObjectMapper objectMapper) {
		this.chatClient = chatClientBuilder.build();
		this.properties = properties;
		this.objectMapper = objectMapper;
	}

	@Override
	public AnalysisResult analyze(Profile profile, List<Offer> offers) {
		ResponseEntity<ChatResponse, AnalysisResponse> response = chatClient
			.prompt()
			.system(SYSTEM_PROMPT.formatted(profileJson(profile)))
			.user("Bewerte die folgenden Angebote:\n" + objectMapper.writeValueAsString(toPromptOffers(offers)))
			.call()
			.responseEntity(AnalysisResponse.class);

		Usage usage = response.response().getMetadata().getUsage();
		List<OfferAssessment> assessments = response.entity() == null ? List.of() : response.entity().analyses();
		return new AnalysisResult(assessments, usage.getPromptTokens(), usage.getCompletionTokens());
	}

	private String profileJson(Profile profile) {
		return objectMapper.writeValueAsString(
			new PromptProfile(
				profile.getName(),
				profile.getRole(),
				profile.getFocus(),
				profile.getIndustries(),
				profile.getRegion(),
				profile.getLanguages(),
				objectMapper.readTree(profile.getSkillsJson()),
				objectMapper.readTree(profile.getStrongSignalsJson()),
				objectMapper.readTree(profile.getWeakSignalsJson())
			)
		);
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
}
