import { buildGptImagePayload, makeGptImageAdapter, type GptImagePayload } from './gpt-image'
import type { GenerationRequest } from '@/lib/types'

export type GptImage26FlarePayload = GptImagePayload

export function buildGptImage26FlarePayload(request: GenerationRequest): GptImage26FlarePayload {
  return buildGptImagePayload('gpt-image-2.6-flare', request)
}

export const gptImage26FlareAdapter = makeGptImageAdapter('gpt-image-2.6-flare')
