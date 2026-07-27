package de.prime_ux.backend.run;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface RunRepository extends JpaRepository<Run, Long> {

	Optional<Run> findTopByOrderByRanAtDesc();

	List<Run> findAllByOrderByRanAtDesc();

	@Query(
		"""
		select new de.prime_ux.backend.run.TokenTotals(
		  coalesce(sum(r.inputTokens), 0), coalesce(sum(r.outputTokens), 0), coalesce(sum(r.analyzedOffers), 0))
		from Run r"""
	)
	TokenTotals tokenTotals();
}
