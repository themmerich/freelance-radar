package de.prime_ux.backend.offer;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OfferRepository extends JpaRepository<Offer, Long> {

	List<Offer> findAllByOrderByReceivedAtDesc();

	boolean existsByMessageId(String messageId);

	Optional<Offer> findFirstByDupGroupAndPrimaryTrue(String dupGroup);

	/** Primäre Angebote ab {@code since} ohne Analyse-Ergebnis für das Profil (älteste zuerst). */
	@Query(
		"""
		select o from Offer o
		where o.primary = true and o.receivedAt >= :since
		  and not exists (select a from OfferAnalysis a where a.id.offerId = o.id and a.id.profileId = :profileId)
		order by o.receivedAt asc"""
	)
	List<Offer> findUnanalyzedPrimarySince(@Param("profileId") Long profileId, @Param("since") Instant since);
}
