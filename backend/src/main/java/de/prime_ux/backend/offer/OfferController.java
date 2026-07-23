package de.prime_ux.backend.offer;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/offers")
public class OfferController {

	private final OfferRepository offers;

	public OfferController(OfferRepository offers) {
		this.offers = offers;
	}

	@GetMapping
	public List<OfferResponse> findAll() {
		return offers.findAllByOrderByReceivedAtDesc().stream().map(OfferResponse::from).toList();
	}
}
