import { isImageMimeType } from '@/lib/adapters/validate'
import type { GenerationParams, Recipe, ReferenceImage } from '@/lib/types'

const FILE_VERSION = 1

export interface RecipesFile {
  version: number
  recipes: Recipe[]
}

function isReference(value: unknown): value is ReferenceImage {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ReferenceImage>
  // Le mime finit dans une URL `data:` : seule une liste fermée y entre.
  return typeof candidate.base64 === 'string' && isImageMimeType(candidate.mimeType)
}

function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Recipe>

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    candidate.name.trim().length > 0 &&
    Array.isArray(candidate.styleImages) &&
    candidate.styleImages.every(isReference) &&
    Array.isArray(candidate.subjectImages) &&
    candidate.subjectImages.every(isReference) &&
    typeof candidate.styleWeight === 'number' &&
    typeof candidate.subjectWeight === 'number' &&
    typeof candidate.identityLock === 'boolean' &&
    typeof candidate.paletteTransfer === 'boolean' &&
    typeof candidate.promptSuffix === 'string' &&
    typeof candidate.negative === 'string' &&
    !!candidate.params &&
    typeof candidate.params === 'object'
  )
}

export type ImportResult =
  | { ok: true; recipes: Recipe[] }
  | { ok: false; error: string }

/** Lit un `.json` exporté. Un fichier douteux est refusé, jamais fusionné à moitié. */
export function parseRecipesFile(raw: string): ImportResult {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Fichier illisible : ce n’est pas du JSON.' }
  }

  const candidates = Array.isArray(parsed)
    ? parsed
    : (parsed as Partial<RecipesFile> | null)?.recipes

  if (!Array.isArray(candidates)) {
    return { ok: false, error: 'Format inattendu : aucune liste de recettes trouvée.' }
  }

  const invalid = candidates.findIndex((entry) => !isRecipe(entry))
  if (invalid !== -1) {
    return { ok: false, error: `Recette invalide à la position ${invalid + 1}.` }
  }

  return { ok: true, recipes: candidates as Recipe[] }
}

export function serializeRecipes(recipes: Recipe[]): string {
  return JSON.stringify({ version: FILE_VERSION, recipes } satisfies RecipesFile, null, 2)
}

/** Fusionne sans écraser : une recette importée qui collide reçoit un nouvel id. */
export function mergeRecipes(existing: Recipe[], incoming: Recipe[]): Recipe[] {
  const taken = new Set(existing.map((recipe) => recipe.id))

  const renamed = incoming.map((recipe) => {
    if (!taken.has(recipe.id)) {
      taken.add(recipe.id)
      return recipe
    }
    const id = `${recipe.id}-${taken.size}`
    taken.add(id)
    return { ...recipe, id, name: `${recipe.name} (importée)` }
  })

  return [...existing, ...renamed]
}

export function createRecipe(input: {
  id: string
  name: string
  styleImages: ReferenceImage[]
  styleWeight: number
  subjectImages: ReferenceImage[]
  subjectWeight: number
  identityLock: boolean
  paletteTransfer: boolean
  promptSuffix: string
  negative: string
  params: GenerationParams
}): Recipe {
  return { ...input }
}
