package de.prime_ux.backend.offer;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OfferAnalysisRepository extends JpaRepository<OfferAnalysis, OfferAnalysisId> {

	List<OfferAnalysis> findByIdProfileIdAndIdOfferIdIn(Long profileId, Collection<Long> offerIds);
}
