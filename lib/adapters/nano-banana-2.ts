import { buildGeminiImagePayload, makeGeminiImageAdapter, type GeminiImagePayload } from './gemini-image'
import type { GenerationRequest } from '@/lib/types'

export function buildNanoBanana2Payload(request: GenerationRequest): GeminiImagePayload {
  return buildGeminiImagePayload('nano-banana-2', request)
}

export const nanoBanana2Adapter = makeGeminiImageAdapter('nano-banana-2')
