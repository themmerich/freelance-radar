package de.prime_ux.backend.offer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OfferRepository extends JpaRepository<Offer, Long> {

	List<Offer> findAllByOrderByReceivedAtDesc();

	boolean existsByMessageId(String messageId);
}
