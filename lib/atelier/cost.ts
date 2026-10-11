import type { AdapterId } from '@/lib/types'

/**
 * Tarif indicatif en euros par image. Éditable dans les réglages : l'app
 * n'interroge aucune grille tarifaire, l'estimation est purement locale.
 */
export type Pricing = Record<AdapterId, number>

export const DEFAULT_PRICING: Pricing = {
  'nano-banana-2': 0.06,
  'nano-banana-2.1': 0.03,
  'gpt-image-2': 0.04,
  'gpt-image-2.5-sunburst': 0.07,
  'gpt-image-2.5-flare': 0.07,
}

/** Estimation locale : tarif du modèle × nombre de variantes. */
export function estimateCost(
  adapterId: AdapterId,
  batch: number,
  pricing: Pricing = DEFAULT_PRICING
): number {
  const unit = pricing[adapterId] ?? 0
  const count = Number.isFinite(batch) && batch > 0 ? batch : 1
  return Math.round(unit * count * 10_000) / 10_000
}

export function formatEur(amount: number): string {
  return `${amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`
}
