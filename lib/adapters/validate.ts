import { resolutionsOf } from './capabilities'
import type {
  AdapterId,
  ExtraParam,
  GenerationParams,
  GenerationRequest,
  ReferenceImage,
} from '@/lib/types'

/**
 * Validation en frontière.
 *
 * `await req.json()` rend `any` : le typage `GenerationRequest` de la route est
 * une promesse que rien ne tient à l'exécution. Sans ce module, `batch: 10000`
 * ou `personGeneration: 'allow_all'` partent tels quels vers l'API amont — sur
 * la clé de repli du serveur, le cas échéant.
 *
 * Les listes ci-dessous sont la seule source de vérité des valeurs acceptées ;
 * elles doivent rester alignées sur les unions de `lib/types.ts`.
 */

export const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3'] as const
export const RESOLUTIONS = ['1K', '2K', '4K', '6K', '8K'] as const
export const BATCHES = [1, 2, 4, 8] as const
export const FILE_FORMATS = ['png', 'jpeg', 'webp'] as const
export const PERSON_GENERATIONS = ['allow_adult', 'allow_all', 'dont_allow'] as const
export const MODERATIONS = ['auto', 'low'] as const
export const LANGUAGES = ['auto', 'fr', 'en'] as const
export const ADAPTER_IDS = [
  'nano-banana-2',
  'gpt-image-2',
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare',
] as const

/** Plafonds : ils bornent la mémoire du serveur et la facture de l'utilisateur. */
export const MAX_PROMPT_CHARS = 8_000
export const MAX_REFERENCE_IMAGES = 8
/** ~8 Mo de base64 cumulés, soit environ 6 Mo d'images réelles. */
export const MAX_REFERENCE_BASE64_CHARS = 8_000_000
export const MAX_EXTRA_PARAMS = 20
/**
 * Formats d'image acceptés en référence. SVG exclu : c'est un document
 * actif, pas une image matricielle, et le client ne produit que du JPEG.
 */
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const

export function isImageMimeType(value: unknown): boolean {
  return (IMAGE_MIME_TYPES as readonly unknown[]).includes(value)
}
/** Corps brut d'une génération : les images de référence, plus la marge du reste. */
export const MAX_GENERATE_BODY_BYTES = 10_000_000

export class BadRequestError extends Error {
  readonly status = 400
}

export class PayloadTooLargeError extends Error {
  readonly status = 413
}

function fail(message: string): never {
  throw new BadRequestError(message)
}

function oneOf<T extends readonly (string | number)[]>(
  value: unknown,
  allowed: T,
  field: string
): T[number] {
  if (!allowed.includes(value as T[number])) {
    fail(`${field} invalide — attendu : ${allowed.join(', ')}`)
  }
  return value as T[number]
}

function optionalString(value: unknown, field: string, max = MAX_PROMPT_CHARS): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') fail(`${field} doit être une chaîne`)
  if (value.length > max) fail(`${field} dépasse ${max} caractères`)
  return value
}

function weight(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    fail(`${field} doit être un nombre entre 0 et 100`)
  }
  return value
}

/** `data:` est refusé : seul le base64 nu voyage, le mime a son propre champ. */
function referenceImages(value: unknown, field: string): ReferenceImage[] | undefined {
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value)) fail(`${field} doit être un tableau`)
  if (value.length > MAX_REFERENCE_IMAGES) {
    fail(`${field} : ${MAX_REFERENCE_IMAGES} images au maximum`)
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) fail(`${field}[${index}] invalide`)
    const image = entry as Record<string, unknown>

    if (typeof image.base64 !== 'string' || !image.base64) {
      fail(`${field}[${index}].base64 manquant`)
    }
    if (typeof image.mimeType !== 'string' || !isImageMimeType(image.mimeType)) {
      fail(`${field}[${index}].mimeType doit être l'un de ${IMAGE_MIME_TYPES.join(', ')}`)
    }

    return { base64: image.base64, mimeType: image.mimeType }
  })
}

