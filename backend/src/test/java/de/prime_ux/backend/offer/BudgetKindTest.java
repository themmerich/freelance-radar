package de.prime_ux.backend.offer;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BudgetKindTest {

	/** Die Werte stammen aus den ersten 149 abgerufenen Seiten. */
	@ParameterizedTest
	@CsvSource({ "62.00, HOURLY", "70.00, HOURLY", "90.00, HOURLY", "250.00, HOURLY", "600.00, DAILY", "649.00, DAILY", "750000.00, TOTAL" })
	void sortsRealBudgetsByTheirMagnitude(BigDecimal budget, BudgetKind expected) {
		assertThat(BudgetKind.of(budget)).isEqualTo(expected);
	}

	@Test
	void treatsMissingAndZeroAsNoStatement() {
		// 0 € ist ein leer gelassenes Feld — als Stundensatz gezählt verfälschte es jeden Schnitt.
		assertThat(BudgetKind.of(null)).isNull();
		assertThat(BudgetKind.of(BigDecimal.ZERO)).isNull();
	}
}
