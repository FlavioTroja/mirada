import { RefundPolicyTier } from '../../core/domain/models';

/**
 * Gli scaglioni di rimborso sono `[{ daysBefore, percent }]` (§3.6).
 *
 * Nel form si scrivono in una riga compatta — `30:100, 15:50, 7:0` — perché è
 * il modo in cui gli organizzatori li dettano al telefono; qui vengono
 * convertiti nella struttura del contratto, e viceversa.
 */

export function tiersToText(tiers: RefundPolicyTier[] | null | undefined): string {
  if (!Array.isArray(tiers) || !tiers.length) return '';
  return [...tiers]
    .sort((a, b) => b.daysBefore - a.daysBefore)
    .map((tier) => `${tier.daysBefore}:${tier.percent}`)
    .join(', ');
}

export function parseTiers(text: string): RefundPolicyTier[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  return trimmed.split(',').map((chunk) => {
    const [rawDays, rawPercent] = chunk.split(':').map((part) => part.trim());
    const daysBefore = Number(rawDays);
    const percent = Number(rawPercent);
    if (!Number.isInteger(daysBefore) || daysBefore < 0) {
      throw new Error(
        `«${chunk.trim()}» non è uno scaglione valido: i giorni prima devono essere un intero non negativo.`,
      );
    }
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      throw new Error(
        `«${chunk.trim()}» non è uno scaglione valido: la percentuale deve essere un intero fra 0 e 100.`,
      );
    }
    return { daysBefore, percent };
  });
}
