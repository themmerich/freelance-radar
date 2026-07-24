package de.prime_ux.backend.offer;

import de.prime_ux.backend.profile.Profile;
import de.prime_ux.backend.profile.ProfileRepository;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/offers")
public class OfferController {

	private final OfferRepository offers;
	private final OfferAnalysisRepository analyses;
	private final OfferAnalysisSkillRepository skills;
	private final ProfileRepository profiles;

	public OfferController(
		OfferRepository offers,
		OfferAnalysisRepository analyses,
		OfferAnalysisSkillRepository skills,
		ProfileRepository profiles
	) {
		this.offers = offers;
		this.analyses = analyses;
		this.skills = skills;
		this.profiles = profiles;
	}

	/** Angebote aus Sicht eines Profils; ohne {@code profileId} zählt das aktive. */
	@GetMapping
	public List<OfferResponse> findAll(@RequestParam(required = false) Long profileId) {
		List<Offer> all = offers.findAllByOrderByReceivedAtDesc();
		Long profile = profileId != null ? profileId : profiles.findByActiveTrue().map(Profile::getId).orElse(null);
		if (profile == null || all.isEmpty()) {
			return all.stream().map(offer -> OfferResponse.from(offer, null, List.of())).toList();
		}

		List<Long> ids = all.stream().map(Offer::getId).toList();
		Map<Long, OfferAnalysis> analysisByOffer = analyses
			.findByIdProfileIdAndIdOfferIdIn(profile, ids)
			.stream()
			.collect(Collectors.toMap(analysis -> analysis.getId().getOfferId(), Function.identity()));
		Map<Long, List<OfferAnalysisSkill>> skillsByOffer = skills
			.findByIdProfileIdAndIdOfferIdIn(profile, ids)
			.stream()
			.collect(Collectors.groupingBy(skill -> skill.getId().getOfferId()));

		return all
			.stream()
			.map(offer ->
				OfferResponse.from(offer, analysisByOffer.get(offer.getId()), skillsByOffer.getOrDefault(offer.getId(), List.of()))
			)
			.toList();
	}
}
