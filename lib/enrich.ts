export type EnrichProvider = 'anthropic' | 'openai' | 'gemini'

/** Modèle de texte quand l'utilisateur n'en impose aucun. */
export const ENRICH_DEFAULT_MODEL: Record<EnrichProvider, string> = {
  anthropic: 'claude-haiku-5-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
}

/**
 * Le préfixe de la clé décide du fournisseur : rien d'autre ne le distingue.
 * `sk-ant-` passe avant `sk-`, qu'il commence aussi.
 */
export function enrichProvider(apiKey: string): EnrichProvider {
  if (apiKey.startsWith('sk-ant-')) return 'anthropic'
  return apiKey.startsWith('sk-') ? 'openai' : 'gemini'
}
