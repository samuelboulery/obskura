import { describe, expect, test } from 'vitest'
import { mergeRecipes, parseRecipesFile, serializeRecipes } from '@/lib/atelier/recipes'
import { DEFAULT_PARAMS } from '@/lib/atelier/params'
import type { Recipe } from '@/lib/types'

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    name: 'Packshots céramique',
    styleImages: [],
    styleWeight: 65,
    subjectImages: [],
    subjectWeight: 75,
    identityLock: false,
    paletteTransfer: false,
    promptSuffix: 'lumière rasante',
    negative: 'flou',
    params: DEFAULT_PARAMS,
    ...overrides,
  }
}

describe('import de recettes', () => {
  test('relit un fichier exporté', () => {
    const result = parseRecipesFile(serializeRecipes([recipe()]))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.recipes[0].name).toBe('Packshots céramique')
  })

  test('accepte aussi un tableau nu', () => {
    const result = parseRecipesFile(JSON.stringify([recipe()]))
    expect(result.ok).toBe(true)
  })

  test('refuse un JSON illisible', () => {
    const result = parseRecipesFile('{ pas du json')
    expect(result).toEqual({ ok: false, error: 'Fichier illisible : ce n’est pas du JSON.' })
  })

  test('refuse une recette à laquelle il manque un champ', () => {
    const broken = { ...recipe(), negative: undefined }
    const result = parseRecipesFile(JSON.stringify({ version: 1, recipes: [broken] }))
    expect(result.ok).toBe(false)
  })

  test('refuse un format sans liste de recettes', () => {
    expect(parseRecipesFile(JSON.stringify({ version: 1 })).ok).toBe(false)
  })
})

describe('fusion', () => {
  test('une collision d’id ne détruit pas la recette existante', () => {
    const merged = mergeRecipes([recipe()], [recipe({ name: 'Autre' })])

    expect(merged).toHaveLength(2)
    expect(merged[0].name).toBe('Packshots céramique')
    expect(merged[1].id).not.toBe(merged[0].id)
    expect(merged[1].name).toContain('importée')
  })

  test('sans collision, les recettes sont simplement ajoutées', () => {
    const merged = mergeRecipes([recipe()], [recipe({ id: 'r2', name: 'Studio' })])
    expect(merged.map((entry) => entry.id)).toEqual(['r1', 'r2'])
  })
})

describe('import — références', () => {
  test.each(['image/svg+xml', 'text/html', 'image/png;x=1'])('un mime %s refuse le fichier', (mimeType) => {
    const piege = recipe({ styleImages: [{ base64: 'AAAA', mimeType }] })
    expect(parseRecipesFile(JSON.stringify([piege])).ok).toBe(false)
  })

  test('une référence jpeg passe', () => {
    const ok = recipe({ styleImages: [{ base64: 'AAAA', mimeType: 'image/jpeg' }] })
    expect(parseRecipesFile(JSON.stringify([ok])).ok).toBe(true)
  })
})
