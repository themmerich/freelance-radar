package de.prime_ux.backend.analyze;

import de.prime_ux.backend.offer.Offer;
import java.util.List;

/** Bewertet Angebote gegen das Profil; im Betrieb Claude ({@link ClaudeOfferAnalyzer}), in Tests ein Stub. */
public interface OfferAnalyzer {

	/** Ein Batch-Aufruf für alle übergebenen Angebote — nie ein Request pro Angebot. */
	AnalysisResult analyze(List<Offer> offers);
}
