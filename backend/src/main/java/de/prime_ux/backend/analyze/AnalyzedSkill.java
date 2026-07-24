package de.prime_ux.backend.analyze;

/** Ein gefordertes Skill aus einem Angebot; {@code gap} = fehlt im Profil. */
public record AnalyzedSkill(String name, boolean gap) {}
