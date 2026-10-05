import { NextRequest, NextResponse } from 'next/server'
import { nanoBanana2Adapter } from '@/lib/adapters/nano-banana-2'
import { gptImage2Adapter } from '@/lib/adapters/gpt-image-2'
import { gptImage25SunburstAdapter } from '@/lib/adapters/gpt-image-2.5-sunburst'
import { gptImage25FlareAdapter } from '@/lib/adapters/gpt-image-2.5-flare'
import { redactSecrets, toClientMessage } from '@/lib/adapters/errors'
import {
  BadRequestError,
  MAX_GENERATE_BODY_BYTES,
  PayloadTooLargeError,
  parseGenerationRequest,
} from '@/lib/adapters/validate'
import { isJsonRequest, isSameOrigin, readJsonCapped } from '@/lib/origin-guard'
import { checkRateLimit, clientKey } from '@/lib/rate-limit'
import type { AdapterId, GenerateImageAdapter, GenerateResponse } from '@/lib/types'

const ADAPTERS: Record<AdapterId, GenerateImageAdapter> = {
  'nano-banana-2': nanoBanana2Adapter,
  'gpt-image-2': gptImage2Adapter,
  'gpt-image-2.5-sunburst': gptImage25SunburstAdapter,
  'gpt-image-2.5-flare': gptImage25FlareAdapter,
}

/** Une génération 4K peut être longue ; au-delà, la connexion est perdue pour rien. */
const UPSTREAM_TIMEOUT_MS = 120_000

export async function POST(req: NextRequest): Promise<NextResponse<GenerateResponse>> {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ success: false, error: 'Origine refusée' }, { status: 403 })
  }

  if (!isJsonRequest(req)) {
    return NextResponse.json(
      { success: false, error: 'Content-Type attendu : application/json' },
      { status: 415 }
    )
  }

  const { allowed, retryAfter } = checkRateLimit(clientKey(req))

  if (!allowed) {
    return NextResponse.json(
      { success: false, error: `Trop de requêtes — réessayer dans ${retryAfter} s` },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const read = await readJsonCapped(req, MAX_GENERATE_BODY_BYTES)
  if (!read.ok) {
    const error = read.status === 413 ? 'Corps de requête trop volumineux' : 'Invalid JSON body'
    return NextResponse.json({ success: false, error }, { status: read.status })
  }
  const raw = read.value

  // Le typage de `req.json()` ne vaut rien à l'exécution : tout est vérifié ici.
  let body
  try {
    body = parseGenerationRequest(raw)
  } catch (err) {
    if (err instanceof BadRequestError || err instanceof PayloadTooLargeError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status })
    }
    throw err
  }

  // Un en-tête présent mais vide vaut '' : `??` le laisserait passer et il
  // masquerait alors le repli serveur de l'adapter.
  const apiKey = req.headers.get('x-api-key')?.trim() || undefined
  const adapter = ADAPTERS[body.adapterId]

  try {
    const results = await Promise.race([
      adapter.generate(body, apiKey),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Délai dépassé par le modèle')),
          UPSTREAM_TIMEOUT_MS
        )
      ),
    ])

    return NextResponse.json({ success: true, data: results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[generate]', redactSecrets(message, apiKey))

    return NextResponse.json(
      { success: false, error: toClientMessage(message) },
      { status: 500 }
    )
  }
}
