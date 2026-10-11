import { buildGptImage2Payload, type GptImage2Payload } from './gpt-image-2'
import { buildGptImage25SunburstPayload } from './gpt-image-2.5-sunburst'
import { buildGptImage25FlarePayload } from './gpt-image-2.5-flare'
import type { GeminiImagePayload } from './gemini-image'
import { buildNanoBanana2Payload } from './nano-banana-2'
import { buildNanoBanana21Payload } from './nano-banana-2.1'
import type { GenerationRequest } from '@/lib/types'

export type AdapterPayload = GeminiImagePayload | GptImage2Payload

/** Corps réel de la requête, pour le modèle sélectionné. */
export function buildPayload(request: GenerationRequest): AdapterPayload {
  switch (request.adapterId) {
    case 'gpt-image-2': return buildGptImage2Payload(request)
    case 'gpt-image-2.5-sunburst': return buildGptImage25SunburstPayload(request)
    case 'gpt-image-2.5-flare': return buildGptImage25FlarePayload(request)
    case 'nano-banana-2': return buildNanoBanana2Payload(request)
    case 'nano-banana-2.1': return buildNanoBanana21Payload(request)
  }
}

/** Champs qui portent du base64 : `inlineData.data` côté Gemini, `image` côté OpenAI. */
const BASE64_KEYS = new Set(['data', 'image'])

function shorten(value: string): string {
  return value.length > 48 ? `${value.slice(0, 24)}… (${value.length} caractères)` : value
}

/**
 * Version lisible du corps : les données base64 sont raccourcies à l'affichage
 * seulement — ce qui part sur le réseau reste complet.
 */
export function truncateInlineData<T>(value: T, key?: string): T {
  const isBase64Field = key !== undefined && BASE64_KEYS.has(key)

  if (typeof value === 'string') {
    return (isBase64Field ? shorten(value) : value) as T
  }

  if (Array.isArray(value)) {
    return value.map((entry) => truncateInlineData(entry, key)) as T
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entry]) => [
        entryKey,
        truncateInlineData(entry, entryKey),
      ])
    ) as T
  }

  return value
}
