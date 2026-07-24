package de.prime_ux.backend.analyze;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Kostendeckel der Claude-Analyse (die Lehre aus v1: Tokens nur bewusst ausgeben). */
@ConfigurationProperties(prefix = "radar.analysis")
public record AnalysisProperties(
	/** Maximal so viele Angebote pro Lauf analysieren; der Rest bleibt NEW für den nächsten Lauf. */
	int maxOffersPerRun,
	/** Mail-Body wird im Prompt auf diese Länge gekürzt (Signaturen/Footer sind schon raus). */
	int promptBodyChars
) {}
