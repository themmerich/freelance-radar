package de.prime_ux.backend.run;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RunRepository extends JpaRepository<Run, Long> {

	Optional<Run> findTopByOrderByRanAtDesc();
}
