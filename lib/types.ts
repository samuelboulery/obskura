import type { ADAPTERS } from '@/lib/adapters/capabilities'

export interface ReferenceImage {
  base64: string
  mimeType: string
}

export interface ExtraParam {
  key: string
  value: string
}

/** Dérivé de `ADAPTERS` (lib/adapters/capabilities.ts) : une seule liste. */
export type AdapterId = (typeof ADAPTERS)[number]

/** Les trois clés que l'utilisateur peut enregistrer dans son navigateur. */
export type KeyKind = 'gemini' | 'openai' | 'text'

/** Une génération en vol : ses tuiles affichent un compteur de secondes. */
export interface PendingTile {
  id: string
  adapterId: AdapterId
  /** Nombre d'images attendues. */
  count: number
  startedAt: number
}

/**
 * Une génération qui a échoué. Elle reste dans la session comme une tuile :
 * la scène montre sa cause et le remède, au lieu d'un bandeau qui disparaît.
 */
export interface FailedRun {
  id: string
  adapterId: AdapterId
  prompt: string
  message: string
  kind: 'missing-key' | 'quota' | 'safety' | 'no-image' | 'generic'
  createdAt: string
}

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3'
export type Resolution = '1K' | '2K' | '4K' | '6K' | '8K'
export type Batch = 1 | 2 | 4 | 8
export type FileFormat = 'png' | 'jpeg' | 'webp'
export type PersonGeneration = 'allow_adult' | 'allow_all' | 'dont_allow'
export type Moderation = 'auto' | 'low'
export type Language = 'auto' | 'fr' | 'en'

/**
 * Réglages de rendu. Tous les modèles n'en lisent pas la totalité : voir
 * `lib/adapters/capabilities.ts`, qui décide de ce qui part et de ce que
 * l'inspecteur affiche.
 */
export interface GenerationParams {
  aspectRatio: AspectRatio
  resolution: Resolution
  batch: Batch
  /** `null` = graine aléatoire à chaque envoi. */
  seed: number | null
  seedLock: boolean
  fileFormat: FileFormat
  transparent: boolean
  /** 20–100, sans effet en PNG. */
  compression: number
  personGeneration: PersonGeneration
  moderation: Moderation
  language: Language
  extraParams: ExtraParam[]
}

/** Un preset réutilisable : références, poids, suffixe, négatif et réglages. */
export interface Recipe {
  id: string
  name: string
  styleImages: ReferenceImage[]
  /** 0 = inspiration lointaine, 100 = reproduction. */
  styleWeight: number
  subjectImages: ReferenceImage[]
  subjectWeight: number
  identityLock: boolean
  paletteTransfer: boolean
  promptSuffix: string
  negative: string
  params: Partial<GenerationParams>
}

/**
 * Ce qu'un adapter reçoit. Le preset est déjà résolu côté client : seuls son
 * suffixe et son négatif voyagent, pour être fusionnés puis dédupliqués.
 */
export interface GenerationRequest {
  adapterId: AdapterId
  prompt: string
  negative?: string
  promptSuffix?: string
  recipeNegative?: string
  subjectImages?: ReferenceImage[]
  subjectWeight?: number
  styleImages?: ReferenceImage[]
  styleWeight?: number
  identityLock?: boolean
  paletteTransfer?: boolean
  params: GenerationParams
  /**
   * Graine tirée pour cet envoi, quand elle n'est pas verrouillée. Elle est
   * décidée une fois par l'appelant : `buildPayload` reste ainsi une fonction
   * de ses seules entrées, et la valeur affichée est celle qui part.
   */
  drawnSeed?: number | null
}

export interface GenerationResult {
  imageBase64: string
  mimeType: string
}

/**
 * Une image produite pendant la session. `createdAt` est une chaîne ISO et non
 * une `Date` : la session est sérialisée telle quelle dans localStorage.
 */
export interface GalleryItem {
  id: string
  result: GenerationResult
  adapterId: AdapterId
  prompt: string
  negative: string
  seed: number | null
  params: GenerationParams
  /** Trois couleurs dominantes extraites de l'image — affichées dans sa fiche. */
  palette: [string, string, string] | null
  /**
   * Aperçu JPEG ~320 px en data URL, calculé après coup. C'est le seul champ
   * image toujours persisté : les pleines résolutions ne tiennent pas toutes
   * dans le quota localStorage.
   */
  thumb: string | null
  /** Arborescence de la session : l'image dont celle-ci dérive. */
  parentId: string | null
  recipeId: string | null
  latencyMs: number
  costEur: number
  createdAt: string
}

export interface GenerateImageAdapter {
  /** Renvoie autant d'images que `params.batch` en demande. */
  generate(
    request: GenerationRequest,
    apiKeyOverride?: string,
    signal?: AbortSignal
  ): Promise<GenerationResult[]>
}

export interface GenerateResponse {
  success: boolean
  data?: GenerationResult[]
  error?: string
}
