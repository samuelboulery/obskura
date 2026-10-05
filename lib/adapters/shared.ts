import type { ExtraParam, GenerationParams } from '@/lib/types'

/**
 * Clé de repli du serveur, quand l'utilisateur n'a pas fourni la sienne.
 *
 * Les routes n'ont pas d'authentification : en production, un simple `curl`
 * dépenserait cette clé. Le repli y est donc fermé par défaut, et ne s'ouvre
 * qu'avec `ALLOW_SERVER_KEY=1` — à réserver à une instance de démo dont le
 * budget est plafonné chez le fournisseur.
 */
export function serverKey(name: 'GEMINI_API_KEY' | 'OPENAI_API_KEY'): string | undefined {
  const allowed =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_SERVER_KEY === '1'
  return allowed ? process.env[name] : undefined
}

/**
 * Fusionne le négatif saisi et celui du preset, puis déduplique : aucun des
 * deux modèles n'a de champ négatif, tout finit dans le texte du prompt.
 */
export function mergeNegatives(negative?: string, recipeNegative?: string): string {
  const seen = new Map<string, string>()

  for (const source of [negative, recipeNegative]) {
    for (const term of (source ?? '').split(',')) {
      const trimmed = term.trim()
      if (!trimmed) continue
      const key = trimmed.toLocaleLowerCase()
      if (!seen.has(key)) seen.set(key, trimmed)
    }
  }

  return [...seen.values()].join(', ')
}

/**
 * Tire une graine. Seul point d'aléatoire de la chaîne : il est appelé une fois
 * par génération, côté appelant, jamais depuis `buildPayload`.
 */
export function drawSeed(): number {
  return Math.floor(1_000_000 + Math.random() * 9_000_000)
}

/**
 * Graine effective : celle du champ si elle est verrouillée, sinon celle que
 * l'appelant a tirée pour cet envoi.
 *
 * Cette fonction est pure — c'est ce qui permet à `buildPayload` de l'être, et
 * donc à l'onglet JSON d'afficher exactement le corps qui partira. Tant que le
 * tirage vivait ici, le panneau montrait une graine renouvelée à chaque rendu,
 * qui n'était jamais celle envoyée au modèle.
 */
export function resolveSeed(params: GenerationParams, drawn: number | null): number | null {
  if (params.seedLock && params.seed !== null) return params.seed
  return drawn
}

/**
 * Compose le texte envoyé : prompt, suffixe du preset, puis le négatif fusionné.
 * `connector` change avec la langue — c'est le seul effet de ce réglage.
 */
export function composePrompt(
  prompt: string,
  promptSuffix: string | undefined,
  negative: string,
  connector: string
): string {
  const head = [prompt.trim(), promptSuffix?.trim()].filter(Boolean).join(', ')
  return negative ? `${head}. ${connector} ${negative}` : head
}

/**
 * Champs structurants du corps amont : ils décident du modèle appelé, du
 * nombre d'images produites et de la politique de modération. `extraParams`
 * est une soupape pour les champs que l'interface ne connaît pas encore — pas
 * un moyen de réécrire la requête. Sans cette liste, toute validation faite en
 * amont (`lib/adapters/validate.ts`) serait contournable depuis le client.
 */
const RESERVED = new Set([
  'model',
  'contents',
  'config',
  'prompt',
  'n',
  'candidateCount',
  'image',
  'quality',
  'size',
  'moderation',
  'background',
  'output_format',
  'output_compression',
])

/** Clés qui réassignent un prototype plutôt qu'une propriété. */
const POISONED = new Set(['__proto__', 'constructor', 'prototype'])

const MAX_EXTRAS = 20

/**
 * Les paramètres bruts sont fusionnés en dernier : c'est la soupape quand un
 * modèle ouvre un champ que l'interface ne connaît pas encore. Les champs
 * structurants en sont exclus — voir `RESERVED`.
 */
export function mergeExtraParams<T extends object>(payload: T, extraParams: ExtraParam[]): T {
  // Un `extraParams` non tabulaire ferait itérer `for…of` sur une chaîne, puis
  // planter en déstructuration : la route répondrait 500 au lieu de 400.
  if (!Array.isArray(extraParams)) return payload

  const extras: Record<string, unknown> = {}

  for (const entry of extraParams.slice(0, MAX_EXTRAS)) {
    if (typeof entry?.key !== 'string' || typeof entry?.value !== 'string') continue

    const name = entry.key.trim()
    if (!name || RESERVED.has(name) || POISONED.has(name)) continue

    try {
      extras[name] = JSON.parse(entry.value)
    } catch {
      extras[name] = entry.value
    }
  }

  return { ...payload, ...extras }
}
