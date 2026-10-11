import { describe, expect, test } from 'vitest'
import { DEFAULT_PRICING, estimateCost, formatEur } from '@/lib/atelier/cost'
import { DEFAULT_PARAMS, DEFAULT_RECIPE_STATE, normalizeParams, referencesOf } from '@/lib/atelier/params'
import { ADAPTERS, ALL_PARAMS } from '@/lib/adapters/capabilities'

describe('estimation de coût', () => {
  test('tarif du modèle multiplié par le nombre de variantes', () => {
    expect(estimateCost('nano-banana-2.1', 1)).toBe(0.03)
    expect(estimateCost('nano-banana-2.1', 4)).toBe(0.12)
    expect(estimateCost('gpt-image-2', 8)).toBe(0.32)
  })

  test('un tarif personnalisé remplace le tarif par défaut', () => {
    const cher = { ...DEFAULT_PRICING, 'nano-banana-2.1': 1.5 }
    expect(estimateCost('nano-banana-2.1', 2, cher)).toBe(3)
  })

  test('un lot absurde retombe sur une image — pas de NaN affiché', () => {
    expect(estimateCost('nano-banana-2.1', 0)).toBe(0.03)
    expect(estimateCost('nano-banana-2.1', -5)).toBe(0.03)
    expect(estimateCost('nano-banana-2.1', Number.NaN)).toBe(0.03)
    expect(estimateCost('nano-banana-2.1', Number.POSITIVE_INFINITY)).toBe(0.03)
  })

  test('l’arrondi évite les traînées de virgule flottante', () => {
    // 0.03 × 3 vaut 0.09000000000000001 en IEEE 754.
    expect(estimateCost('nano-banana-2.1', 3)).toBe(0.09)
  })

  test('chaque adapter a un tarif par défaut', () => {
    for (const adapterId of ADAPTERS) {
      expect(DEFAULT_PRICING[adapterId]).toBeGreaterThan(0)
    }
  })

  test('le format monétaire est français, deux décimales', () => {
    expect(formatEur(0.03)).toBe('0,03 €')
    expect(formatEur(1)).toBe('1,00 €')
    expect(formatEur(0)).toBe('0,00 €')
  })
})

describe('réglages par défaut', () => {
  test('DEFAULT_PARAMS couvre tous les réglages connus des capacités', () => {
    // Ajouter un réglage sans lui donner de valeur par défaut le rendrait
    // `undefined` dans le payload.
    for (const param of ALL_PARAMS) {
      expect(DEFAULT_PARAMS[param]).toBeDefined()
    }
  })

  test('des réglages anciens sont relus sans leurs champs morts', () => {
    const lus = normalizeParams({ guidance: 7, steps: 30, sampler: 'euler', resolution: '4K', batch: 4 })
    expect(lus).not.toHaveProperty('guidance')
    expect(lus).not.toHaveProperty('sampler')
    expect(lus.resolution).toBe('4K')
    expect(lus.batch).toBe(4)
    expect(lus.aspectRatio).toBe(DEFAULT_PARAMS.aspectRatio)
  })

  test('une entrée illisible ou hors énumération retombe sur les défauts', () => {
    expect(normalizeParams(null)).toEqual(DEFAULT_PARAMS)
    expect(normalizeParams('x')).toEqual(DEFAULT_PARAMS)
    expect(normalizeParams({ batch: 3, aspectRatio: '3:2' })).toEqual(DEFAULT_PARAMS)
  })

  test('la graine par défaut est libre et non verrouillée', () => {
    expect(DEFAULT_PARAMS.seed).toBeNull()
    expect(DEFAULT_PARAMS.seedLock).toBe(false)
  })

  test('l’état de recette part sans référence', () => {
    expect(DEFAULT_RECIPE_STATE.subjectImages).toEqual([])
    expect(DEFAULT_RECIPE_STATE.styleImages).toEqual([])
  })
})

describe('références', () => {
  test('seuls le base64 et le mime voyagent — pas l’état d’interface', () => {
    const images = [
      { id: 'a', name: 'photo.png', base64: 'AAAA', mimeType: 'image/png', preview: 'blob:x' },
      { id: 'b', name: 'autre.jpg', base64: 'BBBB', mimeType: 'image/jpeg', preview: 'blob:y' },
    ]

    expect(referencesOf(images)).toEqual([
      { base64: 'AAAA', mimeType: 'image/png' },
      { base64: 'BBBB', mimeType: 'image/jpeg' },
    ])
  })

  test('une liste vide reste vide', () => {
    expect(referencesOf([])).toEqual([])
  })
})
