import { afterEach, describe, expect, test, vi } from 'vitest'
import { mergeExtraParams, serverKey } from '@/lib/adapters/shared'
import { buildNanoBanana2Payload, nanoBanana2Adapter } from '@/lib/adapters/nano-banana-2'
import { gptImage2Adapter } from '@/lib/adapters/gpt-image-2'
import { parseGenerationRequest } from '@/lib/adapters/validate'
import { isJsonRequest, isSameOrigin } from '@/lib/origin-guard'
import { checkRateLimit, clientKey, resetRateLimit } from '@/lib/rate-limit'
import type { GenerationRequest } from '@/lib/types'

describe('extraParams — la soupape ne réécrit pas la requête', () => {
  const payload = { model: 'vrai-modele', contents: ['a'], config: { candidateCount: 1 } }

  test.each([
    'model',
    'contents',
    'config',
    'n',
    'candidateCount',
    'quality',
    'size',
    'moderation',
    'output_format',
  ])('« %s » ne peut pas être écrasé', (cle) => {
    const out = mergeExtraParams(payload, [{ key: cle, value: '"pirate"' }]) as Record<
      string,
      unknown
    >
    expect(out[cle]).not.toBe('pirate')
  })

  test('un champ inconnu passe toujours — la soupape reste ouverte', () => {
    const out = mergeExtraParams(payload, [
      { key: 'futureOption', value: '42' },
    ]) as Record<string, unknown>

    expect(out.futureOption).toBe(42)
    expect(out.model).toBe('vrai-modele')
  })

  test('les clés de prototype sont écartées', () => {
    const out = mergeExtraParams(payload, [
      { key: '__proto__', value: '{"pollue":true}' },
      { key: 'constructor', value: '"x"' },
    ])

    expect((out as Record<string, unknown>).pollue).toBeUndefined()
    expect(({} as Record<string, unknown>).pollue).toBeUndefined()
  })

  test('un extraParams non tabulaire ne lève plus', () => {
    expect(() =>
      mergeExtraParams(payload, 'pas un tableau' as unknown as never)
    ).not.toThrow()
  })

  test('les entrées malformées sont ignorées', () => {
    const out = mergeExtraParams(payload, [
      { key: 42, value: 'x' },
      { key: 'ok', value: '1' },
    ] as unknown as never)

    expect((out as Record<string, unknown>).ok).toBe(1)
  })

  test('le nombre d’entrées est plafonné', () => {
    const beaucoup = Array.from({ length: 100 }, (_, i) => ({ key: `k${i}`, value: '1' }))
    const out = mergeExtraParams({}, beaucoup) as Record<string, unknown>

    expect(Object.keys(out).length).toBeLessThanOrEqual(20)
  })

  // Le contournement complet, tel qu'il était exploitable de bout en bout.
  test('le payload nano-banana-2 résiste à une tentative de réécriture', () => {
    const request = {
      adapterId: 'nano-banana-2',
      prompt: 'un phare',
      params: {
        aspectRatio: '1:1',
        resolution: '2K',
        batch: 1,
        seed: null,
        seedLock: false,
        fileFormat: 'png',
        transparent: false,
        compression: 80,
        personGeneration: 'allow_adult',
        moderation: 'auto',
        language: 'fr',
        extraParams: [
          { key: 'model', value: '"autre-modele"' },
          { key: 'contents', value: '"ecrase"' },
        ],
      },
    } as unknown as GenerationRequest

    const out = buildNanoBanana2Payload(request) as Record<string, unknown>

    expect(out.model).toBe('gemini-3.1-flash-image-preview')
    expect(Array.isArray(out.contents)).toBe(true)
  })
})

describe('garde d’origine', () => {
  function req(headers: Record<string, string>) {
    return new Request('https://atelier.test/api/generate', { method: 'POST', headers })
  }

  test('une requête de même origine passe', () => {
    expect(isSameOrigin(req({ 'sec-fetch-site': 'same-origin' }))).toBe(true)
  })

  test('un appel hors navigateur passe', () => {
    expect(isSameOrigin(req({ 'sec-fetch-site': 'none' }))).toBe(true)
  })

  test('une requête cross-site est refusée', () => {
    expect(isSameOrigin(req({ 'sec-fetch-site': 'cross-site' }))).toBe(false)
    expect(isSameOrigin(req({ 'sec-fetch-site': 'same-site' }))).toBe(false)
  })

  test('sans Fetch Metadata, l’hôte de l’Origin décide', () => {
    expect(isSameOrigin(req({ origin: 'https://atelier.test' }))).toBe(true)
    expect(isSameOrigin(req({ origin: 'https://pirate.test' }))).toBe(false)
    expect(isSameOrigin(req({ origin: 'pas-une-url' }))).toBe(false)
  })

  // C'est ce qui retire aux pages tierces la requête « simple » sans préflight.
  test('seul application/json est accepté', () => {
    expect(isJsonRequest(req({ 'content-type': 'application/json' }))).toBe(true)
    expect(isJsonRequest(req({ 'content-type': 'text/plain' }))).toBe(false)
    expect(isJsonRequest(req({}))).toBe(false)
  })
})

