package de.prime_ux.backend.offer;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
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

	/**
	 * Alle primären Angebote ab {@code since} (älteste zuerst), unabhängig vom Analyse-Status.
	 * Für die erzwungene Neubewertung nach einer Profiländerung — sonst blieben bereits
	 * bewertete Angebote auf ihrem alten (jetzt veralteten) Ergebnis stehen.
	 */
	@Query("select o from Offer o where o.primary = true and o.receivedAt >= :since order by o.receivedAt asc")
	List<Offer> findPrimarySince(@Param("since") Instant since);

	/**
	 * Warteschlange des Detailseiten-Abrufs: was noch nie geholt wurde oder beim letzten
	 * Versuch scheiterte, älteste zuerst. Nur primäre Angebote — Kopien anderer Agenten
	 * zeigen auf dieselbe Projektseite und würden sie unnötig ein zweites Mal abrufen.
	 */
	List<Offer> findByPrimaryTrueAndDetailStatusInOrderByReceivedAtAsc(List<DetailStatus> statuses, Pageable pageable);
}
