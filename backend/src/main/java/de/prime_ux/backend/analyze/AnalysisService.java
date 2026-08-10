package de.prime_ux.backend.analyze;

import de.prime_ux.backend.offer.Offer;
import de.prime_ux.backend.offer.OfferAnalysis;
import de.prime_ux.backend.offer.OfferAnalysisRepository;
import de.prime_ux.backend.offer.OfferAnalysisSkill;
import de.prime_ux.backend.offer.OfferAnalysisSkillRepository;
import de.prime_ux.backend.offer.OfferRepository;
import de.prime_ux.backend.profile.Profile;
import de.prime_ux.backend.profile.ProfileNotFoundException;
import de.prime_ux.backend.profile.ProfileRepository;
import de.prime_ux.backend.run.Run;
import de.prime_ux.backend.run.RunRepository;
import de.prime_ux.backend.run.TokenTotals;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Analysiert Angebote gegen ein Profil: standardmäßig nur primäre Einträge ohne
 * Ergebnis für genau dieses Profil (Kopien anderer Agenten kosten nie Tokens),
 * gedeckelt auf radar.analysis.max-offers-per-run pro Profil. Ergebnis und
 * Token-Verbrauch landen am Run; Ergebnisse anderer Profile bleiben unberührt
 * nebeneinander bestehen. Ein Abruf-Lauf analysiert automatisch gegen alle
 * Profile, nicht nur das aktive. Mit {@code force} zählen bei einer Re-Analyse
 * auch bereits bewertete Angebote als Kandidaten — für den Fall, dass sich das
 * Profil geändert hat und seine alten Ergebnisse damit veraltet sind.
 */
@Service
public class AnalysisService {

	/** Konservative Defaults, solange noch kein Lauf mit Analysen protokolliert ist. */
	private static final long FALLBACK_INPUT_TOKENS_PER_OFFER = 800;
	private static final long FALLBACK_OUTPUT_TOKENS_PER_OFFER = 170;

	private final OfferAnalyzer analyzer;
	private final OfferRepository offers;
	private final OfferAnalysisRepository analyses;
	private final OfferAnalysisSkillRepository skills;
	private final ProfileRepository profiles;
	private final RunRepository runs;
	private final AnalysisProperties properties;

	public AnalysisService(
		OfferAnalyzer analyzer,
		OfferRepository offers,
		OfferAnalysisRepository analyses,
		OfferAnalysisSkillRepository skills,
		ProfileRepository profiles,
		RunRepository runs,
		AnalysisProperties properties
	) {
		this.analyzer = analyzer;
		this.offers = offers;
		this.analyses = analyses;
		this.skills = skills;
		this.profiles = profiles;
		this.runs = runs;
		this.properties = properties;
	}

	/**
	 * Nach einem Abruf-Lauf: neue Angebote gegen alle Profile bewerten, nicht nur das
	 * aktive — sonst bleibt die Ansicht der anderen Profile leer, bis jemand händisch
	 * nachanalysiert. Jedes Profil zählt einzeln gegen den Kostendeckel.
	 */
	@Transactional
	public void analyzeNewOffers(Long runId) {
		// Über die ID statt über die Instanz: der Aufrufer orchestriert ohne Transaktion,
		// eine übergebene Run-Instanz wäre hier detached und ihre Änderungen verpufften.
		Run run = runs.findById(runId).orElseThrow();
		int analyzed = 0;
		long inputTokens = 0;
		long outputTokens = 0;
		for (Profile profile : profiles.findAll()) {
			AnalysisOutcome outcome = analyze(profile, Instant.EPOCH, false, true);
			analyzed += outcome.analyzed();
			inputTokens += outcome.inputTokens();
			outputTokens += outcome.outputTokens();
			if (outcome.leftover() > 0) {
				run.setNote(run.getNote() + "; deckel=" + properties.maxOffersPerRun() + ", offen(" + profile.getName() + ")=" + outcome.leftover());
			}
		}
		run.setAnalyzedOffers(analyzed);
		run.setInputTokens(inputTokens);
		run.setOutputTokens(outputTokens);
	}

	/**
	 * Re-Analyse „Bestand gegen Profil X bewerten", optional auf ein Zeitfenster begrenzt.
	 * Ohne {@code force} zählen nur noch unbewertete Angebote (die alte „Rest auffüllen"-Funktion);
	 * mit {@code force} auch bereits bewertete — für den Fall, dass sich das Profil geändert hat
	 * und seine bisherigen Ergebnisse damit veraltet sind.
	 *
	 * <p>Der gesamte Bestand (kein Zeitfenster) läuft bewusst ohne Kostendeckel durch: die
	 * Oberfläche zeigt vorher die geschätzten Kosten und lässt sie bestätigen. Ein Zeitfenster
	 * bleibt gedeckelt.
	 */
	@Transactional
	public Run reanalyze(Long profileId, Integer days, boolean force) {
		Profile profile = profiles.findById(profileId).orElseThrow(() -> new ProfileNotFoundException(profileId));
		String note = (force ? "reanalyse (erzwungen) profil=" : "reanalyse profil=") + profile.getName() + (days == null ? "" : ", tage=" + days);
		Run run = runs.save(new Run(0, 0, note));
		AnalysisOutcome outcome = analyze(profile, since(days), force, days != null);
		run.setAnalyzedOffers(outcome.analyzed());
		run.setInputTokens(outcome.inputTokens());
		run.setOutputTokens(outcome.outputTokens());
		if (outcome.leftover() > 0) {
			run.setNote(run.getNote() + "; deckel=" + properties.maxOffersPerRun() + ", offen=" + outcome.leftover());
		}
		return run;
	}

