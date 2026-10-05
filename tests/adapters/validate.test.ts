import { describe, expect, test } from 'vitest'
import {
  BadRequestError,
  MAX_PROMPT_CHARS,
  MAX_REFERENCE_BASE64_CHARS,
  PayloadTooLargeError,
  parseGenerationRequest,
} from '@/lib/adapters/validate'

/** Corps minimal valide — chaque test n'en modifie qu'un aspect. */
function body(overrides: Record<string, unknown> = {}) {
  return {
    adapterId: 'nano-banana-2',
    prompt: 'un phare dans la tempête',
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
      extraParams: [],
    },
    ...overrides,
  }
}

function params(overrides: Record<string, unknown>) {
  return body({ params: { ...body().params, ...overrides } })
}

describe('validation en frontière', () => {
  test('un corps conforme passe', () => {
    const parsed = parseGenerationRequest(body())
    expect(parsed.prompt).toBe('un phare dans la tempête')
    expect(parsed.params.batch).toBe(1)
  })

  // Le cas qui motivait le ticket : `batch` est typé 1|2|4|8, mais rien ne le
  // contraignait à l'exécution — 10 000 images partaient sur la clé serveur.
  test('un batch hors énumération est rejeté', () => {
    expect(() => parseGenerationRequest(params({ batch: 10_000 }))).toThrow(BadRequestError)
    expect(() => parseGenerationRequest(params({ batch: 3 }))).toThrow(BadRequestError)
  })

  test('personGeneration et moderation ne sont pas forçables', () => {
    expect(() => parseGenerationRequest(params({ personGeneration: 'tout' }))).toThrow(
      BadRequestError
    )
    expect(() => parseGenerationRequest(params({ moderation: 'aucune' }))).toThrow(BadRequestError)
  })

  test.each([
    ['aspectRatio', '3:2'],
    ['resolution', '10K'],
    ['fileFormat', 'gif'],
    ['language', 'de'],
  ])('%s hors énumération est rejeté', (champ, valeur) => {
    expect(() => parseGenerationRequest(params({ [champ]: valeur }))).toThrow(BadRequestError)
  })

  test('un adapterId inconnu est rejeté au lieu de retomber sur Gemini', () => {
    expect(() => parseGenerationRequest(body({ adapterId: 'modele-pirate' }))).toThrow(
      BadRequestError
    )
    expect(() => parseGenerationRequest(body({ adapterId: undefined }))).toThrow(BadRequestError)
  })

  test('un prompt vide ou démesuré est rejeté', () => {
    expect(() => parseGenerationRequest(body({ prompt: '   ' }))).toThrow(BadRequestError)
    expect(() => parseGenerationRequest(body({ prompt: 'a'.repeat(MAX_PROMPT_CHARS + 1) }))).toThrow(
      BadRequestError
    )
  })

  test('la compression reste dans ses bornes', () => {
    expect(() => parseGenerationRequest(params({ compression: 5 }))).toThrow(BadRequestError)
    expect(() => parseGenerationRequest(params({ compression: 300 }))).toThrow(BadRequestError)
  })

  test('une graine non entière est rejetée', () => {
    expect(() => parseGenerationRequest(params({ seed: 'abc' }))).toThrow(BadRequestError)
    expect(parseGenerationRequest(params({ seed: null })).params.seed).toBeNull()
  })

  test('extraParams non tabulaire est rejeté — il faisait planter la route en 500', () => {
    expect(() => parseGenerationRequest(params({ extraParams: 'x' }))).toThrow(BadRequestError)
  })

  test('une image de référence sans mime image est rejetée', () => {
    expect(() =>
      parseGenerationRequest(
        body({ subjectImages: [{ base64: 'AAAA', mimeType: 'application/json' }] })
      )
    ).toThrow(BadRequestError)
  })

  test.each(['image/svg+xml', 'image/x-anything'])('le mime %s est rejeté', (mimeType) => {
    expect(() =>
      parseGenerationRequest(body({ subjectImages: [{ base64: 'AAAA', mimeType }] }))
    ).toThrow(BadRequestError)
  })

  test.each(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])('le mime %s passe', (mimeType) => {
    expect(() =>
      parseGenerationRequest(body({ subjectImages: [{ base64: 'AAAA', mimeType }] }))
    ).not.toThrow()
  })

  test('des références trop volumineuses lèvent un 413', () => {
    expect(() =>
      parseGenerationRequest(
        body({
          subjectImages: [
            { base64: 'A'.repeat(MAX_REFERENCE_BASE64_CHARS + 1), mimeType: 'image/png' },
          ],
        })
      )
    ).toThrow(PayloadTooLargeError)
  })

  test('les poids restent entre 0 et 100', () => {
    expect(() => parseGenerationRequest(body({ subjectWeight: 500 }))).toThrow(BadRequestError)
    expect(parseGenerationRequest(body({ subjectWeight: 75 })).subjectWeight).toBe(75)
  })

  test('un corps qui n’est pas un objet est rejeté', () => {
    expect(() => parseGenerationRequest(null)).toThrow(BadRequestError)
    expect(() => parseGenerationRequest('boom')).toThrow(BadRequestError)
  })
  test('la résolution est bornée par le modèle', () => {
    expect(() => parseGenerationRequest(params({ resolution: '6K' }))).toThrow(BadRequestError)
    expect(() =>
      parseGenerationRequest(body({ adapterId: 'gpt-image-2', params: { ...body().params, resolution: '6K' } }))
    ).toThrow(BadRequestError)
    expect(
      parseGenerationRequest(
        body({ adapterId: 'gpt-image-2.5-flare', params: { ...body().params, resolution: '8K' } })
      ).params.resolution
    ).toBe('8K')
  })
})
