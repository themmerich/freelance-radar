/**
 * Kosten eines Analyse-Laufs in US-Cent, berechnet aus dem Token-Protokoll.
 * Preise für `claude-haiku-4-5` (Stand 07/2026): $1/MTok Input, $5/MTok Output.
 */
const INPUT_USD_PER_MILLION_TOKENS = 1;
const OUTPUT_USD_PER_MILLION_TOKENS = 5;

export function runCostCents(inputTokens: number, outputTokens: number): number {
  const usd = (inputTokens * INPUT_USD_PER_MILLION_TOKENS + outputTokens * OUTPUT_USD_PER_MILLION_TOKENS) / 1_000_000;
  return usd * 100;
}