	/** Anzahl der Kandidaten für Profil + Zeitfenster (Kostenvorschau); mit {@code force} auch bereits bewertete. */
	public int countCandidates(Long profileId, Integer days, boolean force) {
		profiles.findById(profileId).orElseThrow(() -> new ProfileNotFoundException(profileId));
		return candidatesFor(profileId, since(days), force).size();
	}

	/** Kostenvorschau: Kandidaten × Ø-Tokens der bisherigen Läufe. */
	public AnalysisPreview preview(Long profileId, Integer days, boolean force) {
		int candidates = countCandidates(profileId, days, force);
		TokenTotals totals = runs.tokenTotals();
		long inputPerOffer = totals.analyzedOffers() > 0 ? totals.inputTokens() / totals.analyzedOffers() : FALLBACK_INPUT_TOKENS_PER_OFFER;
		long outputPerOffer = totals.analyzedOffers() > 0
			? totals.outputTokens() / totals.analyzedOffers()
			: FALLBACK_OUTPUT_TOKENS_PER_OFFER;
		return new AnalysisPreview(candidates, candidates * inputPerOffer, candidates * outputPerOffer);
	}

	private Instant since(Integer days) {
		if (days == null) {
			return Instant.EPOCH;
		}
		return LocalDate.now().minusDays(days - 1L).atStartOfDay(ZoneId.systemDefault()).toInstant();
	}

	/** Ergebnis eines einzelnen Analyse-Durchlaufs für genau ein Profil. */
	private record AnalysisOutcome(int analyzed, long inputTokens, long outputTokens, int leftover) {
		private static final AnalysisOutcome EMPTY = new AnalysisOutcome(0, 0, 0, 0);
	}

	private List<Offer> candidatesFor(Long profileId, Instant since, boolean force) {
		return force ? offers.findPrimarySince(since) : offers.findUnanalyzedPrimarySince(profileId, since);
	}

	/**
	 * Bewertet die Kandidaten in Batches von radar.analysis.max-offers-per-run. Mit
	 * {@code capped} bleibt es bei einem Batch, der Rest wird als offen gemeldet; ohne
	 * Deckel laufen alle Kandidaten durch — weiterhin batchweise, denn ein Request mit
	 * allen Angeboten würde das Antwort-Token-Limit des Modells sprengen.
	 */
	private AnalysisOutcome analyze(Profile profile, Instant since, boolean force, boolean capped) {
		List<Offer> candidates = candidatesFor(profile.getId(), since, force);
		if (candidates.isEmpty()) {
			return AnalysisOutcome.EMPTY;
		}

		int batchSize = properties.maxOffersPerRun();
		int limit = capped ? Math.min(candidates.size(), batchSize) : candidates.size();

		int analyzed = 0;
		long inputTokens = 0;
		long outputTokens = 0;
		for (int start = 0; start < limit; start += batchSize) {
			List<Offer> batch = candidates.subList(start, Math.min(start + batchSize, limit));
			AnalysisResult result = analyzer.analyze(profile, batch);
			inputTokens += result.inputTokens();
			outputTokens += result.outputTokens();
			analyzed += applyBatch(profile, batch, result);
		}

		return new AnalysisOutcome(analyzed, inputTokens, outputTokens, candidates.size() - limit);
	}

	/** Übernimmt die Bewertungen eines Batches; liefert die Zahl der zugeordneten Angebote. */
	private int applyBatch(Profile profile, List<Offer> batch, AnalysisResult result) {
		Map<Long, Offer> byId = batch.stream().collect(Collectors.toMap(Offer::getId, Function.identity()));
		int analyzed = 0;
		for (OfferAssessment assessment : result.assessments()) {
			Offer offer = byId.get(assessment.offerId());
			if (offer == null) {
				continue;
			}
			apply(offer, profile, assessment);
			analyzed++;
		}
		return analyzed;
	}

	private void apply(Offer offer, Profile profile, OfferAssessment assessment) {
		// Angebots-Eigenschaften (unabhängig vom Profil) — jüngste Analyse gewinnt.
		offer.setSeniority(assessment.seniority());
		offer.setIndustry(assessment.industry());
		offer.setRole(assessment.role());
		offer.setCountry(assessment.country());

		analyses.save(new OfferAnalysis(offer.getId(), profile.getId(), assessment.matchScore(), assessment.matchReason()));

		skills.deleteByIdOfferIdAndIdProfileId(offer.getId(), profile.getId());
		// Das LLM liefert gelegentlich Duplikate — der PK verlangt Eindeutigkeit.
		Map<String, AnalyzedSkill> unique = new LinkedHashMap<>();
		for (AnalyzedSkill skill : assessment.skills() == null ? List.<AnalyzedSkill>of() : assessment.skills()) {
			unique.putIfAbsent(skill.name().toLowerCase(Locale.ROOT), skill);
		}
		unique.values().forEach(skill -> skills.save(new OfferAnalysisSkill(offer.getId(), profile.getId(), skill.name(), skill.gap())));
	}
}
