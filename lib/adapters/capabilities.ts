import type { AdapterId, AspectRatio, GenerationParams, Resolution } from '@/lib/types'

/** Réglages susceptibles de partir dans un corps de requête. */
export type PayloadParam = Exclude<keyof GenerationParams, 'seedLock'>

/**
 * Source unique de la liste des adapters. `AdapterId` en dérive, si bien
 * qu'ajouter un modèle ici force le compilateur à signaler chaque endroit qui
 * doit suivre.
 */
export const ADAPTERS = [
  'nano-banana-2',
  'nano-banana-2.1',
  'gpt-image-2',
  'gpt-image-2.5-sunburst',
  'gpt-image-2.5-flare',
] as const

export const ALL_PARAMS: readonly PayloadParam[] = [
  'aspectRatio',
  'resolution',
  'batch',
  'seed',
  'fileFormat',
  'transparent',
  'compression',
  'personGeneration',
  'moderation',
  'language',
  'extraParams',
]

export interface ValueOption<T> {
  value: T
  label: string
}

/**
 * Ce que l'interface doit savoir d'un modèle pour ne rendre que ce qu'il lit.
 * Source unique : l'élagage du payload (`pruneUnsupported`), la validation de
 * la route et l'inspecteur en dérivent.
 */
export interface ModelSpec {
  id: AdapterId
  name: string
  provider: 'Google' | 'OpenAI'
  keyKind: 'gemini' | 'openai'
  /**
   * `resolution` porte deux réglages selon le modèle : la taille chez Google,
   * la qualité chez OpenAI. Le libellé affiché est la valeur réellement envoyée.
   */
  resolution: { kind: 'resolution' | 'quality'; options: ValueOption<Resolution>[] }
  /** Taille réelle envoyée pour chaque format — OpenAI seulement. */
  sizes?: Record<AspectRatio, string>
  /** Nano Banana 2 lit un poids par référence ; GPT Image les lit sans poids. */
  referenceWeights: boolean
  supported: readonly PayloadParam[]
}

const GPT_SUPPORTED: readonly PayloadParam[] = [
  'aspectRatio',
  'resolution',
  'batch',
  'fileFormat',
  'transparent',
  'compression',
  'moderation',
  'language',
  'extraParams',
]

export const GPT_SIZES: Record<AspectRatio, string> = {
  '1:1': '1024x1024',
  '16:9': '1536x864',
  '9:16': '864x1536',
  '4:3': '1280x960',
}

const GPT_QUALITIES: ValueOption<Resolution>[] = [
  { value: '1K', label: 'low' },
  { value: '2K', label: 'medium' },
  { value: '4K', label: 'high' },
]

const GPT_25_QUALITIES: ValueOption<Resolution>[] = [
  ...GPT_QUALITIES,
  { value: '6K', label: 'xhigh' },
  { value: '8K', label: 'max' },
]

function gptSpec(id: AdapterId, name: string, qualities: ValueOption<Resolution>[]): ModelSpec {
  return {
    id,
    name,
    provider: 'OpenAI',
    keyKind: 'openai',
    resolution: { kind: 'quality', options: qualities },
    sizes: GPT_SIZES,
    referenceWeights: false,
    supported: GPT_SUPPORTED,
  }
}

const GEMINI_RESOLUTIONS: ValueOption<Resolution>[] = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
]

const GEMINI_SUPPORTED: readonly PayloadParam[] = [
  'aspectRatio',
  'resolution',
  'batch',
  'seed',
  'personGeneration',
  'language',
  'extraParams',
]

function geminiSpec(id: AdapterId, name: string): ModelSpec {
  return {
    id,
    name,
    provider: 'Google',
    keyKind: 'gemini',
    resolution: { kind: 'resolution', options: GEMINI_RESOLUTIONS },
    referenceWeights: true,
    supported: GEMINI_SUPPORTED,
  }
}

export const MODELS: Record<AdapterId, ModelSpec> = {
  'nano-banana-2': geminiSpec('nano-banana-2', 'Nano Banana 2'),
  'nano-banana-2.1': geminiSpec('nano-banana-2.1', 'Nano Banana 2.1'),
  'gpt-image-2': gptSpec('gpt-image-2', 'GPT Image 2', GPT_QUALITIES),
  'gpt-image-2.5-sunburst': gptSpec('gpt-image-2.5-sunburst', 'GPT Image 2.5 Sunburst', GPT_25_QUALITIES),
  'gpt-image-2.5-flare': gptSpec('gpt-image-2.5-flare', 'GPT Image 2.5 Flare', GPT_25_QUALITIES),
}

