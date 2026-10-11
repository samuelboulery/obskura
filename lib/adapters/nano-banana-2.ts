import { buildGeminiImagePayload, makeGeminiImageAdapter, type GeminiImagePayload } from './gemini-image'
import type { GenerationRequest } from '@/lib/types'

export type NanoBanana2Payload = GeminiImagePayload

export function buildNanoBanana2Payload(request: GenerationRequest): NanoBanana2Payload {
  return buildGeminiImagePayload('nano-banana-2', request)
}

export const nanoBanana2Adapter = makeGeminiImageAdapter('nano-banana-2')
