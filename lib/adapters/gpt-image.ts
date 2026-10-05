import OpenAI, { toFile } from 'openai'
import { GPT_SIZES, pruneUnsupported } from './capabilities'
import { composePrompt, mergeExtraParams, mergeNegatives, serverKey } from './shared'
import type {
  AdapterId,
  GenerateImageAdapter,
  GenerationRequest,
  GenerationResult,
  ReferenceImage,
  Resolution,
} from '@/lib/types'

/** Les trois modèles OpenAI ne diffèrent que par leur identifiant et leurs crans de qualité. */
export type GptImageModelId = Extract<AdapterId, `gpt-image-${string}`>

/**
 * `resolution` porte la qualité chez OpenAI. 6K et 8K n'existent que pour les
 * 2.5 : la route les refuse ailleurs (`resolutionsOf`), la table reste
 * exhaustive pour le compilateur.
 */
const QUALITIES: Record<Resolution, string> = {
  '1K': 'low',
  '2K': 'medium',
  '4K': 'high',
  '6K': 'xhigh',
  '8K': 'max',
}

/**
 * Corps envoyé à OpenAI. `mergeExtraParams` peut y ajouter des clés inconnues
 * — d'où l'index signature, qui dit la vérité plutôt que de la masquer sous
 * une assertion.
 */
export type GptImagePayload = {
  model: string
  prompt: string
  n: number
  size: string
  quality?: string
  background?: string
  output_format?: string
  output_compression?: number | null
  moderation?: string
  image: string[]
} & Record<string, unknown>

/** Corps exact envoyé au modèle — même fonction pour l'envoi et pour l'onglet JSON. */
export function buildGptImagePayload(
  modelId: GptImageModelId,
  request: GenerationRequest
): GptImagePayload {
  const { params } = request
  const negative = mergeNegatives(request.negative, request.recipeNegative)
  const connector = params.language === 'fr' ? 'À éviter :' : 'Avoid:'

  const instructions: string[] = []
  if (request.identityLock) instructions.push('keep the exact identity of the reference subject')
  if (request.paletteTransfer) instructions.push('reuse the palette of the style references')

  const suffix = [request.promptSuffix, ...instructions].filter(Boolean).join(', ') || undefined

  const references: ReferenceImage[] = [
    ...(request.subjectImages ?? []),
    ...(request.styleImages ?? []),
  ]

  const payload = {
    model: modelId,
    prompt: composePrompt(request.prompt, suffix, negative, connector),
    n: params.batch,
    size: GPT_SIZES[params.aspectRatio] ?? '1024x1024',
    quality: QUALITIES[params.resolution],
    background: params.transparent ? 'transparent' : 'opaque',
    output_format: params.fileFormat,
    // Le PNG n'a pas de compression.
    output_compression: params.fileFormat === 'png' ? null : params.compression,
    moderation: params.moderation,
    image: references.map((image) => image.base64),
  }

  return mergeExtraParams(pruneUnsupported(modelId, payload), params.extraParams)
}

async function referenceToFile(image: ReferenceImage, name: string) {
  return toFile(Buffer.from(image.base64, 'base64'), name, { type: image.mimeType })
}

export function makeGptImageAdapter(modelId: GptImageModelId): GenerateImageAdapter {
  return {
    async generate(
      request: GenerationRequest,
      apiKeyOverride?: string
    ): Promise<GenerationResult[]> {
      const apiKey = apiKeyOverride ?? serverKey('OPENAI_API_KEY')
      if (!apiKey) {
        throw new Error(
          "Aucune clé API OpenAI configurée — renseignez-la dans l'interface ou dans .env.local"
        )
      }

      const openai = new OpenAI({ apiKey })
      const payload = buildGptImagePayload(modelId, request)

      const references = [...(request.subjectImages ?? []), ...(request.styleImages ?? [])]

      // `images.generate` et `images.edit` ont des signatures distinctes : les
      // champs communs sont typés une fois, chaque appel reçoit les siens. Le
      // `any` précédent masquait cette divergence au lieu de la traiter.
      const common = {
        model: payload.model,
        prompt: payload.prompt,
        n: payload.n,
        size: payload.size,
        quality: payload.quality,
        output_format: payload.output_format,
        moderation: payload.moderation,
        ...(payload.output_compression !== null &&
          payload.output_compression !== undefined && {
            output_compression: payload.output_compression,
          }),
        ...(payload.background === 'transparent' && { background: 'transparent' }),
      } satisfies Record<string, unknown>

      const response =
        references.length > 0
          ? await openai.images.edit({
              ...common,
              image: await Promise.all(
                references.map((image, index) => referenceToFile(image, `ref-${index}.png`))
              ),
            } as unknown as OpenAI.Images.ImageEditParamsNonStreaming)
          : await openai.images.generate(
              common as unknown as OpenAI.Images.ImageGenerateParamsNonStreaming
            )

      const images: GenerationResult[] = (response.data ?? [])
        .filter((entry) => entry.b64_json)
        .map((entry) => ({
          imageBase64: entry.b64_json as string,
          mimeType: `image/${payload.output_format}`,
        }))

      if (images.length === 0) throw new Error(`No image returned from ${modelId}`)

      return images
    },
  }
}
