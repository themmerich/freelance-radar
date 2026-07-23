package de.prime_ux.backend.collect;

import de.prime_ux.backend.offer.SourceType;
import java.util.List;

/** Ergebnis der regelbasierten Mail-Auswertung; enthält immer mindestens ein Projekt. */
public record ParsedMail(SourceType sourceType, String agentName, List<ParsedProject> projects) {}
