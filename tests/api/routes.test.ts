import { afterEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { resetRateLimit } from '@/lib/rate-limit'

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('@/lib/adapters/nano-banana-2', () => ({ nanoBanana2Adapter: { generate } }))

const { POST: generatePOST } = await import('@/app/api/generate/route')
const { POST: enrichPOST } = await import('@/app/api/enrich/route')

const VALIDE = {
  adapterId: 'nano-banana-2',
  prompt: 'un phare',
  params: {
    aspectRatio: '1:1', resolution: '2K', batch: 1, seed: null, seedLock: false,
    fileFormat: 'png', transparent: false, compression: 80,
    personGeneration: 'allow_adult', moderation: 'auto', language: 'fr', extraParams: [],
  },
}

function post(path: string, body: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://obskura.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', ...headers },
    body,
  })
}

afterEach(() => {
  resetRateLimit()
  generate.mockReset()
  vi.restoreAllMocks()
})

describe('/api/generate — journalisation', () => {
  test.each([
    ['clé Gemini', 'AIzaSyDUMMYDUMMYDUMMYDUMMY1234'],
    ['clé OpenAI', 'sk-proj-DUMMYDUMMYDUMMYDUMMY'],
    ['clé de forme inconnue', 'cle-maison-tres-secrete'],
  ])('une %s citée par l’erreur amont ne finit pas dans les logs', async (_, cle) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    generate.mockRejectedValue(new Error(`401 https://api.test/v1?key=${cle} rejected`))

    const res = await generatePOST(post('/api/generate', JSON.stringify(VALIDE), { 'x-api-key': cle }))

    expect(res.status).toBe(500)
    expect(log).toHaveBeenCalled()
    expect(JSON.stringify(log.mock.calls)).not.toContain(cle)
  })
})

describe('/api/enrich — validation du corps', () => {
  test.each([
    ['prompt non textuel', { prompt: 123, prePrompt: 'x' }],
    ['prePrompt objet', { prompt: 'x', prePrompt: {} }],
    ['corps null', null],
    ['corps tableau', ['x']],
    ['model avec chemin', { prompt: 'x', prePrompt: 'y', model: '../files' }],
    ['model avec requête', { prompt: 'x', prePrompt: 'y', model: 'gemini?alt=sse' }],
  ])('%s → 400', async (_, body) => {
    const res = await enrichPOST(post('/api/enrich', JSON.stringify(body), { 'x-api-key': 'k' }))
    expect(res.status).toBe(400)
  })
})

describe('taille du corps — refusée avant la lecture', () => {
  test.each([
    ['/api/generate', generatePOST, 11_000_000],
    ['/api/enrich', enrichPOST, 100_000],
  ] as const)('%s répond 413 au-delà du plafond', async (path, handler, taille) => {
    const res = await handler(post(path, 'x'.repeat(taille), { 'x-api-key': 'k' }))
    expect(res.status).toBe(413)
  })
})

describe('/api/generate — délai amont', () => {
  test('au-delà du délai, l’appel amont est annulé', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let signal: AbortSignal | undefined
    generate.mockImplementation((_req, _key, s?: AbortSignal) => {
      signal = s
      return new Promise(() => {})
    })

    const pending = generatePOST(post('/api/generate', JSON.stringify(VALIDE), { 'x-api-key': 'k' }))
    await vi.advanceTimersByTimeAsync(120_000)
    const res = await pending
    vi.useRealTimers()

    expect(res.status).toBe(500)
    expect(signal?.aborted).toBe(true)
  })
})
