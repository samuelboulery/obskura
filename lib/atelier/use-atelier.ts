'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { classifyClientError } from './error-kind'
import { fitParams, modelChanges, MODELS } from '@/lib/adapters/capabilities'
import { drawSeed, resolveSeed } from '@/lib/adapters/shared'
import { MAX_REFERENCE_IMAGES } from '@/lib/adapters/validate'
import { estimateCost } from './cost'
import { exportImages, type ExportFormat } from './export'
import { readImageFile, toImageState, toReferenceImage } from './image-file'
import { extractPalette } from './palette'
import { DEFAULT_PARAMS, DEFAULT_RECIPE_STATE, normalizeParams, type RecipeState } from './params'
import { createRecipe } from './recipes'
import { atelierReducer, initialAtelierState } from './reducer'
import {
  DEFAULT_PREFS,
  readJson,
  readPrefs,
  readString,
  STORAGE_KEYS,
  writeJson,
  writeSession,
  writeString,
  type Prefs,
} from './storage'
import { makeThumbnail } from './thumbnail'
import { restoreItems, withoutIds } from './undo'
import type { EnrichResponse } from '@/app/api/enrich/route'
import type {
  AdapterId,
  FailedRun,
  GalleryItem,
  GenerateResponse,
  GenerationParams,
  GenerationRequest,
  KeyKind,
  PendingTile,
  Recipe,
} from '@/lib/types'

export type ModelNote = ReturnType<typeof modelChanges>

const keyOf = (adapterId: AdapterId): KeyKind => MODELS[adapterId].keyKind

const KEY_STORAGE: Record<KeyKind, string> = {
  gemini: STORAGE_KEYS.geminiKey,
  openai: STORAGE_KEYS.openaiKey,
  text: STORAGE_KEYS.textKey,
}

/**
 * Message de la ligne d'état du composeur. `undo` rend l'action réversible
 * par le bouton « Annuler » et par ⌘Z.
 */
export type Notice =
  | { kind: 'deleted'; count: number; undo: () => void }
  | { kind: 'kept'; undo: () => void }
  | { kind: 'enriched'; undo: () => void }
  | { kind: 'arrived'; got: number; asked: number }
  | { kind: 'stopped' }
  | { kind: 'error'; message: string }

/** Une génération à lancer : ce qui part, et d'où elle vient. */
interface Job {
  text: string
  adapterId: AdapterId
  params: GenerationParams
  negative: string
  parentId: string | null
}

interface RunResult {
  created: GalleryItem[]
  failure: FailedRun | null
}

// ponytail: `items` n'est pas plafonné en mémoire — les listes n'affichent que
// des aperçus, donc le coût reste tenable. Passer à IndexedDB si l'historique
// complet doit survivre au rechargement en pleine résolution.

/**
 * État d'Obskura : réglages, session, presets, clés, et l'appel de génération.
 * Tout vit dans le navigateur ; les seuls allers-retours serveur sont
 * `/api/generate` et `/api/enrich`, qui portent la clé de l'utilisateur.
 */
