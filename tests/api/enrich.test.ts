import { afterEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { resetRateLimit } from '@/lib/rate-limit'
import { enrichProvider } from '@/lib/enrich'

const { create } = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create }
  },
}))

const { POST } = await import('@/app/api/enrich/route')

const ANTHROPIC_KEY = 'sk-ant-api03-DUMMY'

function enrich(body: Record<string, unknown>, apiKey = ANTHROPIC_KEY) {
  return POST(
    new NextRequest('https://obskura.test/api/enrich', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'sec-fetch-site': 'same-origin',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    })
  )
}

afterEach(() => {
  resetRateLimit()
  create.mockReset()
})

describe('enrichProvider — le préfixe de la clé choisit le fournisseur', () => {
  test.each([
    ['sk-ant-api03-abc', 'anthropic'],
    ['sk-proj-abc', 'openai'],
    ['sk-abc', 'openai'],
    ['AIzaSyabc', 'gemini'],
  ] as const)('%s → %s', (key, provider) => {
    expect(enrichProvider(key)).toBe(provider)
  })
})

describe('/api/enrich — Anthropic', () => {
  test('une clé Anthropic part chez Claude Haiku par défaut, consigne en system', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'un phare sous la pluie, 35 mm' }] })

    const res = await enrich({ prompt: 'un phare', prePrompt: 'Réécris.' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: { prompt: 'un phare sous la pluie, 35 mm' } })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-5-5',
        system: 'Réécris.',
        messages: [{ role: 'user', content: 'un phare' }],
      })
    )
  })

  test('le modèle choisi par l’utilisateur remplace celui par défaut', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] })

    await enrich({ prompt: 'un phare', prePrompt: 'Réécris.', model: 'claude-sonnet-5-5' })

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-sonnet-5-5' }))
  })

  test.each([
    ['401 {"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}', 'Clé invalide pour l’enrichissement'],
    ['404 {"type":"error","error":{"type":"not_found_error","message":"model: claude-x"}}', 'Modèle introuvable pour cette clé'],
  ])('erreur amont « %s » → message lisible', async (amont, attendu) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    create.mockRejectedValue(new Error(amont))

    const res = await enrich({ prompt: 'un phare', prePrompt: 'Réécris.', model: 'claude-x' })

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe(attendu)
  })
})
