package de.prime_ux.backend.collect;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Was die Projekt-Detailseite hergibt. Jedes Feld kann fehlen — die Seiten sind
 * unterschiedlich befüllt, ein fehlender Wert ist der Normalfall und kein Fehler.
 *
 * @param rateHourlyEur Stundensatz laut Budget-Badge
 * @param durationMonths Projektdauer in Monaten
 * @param utilizationPercent Auslastung in Prozent
 * @param remotePercent Remote-Anteil in Prozent
 * @param contractType Vertragsart, z.B. „Freiberuflich"
 * @param startMonth erster Tag des genannten Startmonats; null bei „ab sofort"
 * @param startImmediate true bei „ab sofort"
 * @param description Projektbeschreibung als Fließtext
 */
public record ProjectDetails(
	BigDecimal rateHourlyEur,
	Integer durationMonths,
	Integer utilizationPercent,
	Integer remotePercent,
	String contractType,
	LocalDate startMonth,
	boolean startImmediate,
	String description
) {}
