package de.prime_ux.backend.offer;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OfferSkillRepository extends JpaRepository<OfferSkill, OfferSkillId> {

	List<OfferSkill> findByIdOfferIdIn(Collection<Long> offerIds);

	void deleteByIdOfferId(Long offerId);
}
