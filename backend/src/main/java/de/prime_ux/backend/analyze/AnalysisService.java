package de.prime_ux.backend.analyze;

import de.prime_ux.backend.offer.Offer;
import de.prime_ux.backend.offer.OfferRepository;
import de.prime_ux.backend.offer.OfferSkill;
import de.prime_ux.backend.offer.OfferSkillRepository;
import de.prime_ux.backend.offer.OfferStatus;
import de.prime_ux.backend.run.Run;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Analysiert nach einem Abruf-Lauf die neuen Angebote: nur status=NEW und nur
 * primäre Einträge (Kopien anderer Agenten kosten keine Tokens), gedeckelt auf
 * radar.analysis.max-offers-per-run. Ergebnis und Token-Verbrauch landen am Run.
 */
@Service
public class AnalysisService {

	private final OfferAnalyzer analyzer;
	private final OfferRepository offers;
	private final OfferSkillRepository skills;
	private final AnalysisProperties properties;

	public AnalysisService(
		OfferAnalyzer analyzer,
		OfferRepository offers,
		OfferSkillRepository skills,
		AnalysisProperties properties
	) {
		this.analyzer = analyzer;
		this.offers = offers;
		this.skills = skills;
		this.properties = properties;
	}

	@Transactional
	public void analyzeNewOffers(Run run) {
		List<Offer> candidates = offers.findByStatusAndPrimaryTrueOrderByReceivedAtAsc(OfferStatus.NEW);
		if (candidates.isEmpty()) {
			return;
		}

		List<Offer> batch = candidates.subList(0, Math.min(candidates.size(), properties.maxOffersPerRun()));
		AnalysisResult result = analyzer.analyze(batch);
		Map<Long, Offer> byId = batch.stream().collect(Collectors.toMap(Offer::getId, Function.identity()));

		int analyzed = 0;
		for (OfferAnalysis analysis : result.analyses()) {
			Offer offer = byId.get(analysis.offerId());
			if (offer == null) {
				continue;
			}
			apply(offer, analysis);
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

	private void apply(Offer offer, OfferAnalysis analysis) {
		offer.setMatchScore(analysis.matchScore());
		offer.setMatchReason(analysis.matchReason());
		offer.setSeniority(analysis.seniority());
		offer.setIndustry(analysis.industry());
		offer.setRole(analysis.role());
		offer.setCountry(analysis.country());
		offer.setStatus(OfferStatus.ANALYZED);

		skills.deleteByIdOfferId(offer.getId());
		// Das LLM liefert gelegentlich Duplikate — der PK (offer_id, skill) verlangt Eindeutigkeit.
		Map<String, AnalyzedSkill> unique = new LinkedHashMap<>();
		for (AnalyzedSkill skill : analysis.skills() == null ? List.<AnalyzedSkill>of() : analysis.skills()) {
			unique.putIfAbsent(skill.name().toLowerCase(Locale.ROOT), skill);
		}
		unique.values().forEach(skill -> skills.save(new OfferSkill(offer.getId(), skill.name(), skill.gap())));
	}
}