/** Libellés courts des réglages, pour les écarts entre deux générations. */
export const PARAM_LABELS: Record<PayloadParam, string> = {
  aspectRatio: 'format',
  resolution: 'résolution',
  batch: 'variantes',
  seed: 'graine',
  fileFormat: 'fichier',
  transparent: 'fond transparent',
  compression: 'compression',
  personGeneration: 'personnes',
  moderation: 'modération',
  language: 'langue',
  extraParams: 'paramètres bruts',
}

export function supports(adapterId: AdapterId, param: PayloadParam): boolean {
  return MODELS[adapterId].supported.includes(param)
}

export function ignoredParams(adapterId: AdapterId): PayloadParam[] {
  return ALL_PARAMS.filter((param) => !supports(adapterId, param))
}

export function resolutionsOf(adapterId: AdapterId): Resolution[] {
  return MODELS[adapterId].resolution.options.map((option) => option.value)
}

/**
 * Recale les réglages sur ce que le modèle accepte : une résolution hors plage
 * descend au cran le plus haut disponible. Sans ce recalage, passer de Flare
 * (8K) à Nano Banana 2 enverrait une valeur que la route refuse.
 */
export function fitParams(params: GenerationParams, adapterId: AdapterId): GenerationParams {
  const allowed = resolutionsOf(adapterId)
  if (allowed.includes(params.resolution)) return params
  return { ...params, resolution: allowed[allowed.length - 1] }
}

/** Réglages qui apparaissent et disparaissent de l'inspecteur au changement de modèle. */
export function modelChanges(
  from: AdapterId,
  to: AdapterId
): { added: PayloadParam[]; removed: PayloadParam[] } {
  return {
    added: ALL_PARAMS.filter((param) => supports(to, param) && !supports(from, param)),
    removed: ALL_PARAMS.filter((param) => supports(from, param) && !supports(to, param)),
  }
}

const GEMINI_PATHS: Partial<Record<PayloadParam, string | null>> = {
  aspectRatio: 'config.imageConfig.aspectRatio',
  resolution: 'config.imageConfig.imageSize',
  batch: 'config.candidateCount',
  seed: 'config.seed',
  personGeneration: 'config.personGeneration',
  language: null,
  extraParams: null,
}

/**
 * Où chaque réglage atterrit dans le corps de chaque modèle.
 *
 * Table séparée de `MODELS` à dessein : sans elle, `supported` ne décrivait que les badges de l'interface :
 * les adapters omettaient les champs non supportés par simple absence dans
 * leur littéral, si bien que retirer un réglage de `supported` le masquait
 * dans l'interface pendant que la valeur continuait de partir.
 *
 * Le chemin est exprimé depuis la racine du corps ; `null` signale un réglage
 * qui n'a pas de champ dédié (il est fondu dans le prompt, comme la langue).
 */
const PARAM_PATHS: Record<AdapterId, Partial<Record<PayloadParam, string | null>>> = {
  'nano-banana-2': GEMINI_PATHS,
  'nano-banana-2.1': GEMINI_PATHS,
  'gpt-image-2': {
    aspectRatio: 'size',
    resolution: 'quality',
    batch: 'n',
    fileFormat: 'output_format',
    transparent: 'background',
    compression: 'output_compression',
    moderation: 'moderation',
    language: null,
    extraParams: null,
  },
  'gpt-image-2.5-sunburst': {
    aspectRatio: 'size',
    resolution: 'quality',
    batch: 'n',
    fileFormat: 'output_format',
    transparent: 'background',
    compression: 'output_compression',
    moderation: 'moderation',
    language: null,
    extraParams: null,
  },
  'gpt-image-2.5-flare': {
    aspectRatio: 'size',
    resolution: 'quality',
    batch: 'n',
    fileFormat: 'output_format',
    transparent: 'background',
    compression: 'output_compression',
    moderation: 'moderation',
    language: null,
    extraParams: null,
  },
}

function deleteAtPath(target: Record<string, unknown>, path: string) {
  const segments = path.split('.')
  const last = segments.pop()
  if (!last) return

  let node: Record<string, unknown> = target
  for (const segment of segments) {
    const next = node[segment]
    if (typeof next !== 'object' || next === null) return
    node = next as Record<string, unknown>
  }

  delete node[last]
}

/**
 * Retire du corps les champs que ce modèle ne supporte pas.
 *
 * Appelée en fin de chaque `buildPayload`, avant la fusion des paramètres
 * bruts : `capabilities.ts` devient ainsi la seule autorité, et un réglage
 * absent de l'inspecteur est aussi absent du corps.
 */
export function pruneUnsupported<T extends object>(adapterId: AdapterId, payload: T): T {
  const clone = structuredClone(payload) as Record<string, unknown>

  for (const param of ignoredParams(adapterId)) {
    const path = PARAM_PATHS[adapterId][param]
    if (path) deleteAtPath(clone, path)
  }

  return clone as T
}
