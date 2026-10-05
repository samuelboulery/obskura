import type { AdapterId } from '@/lib/types'

/**
 * Contenu de la landing utilisable des deux côtés : aucun import d'adapter ici,
 * pour que les SDK des fournisseurs ne partent jamais dans le bundle client.
 */

export interface LandingPrompt {
  slug: 'phare' | 'serre' | 'indigo' | 'coquelicots'
  prompt: string
  seed: number
}

export const LANDING_PROMPTS: readonly LandingPrompt[] = [
  { slug: 'phare', prompt: "un phare sous la neige, à l'aube", seed: 41207 },
  { slug: 'serre', prompt: "une serre de nuit éclairée de l'intérieur, buée sur les vitres", seed: 80313 },
  { slug: 'indigo', prompt: "des cuves de teinture indigo vues d'en haut", seed: 5291 },
  { slug: 'coquelicots', prompt: "un champ de coquelicots sous un ciel d'orage", seed: 66820 },
]

export const LANDING_NEGATIVE = 'texte, filigrane'

/** Le modèle de la transition, puis celui qu'on lui compare. */
export const SCENE_MODEL: AdapterId = 'nano-banana-2'
export const COMPARE_MODEL: AdapterId = 'gpt-image-2.5-sunburst'

/**
 * `false` tant que `public/landing/` contient les scènes dessinées de la
 * maquette : les légendes le disent. À passer à `true` avec les vraies sorties.
 */
export const IMAGES_ARE_REAL = false

export const IMAGE_W = 1536
export const IMAGE_H = 864

export function imageSrc(slug: LandingPrompt['slug'], adapterId: AdapterId): string {
  return `/landing/${slug}-${adapterId === SCENE_MODEL ? 'nano' : 'sunburst'}.webp`
}

/** Annotation de marge affichée au survol ou au focus d'un champ du corps. */
export const FIELD_NOTES: Record<string, string> = {
  model: "Le modèle appelé chez le fournisseur. Nano Banana 2 s'appelle ainsi chez Google.",
  role: "La requête parle au nom de l'utilisateur : vous.",
  text: "Votre prompt. Le négatif est fusionné à la fin : aucune des deux API n'a de champ dédié.",
  responseModalities: "On ne demande qu'une image, aucun texte.",
  candidateCount: 'Le nombre de variantes produites par cet envoi.',
  aspectRatio: 'Le format, envoyé tel quel.',
  imageSize: 'La résolution. Chez OpenAI, la même valeur devient une qualité.',
  personGeneration: 'Ce que le modèle accepte de représenter. OpenAI ignore ce réglage.',
  seed: 'Même seed et même prompt : même image. Elle est tirée avant, jamais pendant la construction du corps.',
}