function extraParams(value: unknown): ExtraParam[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) fail('params.extraParams doit être un tableau')
  if (value.length > MAX_EXTRA_PARAMS) {
    fail(`params.extraParams : ${MAX_EXTRA_PARAMS} entrées au maximum`)
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) fail(`params.extraParams[${index}] invalide`)
    const param = entry as Record<string, unknown>
    if (typeof param.key !== 'string' || typeof param.value !== 'string') {
      fail(`params.extraParams[${index}] : key et value doivent être des chaînes`)
    }
    return { key: param.key, value: param.value }
  })
}

function params(value: unknown, adapterId: AdapterId): GenerationParams {
  if (typeof value !== 'object' || value === null) fail('params est requis')
  const p = value as Record<string, unknown>

  const seed = p.seed
  if (seed !== null && seed !== undefined && !Number.isInteger(seed)) {
    fail('params.seed doit être un entier ou null')
  }

  const compression = p.compression ?? 80
  if (typeof compression !== 'number' || compression < 20 || compression > 100) {
    fail('params.compression doit être un nombre entre 20 et 100')
  }

  return {
    aspectRatio: oneOf(p.aspectRatio, ASPECT_RATIOS, 'params.aspectRatio'),
    // Bornée par le modèle : 6K et 8K n'existent que chez GPT Image 2.5.
    resolution: oneOf(p.resolution, resolutionsOf(adapterId), 'params.resolution'),
    batch: oneOf(p.batch, BATCHES, 'params.batch'),
    seed: (seed as number | null) ?? null,
    seedLock: Boolean(p.seedLock),
    fileFormat: oneOf(p.fileFormat ?? 'png', FILE_FORMATS, 'params.fileFormat'),
    transparent: Boolean(p.transparent),
    compression,
    personGeneration: oneOf(
      p.personGeneration ?? 'allow_adult',
      PERSON_GENERATIONS,
      'params.personGeneration'
    ),
    moderation: oneOf(p.moderation ?? 'auto', MODERATIONS, 'params.moderation'),
    language: oneOf(p.language ?? 'auto', LANGUAGES, 'params.language'),
    extraParams: extraParams(p.extraParams),
  }
}

/**
 * Valide le corps d'une requête de génération et renvoie un objet dont chaque
 * champ est vérifié. Lève `BadRequestError` (400) ou `PayloadTooLargeError`
 * (413) ; l'appelant traduit en réponse HTTP.
 */
export function parseGenerationRequest(raw: unknown): GenerationRequest {
  if (typeof raw !== 'object' || raw === null) fail('corps de requête invalide')
  const body = raw as Record<string, unknown>

  if (typeof body.prompt !== 'string' || !body.prompt.trim()) fail('prompt est requis')
  if (body.prompt.length > MAX_PROMPT_CHARS) {
    fail(`prompt dépasse ${MAX_PROMPT_CHARS} caractères`)
  }

  const adapterId = oneOf(body.adapterId, ADAPTER_IDS, 'adapterId') as AdapterId
  const subjectImages = referenceImages(body.subjectImages, 'subjectImages')
  const styleImages = referenceImages(body.styleImages, 'styleImages')

  const totalBase64 = [...(subjectImages ?? []), ...(styleImages ?? [])].reduce(
    (total, image) => total + image.base64.length,
    0
  )
  if (totalBase64 > MAX_REFERENCE_BASE64_CHARS) {
    throw new PayloadTooLargeError('Images de référence trop volumineuses')
  }

  return {
    adapterId,
    prompt: body.prompt,
    negative: optionalString(body.negative, 'negative'),
    promptSuffix: optionalString(body.promptSuffix, 'promptSuffix'),
    recipeNegative: optionalString(body.recipeNegative, 'recipeNegative'),
    subjectImages,
    subjectWeight: weight(body.subjectWeight, 'subjectWeight'),
    styleImages,
    styleWeight: weight(body.styleWeight, 'styleWeight'),
    identityLock: Boolean(body.identityLock),
    paletteTransfer: Boolean(body.paletteTransfer),
    params: params(body.params, adapterId),
  }
}
