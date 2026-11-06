import { buildGptImagePayload, makeGptImageAdapter, type GptImagePayload } from './gpt-image'
import type { GenerationRequest } from '@/lib/types'

export type GptImage26SunburstPayload = GptImagePayload

export function buildGptImage26SunburstPayload(request: GenerationRequest): GptImage26SunburstPayload {
  return buildGptImagePayload('gpt-image-2.6-sunburst', request)
}

export const gptImage26SunburstAdapter = makeGptImageAdapter('gpt-image-2.6-sunburst')
