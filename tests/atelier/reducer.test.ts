import { describe, expect, test } from 'vitest'
import { atelierReducer, initialAtelierState, type AtelierState } from '@/lib/atelier/reducer'

function reduce(state: AtelierState, ...actions: Parameters<typeof atelierReducer>[1][]) {
  return actions.reduce(atelierReducer, state)
}

describe('modèles', () => {
  test('Nano Banana 2.1 est le modèle par défaut', () => {
    expect(initialAtelierState.adapterId).toBe('nano-banana-2.1')
  })

  test('choisir un modèle le pose, sans toucher au parallèle', () => {
    const state = reduce(
      initialAtelierState,
      { type: 'setParallel', adapterId: 'gpt-image-2' },
      { type: 'setAdapter', adapterId: 'gpt-image-2.5-flare' }
    )
    expect(state.adapterId).toBe('gpt-image-2.5-flare')
    expect(state.parallelId).toBe('gpt-image-2')
  })

  test('le modèle principal ne peut pas tourner en parallèle de lui-même', () => {
    const state = atelierReducer(initialAtelierState, {
      type: 'setParallel',
      adapterId: initialAtelierState.adapterId,
    })
    expect(state.parallelId).toBeNull()
  })

  test('choisir comme principal le modèle parallèle retire le parallèle', () => {
    const state = reduce(
      initialAtelierState,
      { type: 'setParallel', adapterId: 'gpt-image-2' },
      { type: 'setAdapter', adapterId: 'gpt-image-2' }
    )
    expect(state.adapterId).toBe('gpt-image-2')
    expect(state.parallelId).toBeNull()
  })
})

describe('sélection', () => {
  test('un clic sélectionne une seule image et la montre', () => {
    const state = reduce(initialAtelierState, { type: 'select', id: 'a' }, { type: 'select', id: 'b' })
    expect(state.selectedIds).toEqual(['b'])
    expect(state.focusId).toBe('b')
  })

  test('⇧-clic ajoute puis retire', () => {
    const added = reduce(
      initialAtelierState,
      { type: 'select', id: 'a' },
      { type: 'select', id: 'b', additive: true },
      { type: 'select', id: 'c', additive: true }
    )
    expect(added.selectedIds).toEqual(['a', 'b', 'c'])

    const removed = atelierReducer(added, { type: 'select', id: 'b', additive: true })
    expect(removed.selectedIds).toEqual(['a', 'c'])
  })

  test('« ← Réglages » vide la sélection et garde l’image à l’écran', () => {
    const state = reduce(initialAtelierState, { type: 'select', id: 'a' }, { type: 'clearSelection' })
    expect(state.selectedIds).toEqual([])
    expect(state.focusId).toBe('a')
  })

  test('une génération qui démarre vide la sélection mais garde l’image de repli', () => {
    // Arrêtée sans résultat, la génération rend la scène à l'image montrée avant.
    const state = reduce(initialAtelierState, { type: 'select', id: 'a' }, { type: 'runStarted' })
    expect(state.selectedIds).toEqual([])
    expect(state.focusId).toBe('a')
  })

  test('une génération qui aboutit montre l’image sans quitter les réglages', () => {
    const state = atelierReducer(initialAtelierState, { type: 'arrived', ids: ['n1', 'n2'] })
    expect(state.focusId).toBe('n1')
    expect(state.selectedIds).toEqual([])
  })

  test('deux modèles en parallèle arrivent en paire sélectionnée', () => {
    const state = atelierReducer(initialAtelierState, { type: 'arrived', ids: ['a1', 'b1'], pair: true })
    expect(state.selectedIds).toEqual(['a1', 'b1'])
  })

  test('une arrivée ne vole pas une sélection faite entre-temps', () => {
    const state = reduce(
      initialAtelierState,
      { type: 'select', id: 'ancienne' },
      { type: 'arrived', ids: ['nouvelle'] }
    )
    expect(state.selectedIds).toEqual(['ancienne'])
    expect(state.focusId).toBe('ancienne')
  })

  test('oublier des images les retire de la sélection et de la scène', () => {
    const state = reduce(
      initialAtelierState,
      { type: 'select', id: 'a' },
      { type: 'select', id: 'b', additive: true },
      { type: 'forget', ids: ['a'] }
    )
    expect(state.selectedIds).toEqual(['b'])

    const vide = atelierReducer(state, { type: 'forget', ids: ['b'] })
    expect(vide.selectedIds).toEqual([])
    expect(vide.focusId).toBeNull()
  })
})

describe('Échap et surcouches', () => {
  test('Échap ferme d’abord la surcouche, puis vide la sélection', () => {
    const opened = reduce(
      initialAtelierState,
      { type: 'select', id: 'a' },
      { type: 'openOverlay', overlay: 'history' }
    )

    const first = atelierReducer(opened, { type: 'escape' })
    expect(first.overlay).toBeNull()
    expect(first.selectedIds).toEqual(['a'])

    const second = atelierReducer(first, { type: 'escape' })
    expect(second.selectedIds).toEqual([])
    expect(second.focusId).toBe('a')
  })

  test('Échap retire la carte de clé avant de toucher à la sélection', () => {
    const state = reduce(
      initialAtelierState,
      { type: 'select', id: 'a' },
      { type: 'askKey', adapterId: 'nano-banana-2' },
      { type: 'escape' }
    )
    expect(state.keyPrompt).toBeNull()
    expect(state.selectedIds).toEqual(['a'])
  })

  test('rouvrir la surcouche ouverte la referme', () => {
    const state = reduce(
      initialAtelierState,
      { type: 'toggleOverlay', overlay: 'presets' },
      { type: 'toggleOverlay', overlay: 'presets' }
    )
    expect(state.overlay).toBeNull()
  })

  test('l’état initial n’est jamais muté', () => {
    atelierReducer(initialAtelierState, { type: 'select', id: 'a' })
    expect(initialAtelierState.selectedIds).toEqual([])
  })
})
