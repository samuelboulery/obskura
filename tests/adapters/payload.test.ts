import { describe, expect, test } from 'vitest'
import { buildNanoBanana2Payload } from '@/lib/adapters/nano-banana-2'
import { buildGptImage2Payload } from '@/lib/adapters/gpt-image-2'
import { ignoredParams } from '@/lib/adapters/capabilities'
import { drawSeed, mergeNegatives, resolveSeed } from '@/lib/adapters/shared'
import { DEFAULT_PARAMS } from '@/lib/atelier/params'
import type { GenerationRequest } from '@/lib/types'

function request(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    adapterId: 'nano-banana-2',
    prompt: 'un vase en céramique sur fond de lin',
    negative: 'flou',
    promptSuffix: 'lumière rasante',
    params: { ...DEFAULT_PARAMS, ...overrides.params },
    ...overrides,
  }
}

describe('négatif', () => {
  test('fusionne le négatif du prompt et celui du preset en dédupliquant', () => {
    expect(mergeNegatives('flou, watermark', 'Watermark, texte')).toBe('flou, watermark, texte')
  })

  test('ignore les entrées vides', () => {
    expect(mergeNegatives('', undefined)).toBe('')
    expect(mergeNegatives('flou,  , flou', '')).toBe('flou')
  })
})

describe('graine', () => {
  test('une graine verrouillée est renvoyée telle quelle', () => {
    expect(resolveSeed({ ...DEFAULT_PARAMS, seed: 4471902, seedLock: true }, 1234567)).toBe(4471902)
  })

  test('sans verrou, la graine tirée par l’appelant est reprise', () => {
    expect(resolveSeed({ ...DEFAULT_PARAMS, seed: 4471902, seedLock: false }, 1234567)).toBe(1234567)
  })

  test('resolveSeed est pure : deux appels identiques rendent la même valeur', () => {
    const params = { ...DEFAULT_PARAMS, seed: null, seedLock: false }
    expect(resolveSeed(params, 999)).toBe(resolveSeed(params, 999))
  })

  test('drawSeed tire bien sept chiffres', () => {
    expect(String(drawSeed())).toHaveLength(7)
  })
})

describe('buildNanoBanana2Payload', () => {
  test('reproduit le corps de référence du handoff', () => {
    const payload = buildNanoBanana2Payload(
      request({
        subjectImages: [{ base64: 'SUJET', mimeType: 'image/jpeg' }],
        subjectWeight: 75,
        styleImages: [{ base64: 'STYLE', mimeType: 'image/jpeg' }],
        styleWeight: 65,
        params: {
          ...DEFAULT_PARAMS,
          batch: 4,
          seed: 4471902,
          seedLock: true,
          aspectRatio: '1:1',
          resolution: '2K',
          personGeneration: 'allow_adult',
        },
      })
    )

    expect(payload).toEqual({
      model: 'gemini-3.1-flash-image',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'un vase en céramique sur fond de lin, lumière rasante. À éviter : flou',
            },
            { inlineData: { mimeType: 'image/jpeg', data: 'SUJET', weight: 0.75 } },
            { inlineData: { mimeType: 'image/jpeg', data: 'STYLE', weight: 0.65 } },
          ],
        },
      ],
      config: {
        responseModalities: ['IMAGE'],
        candidateCount: 4,
        imageConfig: { aspectRatio: '1:1', imageSize: '2K' },
        personGeneration: 'allow_adult',
        seed: 4471902,
      },
    })
  })

  test('écarte les paramètres non supportés et fusionne les paramètres bruts en dernier', () => {
    const payload = buildNanoBanana2Payload(
      request({
        params: {
          ...DEFAULT_PARAMS,
          seed: 1234567,
          seedLock: true,
          fileFormat: 'webp',
          transparent: true,
          extraParams: [{ key: 'safetySettings', value: '[]' }],
        },
      })
    ) as Record<string, unknown>

    expect(payload).not.toHaveProperty('output_format')
    expect(payload).not.toHaveProperty('background')
    expect(payload.safetySettings).toEqual([])
  })
})

describe('buildGptImage2Payload', () => {
  test('reproduit le corps de référence du handoff', () => {
    const payload = buildGptImage2Payload(
      request({
        adapterId: 'gpt-image-2',
        subjectImages: [{ base64: 'SUJET', mimeType: 'image/jpeg' }],
        styleImages: [{ base64: 'STYLE', mimeType: 'image/jpeg' }],
        params: {
          ...DEFAULT_PARAMS,
          batch: 4,
          resolution: '2K',
          aspectRatio: '1:1',
          fileFormat: 'png',
          transparent: false,
          moderation: 'auto',
        },
      })
    )

    expect(payload).toEqual({
      model: 'gpt-image-2',
      prompt: 'un vase en céramique sur fond de lin, lumière rasante. Avoid: flou',
      n: 4,
      size: '1024x1024',
      quality: 'medium',
      background: 'opaque',
      output_format: 'png',
      output_compression: null,
      moderation: 'auto',
      image: ['SUJET', 'STYLE'],
    })
  })

  test('mappe résolution et format selon le handoff', () => {
    const sizes: [GenerationRequest['params']['aspectRatio'], string][] = [
      ['1:1', '1024x1024'],
      ['16:9', '1536x864'],
      ['9:16', '864x1536'],
      ['4:3', '1280x960'],
    ]

    for (const [aspectRatio, size] of sizes) {
      const payload = buildGptImage2Payload(
        request({ adapterId: 'gpt-image-2', params: { ...DEFAULT_PARAMS, aspectRatio } })
      ) as Record<string, unknown>
      expect(payload.size).toBe(size)
    }

    const qualities: [GenerationRequest['params']['resolution'], string][] = [
      ['1K', 'low'],
      ['2K', 'medium'],
      ['4K', 'high'],
    ]

    for (const [resolution, quality] of qualities) {
      const payload = buildGptImage2Payload(
        request({ adapterId: 'gpt-image-2', params: { ...DEFAULT_PARAMS, resolution } })
      ) as Record<string, unknown>
      expect(payload.quality).toBe(quality)
    }
  })

  test('la compression ne part qu’en dehors du PNG', () => {
    const png = buildGptImage2Payload(
      request({ adapterId: 'gpt-image-2', params: { ...DEFAULT_PARAMS, compression: 60 } })
    ) as Record<string, unknown>
    expect(png.output_compression).toBeNull()

    const jpeg = buildGptImage2Payload(
      request({
        adapterId: 'gpt-image-2',
        params: { ...DEFAULT_PARAMS, fileFormat: 'jpeg', compression: 60 },
      })
    ) as Record<string, unknown>
    expect(jpeg.output_compression).toBe(60)
  })

  test('la graine ne part jamais vers gpt-image-2', () => {
    const payload = buildGptImage2Payload(
      request({
        adapterId: 'gpt-image-2',
        params: { ...DEFAULT_PARAMS, seed: 4471902, seedLock: true },
      })
    ) as Record<string, unknown>

    expect(payload).not.toHaveProperty('seed')
    expect(ignoredParams('gpt-image-2')).toContain('seed')
  })
})