describe('rate limit', () => {
  function req(xff?: string) {
    return new Request('https://atelier.test/api/generate', {
      method: 'POST',
      headers: xff ? { 'x-forwarded-for': xff } : {},
    })
  }

  test('sans proxy déclaré, X-Forwarded-For est ignoré', () => {
    // Sinon un client change d'identité à chaque requête et la limite ne
    // s'applique jamais.
    expect(clientKey(req('1.2.3.4'))).toBe('local')
    expect(clientKey(req('9.9.9.9'))).toBe('local')
  })

  test('la limite tient malgré un X-Forwarded-For variable', () => {
    resetRateLimit()

    const résultats = Array.from({ length: 12 }, (_, i) =>
      checkRateLimit(clientKey(req(`10.0.0.${i}`)))
    )

    expect(résultats.filter((r) => r.allowed).length).toBe(10)
    expect(résultats.at(-1)?.allowed).toBe(false)
  })

  test('la fenêtre finit par se rouvrir', () => {
    resetRateLimit()
    for (let i = 0; i < 10; i++) checkRateLimit('test-ip')

    expect(checkRateLimit('test-ip').allowed).toBe(false)
    expect(checkRateLimit('test-ip').retryAfter).toBeGreaterThan(0)
  })
})

describe('rate limit — en-tête IP de la plateforme', () => {
  afterEach(() => vi.unstubAllEnvs())

  function req(ip: string) {
    return new Request('https://atelier.test/api/generate', {
      method: 'POST',
      headers: { 'x-nf-client-connection-ip': ip },
    })
  }

  test('déclaré par TRUSTED_IP_HEADER, il distingue les clients', () => {
    vi.stubEnv('TRUSTED_IP_HEADER', 'x-nf-client-connection-ip')
    resetRateLimit()
    for (let i = 0; i < 10; i++) checkRateLimit(clientKey(req('1.1.1.1')))

    // Un client qui épuise sa limite ne bloque plus les autres.
    expect(checkRateLimit(clientKey(req('2.2.2.2'))).allowed).toBe(true)
    expect(checkRateLimit(clientKey(req('1.1.1.1'))).allowed).toBe(false)
  })

  test('non déclaré, il est ignoré — un client pourrait le forger', () => {
    vi.stubEnv('TRUSTED_IP_HEADER', '')
    expect(clientKey(req('1.1.1.1'))).toBe('local')
  })
})

describe('clé serveur — repli sur opt-in en production', () => {
  afterEach(() => vi.unstubAllEnvs())

  test('en production, sans ALLOW_SERVER_KEY, aucune clé serveur', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_SERVER_KEY', '')
    vi.stubEnv('GEMINI_API_KEY', 'cle-serveur')
    expect(serverKey('GEMINI_API_KEY')).toBeUndefined()
  })

  test('en production, ALLOW_SERVER_KEY=1 réactive le repli', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_SERVER_KEY', '1')
    vi.stubEnv('GEMINI_API_KEY', 'cle-serveur')
    expect(serverKey('GEMINI_API_KEY')).toBe('cle-serveur')
  })

  test('en développement, .env.local suffit', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('OPENAI_API_KEY', 'cle-locale')
    expect(serverKey('OPENAI_API_KEY')).toBe('cle-locale')
  })

  const requete = () => parseGenerationRequest({
    adapterId: 'nano-banana-2',
    prompt: 'un phare',
    params: {
      aspectRatio: '1:1', resolution: '2K', batch: 1, seed: null, seedLock: false,
      fileFormat: 'png', transparent: false, compression: 80,
      personGeneration: 'allow_adult', moderation: 'auto', language: 'fr', extraParams: [],
    },
  })

  test.each([
    ['nano-banana-2', nanoBanana2Adapter, 'GEMINI_API_KEY'],
    ['gpt-image-2', gptImage2Adapter, 'OPENAI_API_KEY'],
  ] as const)('%s refuse un appel sans clé client en production', async (_, adapter, env) => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ALLOW_SERVER_KEY', '')
    vi.stubEnv(env, 'cle-serveur')
    await expect(adapter.generate(requete(), undefined)).rejects.toThrow(/Aucune clé/)
  })
})
