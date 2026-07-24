package de.prime_ux.backend.offer;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/offers")
public class OfferController {

	private final OfferRepository offers;
	private final OfferSkillRepository skills;

	public OfferController(OfferRepository offers, OfferSkillRepository skills) {
		this.offers = offers;
		this.skills = skills;
	}

	@GetMapping
	public List<OfferResponse> findAll() {
		List<Offer> all = offers.findAllByOrderByReceivedAtDesc();
		List<Long> ids = all.stream().map(Offer::getId).toList();
		Map<Long, List<OfferSkill>> skillsByOffer = ids.isEmpty()
			? Map.of()
			: skills.findByIdOfferIdIn(ids).stream().collect(Collectors.groupingBy(skill -> skill.getId().getOfferId()));

		return all.stream().map(offer -> OfferResponse.from(offer, skillsByOffer.getOrDefault(offer.getId(), List.of()))).toList();
	}
}
