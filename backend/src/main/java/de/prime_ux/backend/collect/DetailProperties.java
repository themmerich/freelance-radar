package de.prime_ux.backend.collect;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Konfiguration des Detailseiten-Abrufs. Die robots.txt von freelancermap verbietet nichts
 * und nennt keine Crawl-Verzögerung; gedrosselt wird trotzdem, und jede Seite wird genau
 * einmal geholt.
 *
 * @param enabled Schalter für den gesamten Abruf
 * @param delayMs Pause zwischen zwei Requests
 * @param timeoutMs Timeout je Request
 * @param maxPerRun Deckel je Collect-Lauf über neue und nachzuholende Seiten zusammen
 * @param userAgent sagt dem Betreiber, wer da unterwegs ist
 */
@ConfigurationProperties(prefix = "radar.detail")
public record DetailProperties(boolean enabled, long delayMs, long timeoutMs, int maxPerRun, String userAgent) {}
