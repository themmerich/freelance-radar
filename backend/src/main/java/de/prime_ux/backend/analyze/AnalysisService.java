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
 * Analysiert Angebote gegen ein Profil: nur primäre Einträge ohne Ergebnis für
 * genau dieses Profil (Kopien anderer Agenten kosten nie Tokens), gedeckelt auf
 * radar.analysis.max-offers-per-run. Ergebnis und Token-Verbrauch landen am Run;
 * Ergebnisse anderer Profile bleiben unberührt nebeneinander bestehen.
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

	/** Nach einem Abruf-Lauf: neue Angebote gegen das aktive Profil bewerten. */
	@Transactional
	public void analyzeNewOffers(Run run) {
		Profile active = profiles.findByActiveTrue().orElse(null);
		if (active == null) {
			run.setNote(run.getNote() + "; kein aktives profil");
			return;
		}
		analyze(active, Instant.EPOCH, run);
	}

	/** Re-Analyse „Bestand gegen Profil X bewerten", optional auf ein Zeitfenster begrenzt. */
	@Transactional
	public Run reanalyze(Long profileId, Integer days) {
		Profile profile = profiles.findById(profileId).orElseThrow(() -> new ProfileNotFoundException(profileId));
		Run run = runs.save(new Run(0, 0, "reanalyse profil=" + profile.getName() + (days == null ? "" : ", tage=" + days)));
		analyze(profile, since(days), run);
		return run;
	}

	/** Anzahl noch unbewerteter primärer Angebote für Profil + Zeitfenster (Kostenvorschau). */
	public int countCandidates(Long profileId, Integer days) {
		profiles.findById(profileId).orElseThrow(() -> new ProfileNotFoundException(profileId));
		return offers.findUnanalyzedPrimarySince(profileId, since(days)).size();
	}

	/** Kostenvorschau: Kandidaten × Ø-Tokens der bisherigen Läufe. */
	public AnalysisPreview preview(Long profileId, Integer days) {
		int candidates = countCandidates(profileId, days);
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

	private void analyze(Profile profile, Instant since, Run run) {
		List<Offer> candidates = offers.findUnanalyzedPrimarySince(profile.getId(), since);
		if (candidates.isEmpty()) {
			return;
		}

		List<Offer> batch = candidates.subList(0, Math.min(candidates.size(), properties.maxOffersPerRun()));
		AnalysisResult result = analyzer.analyze(profile, batch);
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

		run.setAnalyzedOffers(analyzed);
		run.setInputTokens(result.inputTokens());
		run.setOutputTokens(result.outputTokens());
		int leftOver = candidates.size() - batch.size();
		if (leftOver > 0) {
			// Kostendeckel: Abbruch mit Hinweis statt Kostenexplosion.
			run.setNote(run.getNote() + "; deckel=" + properties.maxOffersPerRun() + ", offen=" + leftOver);
		}
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
