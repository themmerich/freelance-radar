package de.prime_ux.backend.profile;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfileRepository extends JpaRepository<Profile, Long> {

	Optional<Profile> findByActiveTrue();

	List<Profile> findAllByOrderByNameAsc();
}
