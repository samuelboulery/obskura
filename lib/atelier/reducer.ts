import type { AdapterId } from '@/lib/types'

/** Ce qui s'ouvre au-dessus de l'espace de travail — une seule chose à la fois. */
export type Overlay = 'history' | 'presets' | 'keys' | 'palette' | 'shortcuts' | 'clear'

/**
 * État d'interface d'Obskura. Aucune donnée serveur : ce qui doit survivre au
 * rechargement est persisté séparément dans localStorage.
 *
 * Il n'y a plus de mode : l'inspecteur et la scène se déduisent de la
 * sélection. Rien de sélectionné ⇒ réglages ; une image ⇒ sa fiche ; deux ⇒
 * la comparaison ; davantage ⇒ l'export.
 */
export interface AtelierState {
  adapterId: AdapterId
  /** Second modèle lancé à chaque Générer, ou null. */
  parallelId: AdapterId | null
  /** Ce que l'inspecteur montre, dans l'ordre des clics. */
  selectedIds: string[]
  /** Ce que la scène montre quand rien n'est sélectionné. */
  focusId: string | null
  overlay: Overlay | null
  /** Sous 1100 px, l'inspecteur devient une feuille ouverte à la demande. */
  sheetOpen: boolean
  /** Générer sans clé : la scène demande celle de ce modèle. */
  keyPrompt: AdapterId | null
}

export const initialAtelierState: AtelierState = {
  adapterId: 'nano-banana-2.1',
  parallelId: null,
  selectedIds: [],
  focusId: null,
  overlay: null,
  sheetOpen: false,
  keyPrompt: null,
}

export type AtelierAction =
  | { type: 'setAdapter'; adapterId: AdapterId }
  | { type: 'setParallel'; adapterId: AdapterId | null }
  | { type: 'select'; id: string; additive?: boolean }
  | { type: 'selectMany'; ids: string[] }
  | { type: 'clearSelection' }
  | { type: 'runStarted' }
  | { type: 'arrived'; ids: string[]; pair?: boolean }
  | { type: 'forget'; ids: string[] }
  | { type: 'openOverlay'; overlay: Overlay }
  | { type: 'toggleOverlay'; overlay: Overlay }
  | { type: 'closeOverlay' }
  | { type: 'escape' }
  | { type: 'toggleSheet' }
  | { type: 'askKey'; adapterId: AdapterId | null }

function clearSelection(state: AtelierState): AtelierState {
  return { ...state, selectedIds: [], focusId: state.selectedIds[0] ?? state.focusId }
}

export function atelierReducer(state: AtelierState, action: AtelierAction): AtelierState {
  switch (action.type) {
    // Le modèle parallèle promu en principal cesse d'être parallèle.
    case 'setAdapter':
      return {
        ...state,
        adapterId: action.adapterId,
        parallelId: state.parallelId === action.adapterId ? null : state.parallelId,
      }

    case 'setParallel':
      return {
        ...state,
        parallelId: action.adapterId === state.adapterId ? null : action.adapterId,
      }

    case 'select': {
      if (!action.additive) return { ...state, selectedIds: [action.id], focusId: action.id }
      const selectedIds = state.selectedIds.includes(action.id)
        ? state.selectedIds.filter((id) => id !== action.id)
        : [...state.selectedIds, action.id]
      return { ...state, selectedIds, focusId: selectedIds[0] ?? state.focusId }
    }

    case 'selectMany':
      return { ...state, selectedIds: action.ids, focusId: action.ids[0] ?? state.focusId }

    case 'clearSelection':
      return clearSelection(state)

    // La scène montre l'attente avant l'image de repli (voir Stage) : garder
    // `focusId` rend l'image d'avant si la génération est arrêtée.
    case 'runStarted':
      return { ...state, selectedIds: [], focusId: state.selectedIds[0] ?? state.focusId, keyPrompt: null }

    // Une sélection faite pendant l'attente l'emporte sur l'image qui arrive.
    case 'arrived': {
      if (state.selectedIds.length > 0 || action.ids.length === 0) return state
      if (action.pair && action.ids.length === 2) {
        return { ...state, selectedIds: action.ids, focusId: action.ids[0] }
      }
      return { ...state, focusId: action.ids[0] }
    }

    case 'forget': {
      const gone = new Set(action.ids)
      const selectedIds = state.selectedIds.filter((id) => !gone.has(id))
      const focusId =
        state.focusId && gone.has(state.focusId) ? (selectedIds[0] ?? null) : state.focusId
      return { ...state, selectedIds, focusId }
    }

    case 'openOverlay':
      return { ...state, overlay: action.overlay }

    case 'toggleOverlay':
      return { ...state, overlay: state.overlay === action.overlay ? null : action.overlay }

    case 'closeOverlay':
      return { ...state, overlay: null }

    // Échap défait une couche à la fois, jamais une génération.
    case 'escape':
      if (state.overlay) return { ...state, overlay: null }
      if (state.keyPrompt) return { ...state, keyPrompt: null }
      if (state.sheetOpen) return { ...state, sheetOpen: false }
      return clearSelection(state)

    case 'toggleSheet':
      return { ...state, sheetOpen: !state.sheetOpen }

    case 'askKey':
      return { ...state, keyPrompt: action.adapterId }
  }
}
