package de.prime_ux.backend.offer;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OfferAnalysisSkillRepository extends JpaRepository<OfferAnalysisSkill, OfferAnalysisSkillId> {

	List<OfferAnalysisSkill> findByIdProfileIdAndIdOfferIdIn(Long profileId, Collection<Long> offerIds);

	void deleteByIdOfferIdAndIdProfileId(Long offerId, Long profileId);
}
