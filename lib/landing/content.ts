import type { AdapterId } from '@/lib/types'

/**
 * Contenu de la landing utilisable des deux côtés : aucun import d'adapter ici,
 * pour que les SDK des fournisseurs ne partent jamais dans le bundle client.
 */

export interface LandingPrompt {
  slug: 'bulle' | 'comete' | 'bougie' | 'serre'
  prompt: string
  seed: number
}

/**
 * Une seule lumière dans le noir, à l'instant d'avant. La première s'affiche au chargement.
 * Prompts et seeds (celle de Nano Banana 2) des images de `public/landing/`, sans négatif.
 */
export const LANDING_PROMPTS: readonly LandingPrompt[] = [
  {
    slug: 'bulle',
    prompt: "Une bulle de savon, juste avant d'éclater, photographiée de flash sur fond noir dans un style photo macro au flash",
    seed: 7234910,
  },
  {
    slug: 'comete',
    prompt: "Une comète traverse une nuit d'encre au-dessus d'un phare éteint, estampe sur bois vermillon et or. Style : estampe japonaise sur bois",
    seed: 1071850,
  },
  {
    slug: 'bougie',
    prompt: "Une bougie veille une grenade ouverte sur une nappe noire, peinte à l'huile en clair-obscur. Style : nature morte à l'huile",
    seed: 5032010,
  },
  {
    slug: 'serre',
    prompt: 'Une serre pleine de citronniers brille seule dans la neige, au pastel sur papier noir. Style : pastel sur papier noir',
    seed: 5081630,
  },
]

/** Le modèle de la transition, puis celui qu'on lui compare. */
export const SCENE_MODEL: AdapterId = 'gpt-image-2.5-sunburst'
export const COMPARE_MODEL: AdapterId = 'nano-banana-2'

/**
 * `true` : `public/landing/` contient de vraies sorties des deux modèles,
 * recadrées en 1536 × 864. À repasser à `false` pour des images de maquette.
 */
export const IMAGES_ARE_REAL = true

export const IMAGE_W = 1536
export const IMAGE_H = 864

/** Sorties disponibles dans `public/landing/` : une par prompt et par modèle montré. */
const IMAGE_SUFFIX: Partial<Record<AdapterId, string>> = {
  'nano-banana-2': 'nano',
  'gpt-image-2.5-sunburst': 'sunburst',
}

export function imageSrc(slug: LandingPrompt['slug'], adapterId: AdapterId): string {
  const suffix = IMAGE_SUFFIX[adapterId]
  if (!suffix) throw new Error(`Aucune image de landing pour ${adapterId}`)
  return `/landing/${slug}-${suffix}.webp`
}

/** Annotation de marge affichée au survol ou au focus d'un champ du corps. */
export const FIELD_NOTES: Record<string, string> = {
  model: 'Le modèle appelé chez le fournisseur, sous son nom exact.',
  prompt: "Votre prompt. Un négatif y serait fusionné à la fin : aucune des deux API n'a de champ dédié.",
  n: 'Le nombre de variantes produites par cet envoi.',
  size: "Le format 16:9, traduit en pixels : OpenAI attend une taille, pas un ratio.",
  quality: 'La résolution 2K devient une qualité chez OpenAI : medium.',
  background: 'Fond opaque : la transparence est un réglage à part.',
  output_format: 'Le type de fichier renvoyé.',
  output_compression: "Sans effet en PNG : la compression ne vaut que pour le JPEG et le WebP.",
  moderation: "Le niveau de filtrage d'OpenAI. Google n'a pas ce réglage.",
  image: 'Les images de référence. Vide ici : le prompt part seul.',
  role: "La requête parle au nom de l'utilisateur : vous.",
  text: "Votre prompt. Un négatif y serait fusionné à la fin : aucune des deux API n'a de champ dédié.",
  responseModalities: "On ne demande qu'une image, aucun texte.",
  candidateCount: 'Le nombre de variantes produites par cet envoi.',
  aspectRatio: 'Le format, envoyé tel quel.',
  imageSize: 'La résolution. Chez OpenAI, la même valeur devient une qualité.',
  personGeneration: 'Ce que le modèle accepte de représenter. OpenAI ignore ce réglage.',
  seed: 'Même seed et même prompt : même image. Elle est tirée avant, jamais pendant la construction du corps.',
}
