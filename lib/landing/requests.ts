import {
  ADAPTERS,
  fitParams,
  MODELS,
  PARAM_LABELS,
  supports,
  type PayloadParam,
} from '@/lib/adapters/capabilities'
import { buildPayload } from '@/lib/adapters/payload'
import { DEFAULT_PRICING, formatEur } from '@/lib/atelier/cost'
import { DEFAULT_PARAMS } from '@/lib/atelier/params'
import type { AdapterId, GenerationParams, GenerationRequest } from '@/lib/types'
import {
  COMPARE_MODEL,
  LANDING_NEGATIVE,
  LANDING_PROMPTS,
  SCENE_MODEL,
  type LandingPrompt,
} from './content'
import { formatJson } from './format'

/**
 * Côté serveur seulement : `buildPayload` tire les adapters, donc les SDK.
 * La landing affiche ce que l'app enverrait pour la même saisie, graine
 * verrouillée, en 16:9 et 2K.
 */
export function landingRequest(prompt: LandingPrompt, adapterId: AdapterId): GenerationRequest {
  const params: GenerationParams = {
    ...DEFAULT_PARAMS,
    aspectRatio: '16:9',
    resolution: '2K',
    seed: prompt.seed,
    seedLock: true,
    language: 'fr',
  }
  return { adapterId, prompt: prompt.prompt, negative: LANDING_NEGATIVE, params: fitParams(params, adapterId) }
}

export interface LandingPayload {
  /** Nom du modèle chez le fournisseur, tel qu'il part dans le corps. */
  upstream: string
  text: string
  bytes: number
}

export interface LandingSetting {
  param: PayloadParam
  label: string
  value: string
  ignoredBy: AdapterId[]
}

export interface LandingDiffRow {
  label: string
  /** Valeur envoyée par le modèle de la scène, `null` s'il ignore le réglage. */
  a: string | null
  b: string | null
}

export interface LandingCase extends LandingPrompt {
  payloads: Record<AdapterId, LandingPayload>
  settings: LandingSetting[]
  diff: LandingDiffRow[]
}

/** La landing garde le terme technique « seed », que l'on retrouve dans le corps envoyé. */
const LABELS: Record<PayloadParam, string> = { ...PARAM_LABELS, seed: 'seed' }

const SETTING_PARAMS: PayloadParam[] = [
  'aspectRatio',
  'resolution',
  'batch',
  'seed',
  'fileFormat',
  'transparent',
  'compression',
  'personGeneration',
  'moderation',
]

const DIFF_PARAMS: PayloadParam[] = [
  'aspectRatio',
  'resolution',
  'batch',
  'seed',
  'personGeneration',
  'fileFormat',
  'moderation',
]

function display(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'oui' : 'non'
  return String(value)
}

/** Ce que le modèle reçoit vraiment pour ce réglage : OpenAI traduit format et résolution. */
function sentValue(adapterId: AdapterId, param: PayloadParam, params: GenerationParams): string | null {
  if (!supports(adapterId, param)) return null
  const spec = MODELS[adapterId]
  if (param === 'aspectRatio' && spec.sizes) return spec.sizes[params.aspectRatio]
  if (param === 'resolution') {
    return spec.resolution.options.find((o) => o.value === params.resolution)?.label ?? params.resolution
  }
  return display(params[param])
}

function payloadOf(request: GenerationRequest): LandingPayload {
  const payload = buildPayload(request)
  return {
    upstream: String(payload.model),
    text: formatJson(payload),
    bytes: new TextEncoder().encode(JSON.stringify(payload)).length,
  }
}

export function landingCases(): LandingCase[] {
  return LANDING_PROMPTS.map((prompt) => {
    const requests = Object.fromEntries(ADAPTERS.map((id) => [id, landingRequest(prompt, id)])) as Record<
      AdapterId,
      GenerationRequest
    >
    const params = requests[SCENE_MODEL].params
    return {
      ...prompt,
      payloads: Object.fromEntries(ADAPTERS.map((id) => [id, payloadOf(requests[id])])) as Record<
        AdapterId,
        LandingPayload
      >,
      settings: SETTING_PARAMS.map((param) => ({
        param,
        label: LABELS[param],
        value: display(params[param]),
        ignoredBy: ADAPTERS.filter((id) => !supports(id, param)),
      })),
      diff: [
        { label: 'prompt', a: prompt.prompt, b: prompt.prompt },
        ...DIFF_PARAMS.map((param) => ({
          label: LABELS[param],
          a: sentValue(SCENE_MODEL, param, requests[SCENE_MODEL].params),
          b: sentValue(COMPARE_MODEL, param, requests[COMPARE_MODEL].params),
        })),
        {
          label: 'coût estimé',
          a: formatEur(DEFAULT_PRICING[SCENE_MODEL]),
          b: formatEur(DEFAULT_PRICING[COMPARE_MODEL]),
        },
      ],
    }
  })
}
