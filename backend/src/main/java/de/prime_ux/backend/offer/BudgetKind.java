package de.prime_ux.backend.offer;

import java.math.BigDecimal;

/**
 * Wie die Budget-Angabe eines Projekts zu lesen ist.
 *
 * Die Projektseite beziffert das Budget ohne Einheit — dieselbe Zeile trägt mal einen
 * Stundensatz, mal einen Tagessatz, mal die Gesamtsumme. Unterscheiden lässt sich das nur
 * an der Größenordnung, deshalb sind die Schwellen eine Heuristik und keine Wahrheit:
 * Auswertungen über Stundensätze dürfen nur {@link #HOURLY} zählen.
 */
public enum BudgetKind {
	/** Bis 250 € — plausibler Stundensatz. */
	HOURLY,
	/** Bis 2.000 € — dafür zu hoch, als Tagessatz plausibel. */
	DAILY,
	/** Darüber — Gesamtbudget des Projekts. */
	TOTAL;

	private static final BigDecimal HOURLY_MAX = new BigDecimal("250");
	private static final BigDecimal DAILY_MAX = new BigDecimal("2000");

	/** Ordnet einen Budget-Betrag ein; {@code null} für fehlende oder unsinnige Werte. */
	public static BudgetKind of(BigDecimal budget) {
		if (budget == null || budget.signum() <= 0) {
			// 0 € ist ein leer gelassenes Feld, kein Satz von null.
			return null;
		}
		if (budget.compareTo(HOURLY_MAX) <= 0) {
			return HOURLY;
		}
		return budget.compareTo(DAILY_MAX) <= 0 ? DAILY : TOTAL;
	}
}
