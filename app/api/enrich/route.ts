import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { isJsonRequest, isSameOrigin, readJsonCapped } from '@/lib/origin-guard'
import { MAX_PROMPT_CHARS } from '@/lib/adapters/validate'
import { checkRateLimit, clientKey } from '@/lib/rate-limit'

export interface EnrichRequest {
  prompt: string
  prePrompt: string
  /** Identifiant de modèle, si l'utilisateur veut en imposer un. */
  model?: string
}

export interface EnrichResponse {
  success: boolean
  data?: { prompt: string }
  error?: string
}

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'

/** Deux textes de MAX_PROMPT_CHARS en UTF-8 (4 octets au pire), plus l'enveloppe JSON. */
const MAX_BODY_BYTES = 2 * 4 * MAX_PROMPT_CHARS + 1_000

/** Un identifiant de modèle finit dans le chemin de l'URL amont : ni `/`, ni `?`. */
const MODEL_ID = /^[\w.-]{1,100}$/

export async function POST(req: NextRequest): Promise<NextResponse<EnrichResponse>> {
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

  // Volontairement aucune clé serveur par défaut ici : l'enrichissement
  // consomme la clé de l'utilisateur, jamais celle du dépôt.
  const apiKey = req.headers.get('x-api-key')
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'Aucune clé enregistrée pour l’enrichissement.' },
      { status: 400 }
    )
  }

  const read = await readJsonCapped(req, MAX_BODY_BYTES)
  if (!read.ok) {
    const error = read.status === 413 ? 'Corps de requête trop volumineux' : 'Invalid JSON body'
    return NextResponse.json({ success: false, error }, { status: read.status })
  }

  // Le typage ne vaut rien à l'exécution : chaque champ est vérifié.
  const raw = read.value as Record<string, unknown> | null
  const { prompt, prePrompt, model } = typeof raw === 'object' && raw !== null ? raw : {}

  if (typeof prompt !== 'string' || typeof prePrompt !== 'string' || !prompt.trim() || !prePrompt.trim()) {
    return NextResponse.json(
      { success: false, error: 'prompt et prePrompt sont requis' },
      { status: 400 }
    )
  }

  if (prompt.length > MAX_PROMPT_CHARS || prePrompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json(
      { success: false, error: `prompt et prePrompt sont limités à ${MAX_PROMPT_CHARS} caractères` },
      { status: 400 }
    )
  }

  if (model !== undefined && (typeof model !== 'string' || !MODEL_ID.test(model))) {
    return NextResponse.json({ success: false, error: 'model invalide' }, { status: 400 })
  }

  const body: EnrichRequest = { prompt, prePrompt, model }

  try {
    // Le préfixe de la clé décide du fournisseur : rien d'autre ne le distingue.
    const enriched = apiKey.startsWith('sk-')
      ? await enrichWithOpenAI(apiKey, body)
      : await enrichWithGemini(apiKey, body)

    if (!enriched.trim()) throw new Error('Réponse vide du modèle de texte')

    return NextResponse.json({ success: true, data: { prompt: enriched.trim() } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Ni la clé ni le prompt ne sont journalisés.
    console.error('[enrich] échec de la requête')

    const clientMessage = /api.key|authentication|unauthorized/i.test(message)
      ? 'Clé invalide pour l’enrichissement'
      : /quota|rate.limit|billing/i.test(message)
        ? 'Quota de la clé atteint'
        : "Échec de l'enrichissement"

    return NextResponse.json({ success: false, error: clientMessage }, { status: 500 })
  }
}

async function enrichWithOpenAI(apiKey: string, body: EnrichRequest): Promise<string> {
  const openai = new OpenAI({ apiKey })
  const completion = await openai.chat.completions.create({
    model: body.model || DEFAULT_OPENAI_MODEL,
    messages: [
      { role: 'system', content: body.prePrompt },
      { role: 'user', content: body.prompt },
    ],
  })

  return completion.choices[0]?.message?.content ?? ''
}

async function enrichWithGemini(apiKey: string, body: EnrichRequest): Promise<string> {
  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: body.model || DEFAULT_GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: `${body.prePrompt}\n\n${body.prompt}` }] }],
  })

  return response.text ?? ''
}
