package de.prime_ux.backend.profile;

public class ProfileNotFoundException extends RuntimeException {

	public ProfileNotFoundException(Long id) {
		super("Profil " + id + " existiert nicht");
	}
}