export function useAtelier() {
  const [state, dispatch] = useReducer(atelierReducer, initialAtelierState)
  const [prompt, setPrompt] = useState('')
  const [negative, setNegative] = useState('')
  const [promptSuffix, setPromptSuffix] = useState('')
  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS)
  const [recipe, setRecipe] = useState<RecipeState>(DEFAULT_RECIPE_STATE)
  const [items, setItems] = useState<GalleryItem[]>([])
  const [pending, setPending] = useState<PendingTile[]>([])
  const [failures, setFailures] = useState<FailedRun[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null)
  const [keys, setKeys] = useState<Record<KeyKind, string>>({ gemini: '', openai: '', text: '' })
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [enriching, setEnriching] = useState(false)
  /** Ce que le dernier changement de modèle a ajouté ou retiré de l'inspecteur. */
  const [modelNote, setModelNote] = useState<ModelNote | null>(null)
  const [hydrated, setHydrated] = useState(false)
  /**
   * Ce que la dernière écriture a réellement gardé. On ne retient que les
   * compteurs : garder les items doublerait la mémoire.
   */
  const [persisted, setPersisted] = useState({ kept: 0, fullCount: 0 })

  /**
   * Miroir synchrone des clés : « Enregistrer la clé » lance la génération
   * dans le même geste, avant que le rendu suivant n'ait mis `keys` à jour.
   */
  const keysRef = useRef(keys)
  const controllers = useRef(new Set<AbortController>())

  const activeRecipe = recipes.find((entry) => entry.id === activeRecipeId) ?? null

  // Relecture du navigateur au montage : aucun appel serveur.
  useEffect(() => {
    const stored = {
      gemini: readString(STORAGE_KEYS.geminiKey),
      openai: readString(STORAGE_KEYS.openaiKey),
      text: readString(STORAGE_KEYS.textKey),
    }
    keysRef.current = stored
    setKeys(stored)
    setPrefs(readPrefs())
    setParams(normalizeParams(readJson<unknown>(STORAGE_KEYS.params, null)))
    const session = readJson<GalleryItem[]>(STORAGE_KEYS.session, [])
    setItems(session)
    // La scène reprend sur la dernière image plutôt que sur l'accueil.
    if (session[0]) dispatch({ type: 'arrived', ids: [session[0].id] })
    setRecipes(readJson<Recipe[]>(STORAGE_KEYS.recipes, []))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) writeJson(STORAGE_KEYS.params, params)
  }, [params, hydrated])

  useEffect(() => {
    if (!hydrated) return
    const written = writeSession(items)
    setPersisted({ kept: written.items.length, fullCount: written.fullCount })
  }, [items, hydrated])

  useEffect(() => {
    if (hydrated) writeJson(STORAGE_KEYS.prefs, prefs)
  }, [prefs, hydrated])

  useEffect(() => {
    if (hydrated) writeJson(STORAGE_KEYS.recipes, recipes)
  }, [recipes, hydrated])

  function setKey(kind: KeyKind, value: string) {
    const next = { ...keysRef.current, [kind]: value.trim() }
    keysRef.current = next
    setKeys(next)
    writeString(KEY_STORAGE[kind], value.trim())
  }

  function hasKeyFor(adapterId: AdapterId): boolean {
    return keys[keyOf(adapterId)].trim().length > 0
  }

  /* ── Modèles et réglages ─────────────────────────────────────────────── */

  /**
   * Change de modèle et recale les réglages sur ce qu'il accepte — et sur ce
   * qu'accepte le modèle parallèle, qui reçoit les mêmes.
   */
  function selectModel(adapterId: AdapterId) {
    if (adapterId === state.adapterId) return
    const parallel = state.parallelId === adapterId ? null : state.parallelId

    setModelNote(modelChanges(state.adapterId, adapterId))
    dispatch({ type: 'setAdapter', adapterId })
    setParams((previous) => {
      const fitted = fitParams(previous, adapterId)
      return parallel ? fitParams(fitted, parallel) : fitted
    })
  }

  function setParallel(adapterId: AdapterId | null) {
    dispatch({ type: 'setParallel', adapterId })
    if (adapterId && adapterId !== state.adapterId) {
      setParams((previous) => fitParams(previous, adapterId))
    }
  }

  function applyRecipe(entry: Recipe) {
    setActiveRecipeId(entry.id)
    setPromptSuffix(entry.promptSuffix)
    setParams(fitParams(normalizeParams({ ...DEFAULT_PARAMS, ...entry.params }), state.adapterId))
    setRecipe({
      subjectImages: entry.subjectImages.map(toImageState),
      subjectWeight: entry.subjectWeight,
      identityLock: entry.identityLock,
      styleImages: entry.styleImages.map(toImageState),
      styleWeight: entry.styleWeight,
      paletteTransfer: entry.paletteTransfer,
    })
  }

  function saveCurrentRecipe(name: string) {
    const saved = createRecipe({
      id: crypto.randomUUID(),
      name,
      subjectImages: recipe.subjectImages.map(toReferenceImage),
      subjectWeight: recipe.subjectWeight,
      styleImages: recipe.styleImages.map(toReferenceImage),
      styleWeight: recipe.styleWeight,
      identityLock: recipe.identityLock,
      paletteTransfer: recipe.paletteTransfer,
      promptSuffix,
      negative: negative.trim(),
      params,
    })

    setRecipes((previous) => [...previous, saved])
    setActiveRecipeId(saved.id)
  }

  function deleteRecipe(id: string) {
    setRecipes((previous) => previous.filter((entry) => entry.id !== id))
    if (activeRecipeId === id) setActiveRecipeId(null)
  }

  /** Le preset reste enregistré ; les réglages courants cessent d'y être liés. */
  function detachRecipe() {
    setActiveRecipeId(null)
    setPromptSuffix('')
  }

  function resetParams() {
    setParams(fitParams(DEFAULT_PARAMS, state.adapterId))
    setRecipe(DEFAULT_RECIPE_STATE)
    setPromptSuffix('')
    setActiveRecipeId(null)
  }

  /** « Reprendre les réglages » d'une image : prompt, négatif, modèle et réglages. */
  function reuse(item: GalleryItem) {
    setPrompt(item.prompt)
    setNegative(item.negative)
    if (item.adapterId !== state.adapterId) selectModel(item.adapterId)
    setParams(fitParams(normalizeParams(item.params), item.adapterId))
    dispatch({ type: 'clearSelection' })
  }

  function addReferences(kind: 'subject' | 'style', images: RecipeState['subjectImages']) {
    setRecipe((previous) =>
      kind === 'subject'
        ? { ...previous, subjectImages: [...previous.subjectImages, ...images] }
        : { ...previous, styleImages: [...previous.styleImages, ...images] }
    )
  }

  /** Fichiers déposés ou choisis : compressés, puis joints dans la limite par type. */
  async function addReferenceFiles(kind: 'subject' | 'style', files: File[]) {
    const current = kind === 'subject' ? recipe.subjectImages : recipe.styleImages
    const accepted = files.filter((file) => file.type.startsWith('image/'))
    try {
      const images = await Promise.all(accepted.slice(0, MAX_REFERENCE_IMAGES - current.length).map(readImageFile))
      addReferences(kind, images)
    } catch (error) {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  /* ── Génération ──────────────────────────────────────────────────────── */

  function buildRequest(
    text: string,
    adapterId: AdapterId = state.adapterId,
    drawnSeed: number | null = null,
    overrides: Partial<Pick<GenerationRequest, 'params' | 'negative'>> = {}
  ): GenerationRequest {
    return {
      adapterId,
      prompt: text,
      drawnSeed,
      negative: negative.trim() || undefined,
      promptSuffix: promptSuffix.trim() || undefined,
      recipeNegative: activeRecipe?.negative,
      subjectImages: recipe.subjectImages.map(toReferenceImage),
      subjectWeight: recipe.subjectWeight,
      styleImages: recipe.styleImages.map(toReferenceImage),
      styleWeight: recipe.styleWeight,
      identityLock: recipe.identityLock,
      paletteTransfer: recipe.paletteTransfer,
      params,
      ...overrides,
    }
  }

  /**
   * Complète un item déjà affiché avec ce qui se dérive de son image : palette
   * de sa fiche et aperçu persistable. Les deux calculs partent ensemble et
   * n'écrivent l'état qu'une fois.
   */
  function attachDerived(item: GalleryItem) {
    const dataUrl = `data:${item.result.mimeType};base64,${item.result.imageBase64}`

    void Promise.all([extractPalette(dataUrl), makeThumbnail(dataUrl)]).then(([palette, thumb]) => {
      if (!palette && !thumb) return
      setItems((previous) =>
        previous.map((entry) =>
          entry.id === item.id
            ? { ...entry, palette: palette ?? entry.palette, thumb: thumb ?? entry.thumb }
            : entry
        )
      )
    })
  }

  /** Un appel de génération. N'écrit que la session : la sélection est l'affaire de l'appelant. */
  async function run(job: Job): Promise<RunResult> {
    const tile: PendingTile = {
      id: crypto.randomUUID(),
      adapterId: job.adapterId,
      count: job.params.batch,
      startedAt: Date.now(),
    }
    const controller = new AbortController()
    controllers.current.add(controller)
    setPending((previous) => [tile, ...previous])

    // Tirée ici, une fois : le corps envoyé et la graine notée sur l'item sont
    // la même valeur, et une image non verrouillée reste reproductible.
    const drawnSeed = drawSeed()
    const effectiveSeed = resolveSeed(job.params, drawnSeed)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const key = keysRef.current[keyOf(job.adapterId)]
    if (key) headers['x-api-key'] = key

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(
          buildRequest(job.text, job.adapterId, drawnSeed, {
            params: job.params,
            negative: job.negative.trim() || undefined,
          })
        ),
      })

      const json: GenerateResponse = await response.json()
      if (!json.success || !json.data) throw new Error(json.error ?? 'Erreur inconnue')

      const latencyMs = Date.now() - tile.startedAt
      const createdAt = new Date().toISOString()
      const created: GalleryItem[] = json.data.map((result) => ({
        id: crypto.randomUUID(),
        result,
        adapterId: job.adapterId,
        prompt: job.text,
        negative: job.negative.trim(),
        seed: effectiveSeed,
        params: job.params,
        palette: null,
        thumb: null,
        parentId: job.parentId,
        recipeId: activeRecipeId,
        latencyMs,
        costEur: estimateCost(job.adapterId, 1, prefs.pricing),
        createdAt,
      }))

      setItems((previous) => [...created, ...previous])
      created.forEach(attachDerived)

      if (created.length < job.params.batch) {
        setNotice({ kind: 'arrived', got: created.length, asked: job.params.batch })
      }

      return { created, failure: null }
    } catch (error) {
      if (controller.signal.aborted) return { created: [], failure: null }

      const message = error instanceof Error ? error.message : 'Erreur inconnue'
      const failure: FailedRun = {
        id: crypto.randomUUID(),
        adapterId: job.adapterId,
        prompt: job.text,
        message,
        kind: classifyClientError(message),
        createdAt: new Date().toISOString(),
      }
      setFailures((previous) => [failure, ...previous])
      return { created: [], failure }
    } finally {
      controllers.current.delete(controller)
      setPending((previous) => previous.filter((entry) => entry.id !== tile.id))
    }
  }

  /** Lance des jobs ensemble, puis montre ce qui arrive — ou l'échec. */
  async function launch(jobs: Job[]) {
    setNotice(null)
    dispatch({ type: 'runStarted' })

    const results = await Promise.all(jobs.map(run))
    const firsts = results.map((result) => result.created[0]?.id).filter((id): id is string => !!id)
    const failure = results.find((result) => result.failure)?.failure

    if (firsts.length > 0) {
      dispatch({ type: 'arrived', ids: firsts, pair: jobs.length === 2 && firsts.length === 2 })
    } else if (failure) {
      dispatch({ type: 'arrived', ids: [failure.id] })
    }
  }

  /**
   * Générer depuis le composeur. Sans clé pour un des modèles, rien ne part :
   * la scène demande la clé, et le prompt reste en place.
   */
  async function generate() {
    const text = prompt.trim()
    if (!text) return

    const models = state.parallelId ? [state.adapterId, state.parallelId] : [state.adapterId]
    const missing = models.find((id) => !keysRef.current[keyOf(id)])
    if (missing) {
      dispatch({ type: 'askKey', adapterId: missing })
      return
    }

    await launch(models.map((adapterId) => ({ text, adapterId, params, negative, parentId: null })))
  }

  /** « Enregistrer la clé » sur la scène : la génération demandée part aussitôt. */
  function saveKeyAndGenerate(adapterId: AdapterId, value: string) {
    setKey(keyOf(adapterId), value)
    dispatch({ type: 'askKey', adapterId: null })
    void generate()
  }

  /**
   * « Varier ×4 » : quatre variantes réelles de l'image, avec ses propres
   * réglages, son prompt et son négatif.
   *
   * ponytail: les références et le preset sont ceux du moment, pas ceux de
   * l'image — l'item ne les garde pas (trop lourds pour localStorage). Les
   * stocker par item si varier une image ancienne doit être fidèle.
   */
  async function vary(item: GalleryItem) {
    if (!keysRef.current[keyOf(item.adapterId)]) {
      dispatch({ type: 'askKey', adapterId: item.adapterId })
      return
    }
    await launch([
      {
        text: item.prompt,
        adapterId: item.adapterId,
        params: { ...fitParams(normalizeParams(item.params), item.adapterId), batch: 4 },
        negative: item.negative,
        parentId: item.id,
      },
    ])
  }

  async function retry(failure: FailedRun, overrides: Partial<GenerationParams> = {}) {
    if (!keysRef.current[keyOf(failure.adapterId)]) {
      dispatch({ type: 'askKey', adapterId: failure.adapterId })
      return
    }
    setFailures((previous) => previous.filter((entry) => entry.id !== failure.id))
    dispatch({ type: 'forget', ids: [failure.id] })
    if (Object.keys(overrides).length > 0) setParams((previous) => ({ ...previous, ...overrides }))
    await launch([
      {
        text: failure.prompt,
        adapterId: failure.adapterId,
        params: { ...params, ...overrides },
        negative,
        parentId: null,
      },
    ])
  }

  /** Arrête toutes les générations en vol. */
  function stop() {
    if (controllers.current.size === 0) return
    for (const controller of controllers.current) controller.abort()
    setNotice({ kind: 'stopped' })
  }

  /* ── Session ─────────────────────────────────────────────────────────── */

  /** Retire des images et des échecs de la session ; annulable. */
  function removeItems(ids: string[]) {
    const fromItems = withoutIds(items, ids)
    const fromFailures = withoutIds(failures, ids)
    const count = fromItems.removed.length + fromFailures.removed.length
    if (count === 0) return

    setItems(fromItems.kept)
    setFailures(fromFailures.kept)
    dispatch({ type: 'forget', ids })
    // L'image montrée est partie : la scène passe à la plus récente qui reste.
    const shown = state.selectedIds[0] ?? state.focusId
    if (shown && ids.includes(shown) && fromItems.kept[0]) {
      dispatch({ type: 'arrived', ids: [fromItems.kept[0].id] })
    }
    setNotice({
      kind: 'deleted',
      count,
      undo: () => {
        setItems((previous) => restoreItems(previous, fromItems.removed))
        setFailures((previous) => restoreItems(previous, fromFailures.removed))
        setNotice(null)
      },
    })
  }

  /** « Garder celle-ci » dans une paire : l'autre quitte la session, annulable. */
  function keepOnly(keep: GalleryItem, drop: GalleryItem) {
    const { kept, removed } = withoutIds(items, [drop.id])
    setItems(kept)
    dispatch({ type: 'select', id: keep.id })
    setNotice({
      kind: 'kept',
      undo: () => {
        setItems((previous) => restoreItems(previous, removed))
        dispatch({ type: 'selectMany', ids: [keep.id, drop.id] })
        setNotice(null)
      },
    })
  }

  function clearSession() {
    const ids = [...items, ...failures].map((entry) => entry.id)
    setItems([])
    setFailures([])
    setNotice(null)
    dispatch({ type: 'forget', ids })
  }

  /* ── Enrichir ────────────────────────────────────────────────────────── */

  function enrichKey(): string {
    return keysRef.current[prefs.enrichKey] || keysRef.current.gemini || keysRef.current.openai
  }

  /** Réécrit le prompt sur place ; « Annuler » rend l'original. */
  async function enrich() {
    const original = prompt
    if (!original.trim()) return
    const apiKey = enrichKey()
    if (!apiKey) {
      dispatch({ type: 'openOverlay', overlay: 'keys' })
      return
    }

    setEnriching(true)
    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({
          prompt: original,
          prePrompt: prefs.enrichPrePrompt,
          model: prefs.enrichModel.trim() || undefined,
        }),
      })
      const json: EnrichResponse = await response.json()
      if (!json.success || !json.data?.prompt) {
        throw new Error(json.error ?? 'Échec de l’enrichissement')
      }

      setPrompt(json.data.prompt)
      setNotice({
        kind: 'enriched',
        undo: () => {
          setPrompt(original)
          setNotice(null)
        },
      })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Échec de l’enrichissement',
      })
    } finally {
      setEnriching(false)
    }
  }

  /** Exporte des images ; un échec de conversion s'affiche dans la ligne d'état. */
  async function exportItems(list: GalleryItem[], format: ExportFormat, withSettings: boolean) {
    try {
      await exportImages(list, format, withSettings)
    } catch (error) {
      setNotice({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const undo = useCallback(() => {
    if (notice && 'undo' in notice) notice.undo()
  }, [notice])

  return {
    state,
    dispatch,
    prompt,
    setPrompt,
    negative,
    setNegative,
    promptSuffix,
    params,
    setParams,
    recipe,
    setRecipe,
    addReferences,
    addReferenceFiles,
    items,
    pending,
    failures,
    persisted,
    recipes,
    setRecipes,
    activeRecipe,
    activeRecipeId,
    applyRecipe,
    saveCurrentRecipe,
    deleteRecipe,
    detachRecipe,
    resetParams,
    selectModel,
    setParallel,
    modelNote,
    keys,
    setKey,
    hasKeyFor,
    prefs,
    setPrefs,
    notice,
    undo,
    buildRequest,
    generate,
    saveKeyAndGenerate,
    vary,
    retry,
    reuse,
    stop,
    removeItems,
    exportItems,
    keepOnly,
    clearSession,
    enrich,
    enriching,
  }
}

export type Atelier = ReturnType<typeof useAtelier>
