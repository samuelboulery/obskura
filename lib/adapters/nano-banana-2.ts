import { GoogleGenAI } from '@google/genai'
import { pruneUnsupported } from './capabilities'
import { composePrompt, mergeExtraParams, mergeNegatives, resolveSeed, serverKey } from './shared'
import type {
  GenerateImageAdapter,
  GenerationRequest,
  GenerationResult,
  ReferenceImage,
} from '@/lib/types'

const MODEL_ID = 'gemini-3.1-flash-image-preview'

function imagePart(image: ReferenceImage, weight: number) {
  return {
    inlineData: {
      mimeType: image.mimeType,
      data: image.base64,
      weight: Math.round(weight) / 100,
    },
  }
}

/**
 * Corps exact envoyé au modèle. Fonction pure : le panneau JSON affiche son
 * résultat, `generate()` l'envoie — il n'y a pas deux vérités.
 */
export type NanoBanana2Payload = {
  model: string
  contents: { role: string; parts: object[] }[]
  config: Record<string, unknown>
} & Record<string, unknown>

export function buildNanoBanana2Payload(request: GenerationRequest): NanoBanana2Payload {
  const { params } = request
  const negative = mergeNegatives(request.negative, request.recipeNegative)
  const connector = params.language === 'en' ? 'Avoid:' : 'À éviter :'

  const instructions: string[] = []
  if (request.identityLock) instructions.push("Conserve l'identité exacte du sujet de référence")
  if (request.paletteTransfer) instructions.push('Reprends la palette des références de style')

  const suffix = [request.promptSuffix, ...instructions].filter(Boolean).join(', ') || undefined

  const parts: object[] = [{ text: composePrompt(request.prompt, suffix, negative, connector) }]

  for (const image of request.subjectImages ?? []) {
    parts.push(imagePart(image, request.subjectWeight ?? 50))
  }
  for (const image of request.styleImages ?? []) {
    parts.push(imagePart(image, request.styleWeight ?? 50))
  }

  const payload = {
    model: MODEL_ID,
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['IMAGE'],
      candidateCount: params.batch,
      imageConfig: { aspectRatio: params.aspectRatio, imageSize: params.resolution },
      personGeneration: params.personGeneration,
      seed: resolveSeed(params, request.drawnSeed ?? null),
    },
  }

  // `capabilities.ts` décide de ce qui part : le badge « ignoré ici » et
  // l'élagage viennent désormais de la même table.
  return mergeExtraParams(pruneUnsupported('nano-banana-2', payload), params.extraParams)
}

export const nanoBanana2Adapter: GenerateImageAdapter = {
  /**
   * @param request - Prompt, références et réglages déjà résolus côté client.
   * @param apiKeyOverride - Clé de l'utilisateur, prioritaire sur GEMINI_API_KEY.
   * @throws Si aucune clé n'est configurée ou si l'API ne retourne aucune image.
   */
  async generate(
    request: GenerationRequest,
    apiKeyOverride?: string,
    signal?: AbortSignal
  ): Promise<GenerationResult[]> {
    const apiKey = apiKeyOverride ?? serverKey('GEMINI_API_KEY')
    if (!apiKey) {
      throw new Error(
        "Aucune clé API configurée — renseignez-la dans l'interface ou dans .env.local"
      )
    }

    const ai = new GoogleGenAI({ apiKey })
    const payload = buildNanoBanana2Payload(request) as Parameters<
      typeof ai.models.generateContent
    >[0]

    const response = await ai.models.generateContent({
      ...payload,
      config: { ...payload.config, abortSignal: signal },
    })

    const images: GenerationResult[] = (response.candidates ?? []).flatMap((candidate) =>
      (candidate.content?.parts ?? [])
        .filter((part) => part.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data)
        .map((part) => ({
          imageBase64: part.inlineData!.data!,
          mimeType: part.inlineData!.mimeType ?? 'image/png',
        }))
    )

    if (images.length === 0) throw new Error('No image returned from Nano Banana 2')

    return images
  },
}
