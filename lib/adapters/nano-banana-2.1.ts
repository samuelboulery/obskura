import { buildGeminiImagePayload, makeGeminiImageAdapter, type GeminiImagePayload } from './gemini-image'
import type { GenerationRequest } from '@/lib/types'

export function buildNanoBanana21Payload(request: GenerationRequest): GeminiImagePayload {
  return buildGeminiImagePayload('nano-banana-2.1', request)
}

export const nanoBanana21Adapter = makeGeminiImageAdapter('nano-banana-2.1')
