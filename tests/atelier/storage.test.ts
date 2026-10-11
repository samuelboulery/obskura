import { beforeEach, describe, expect, test } from 'vitest'
import {
  DEFAULT_PREFS,
  readJson,
  readPrefs,
  readString,
  STORAGE_KEYS,
  writeJson,
  writeString,
} from '@/lib/atelier/storage'

beforeEach(() => {
  window.localStorage.clear()
})

describe('storage', () => {
  test('relit ce qui a été écrit', () => {
    writeJson('imgc.test', { a: 1 })
    expect(readJson('imgc.test', null)).toEqual({ a: 1 })
  })

  test('une entrée absente rend la valeur par défaut', () => {
    expect(readJson('imgc.absent', { fallback: true })).toEqual({ fallback: true })
  })

  test('une entrée corrompue rend la valeur par défaut sans lever', () => {
    window.localStorage.setItem('imgc.broken', '{ ceci n’est pas du JSON')
    expect(readJson('imgc.broken', { fallback: true })).toEqual({ fallback: true })
  })

  test('écrire une chaîne vide supprime la clé — pas de clé fantôme', () => {
    writeString(STORAGE_KEYS.textKey, 'sk-test')
    expect(readString(STORAGE_KEYS.textKey)).toBe('sk-test')

    writeString(STORAGE_KEYS.textKey, '')
    expect(readString(STORAGE_KEYS.textKey)).toBe('')
    expect(window.localStorage.getItem(STORAGE_KEYS.textKey)).toBeNull()
  })

  test('sans préférence enregistrée : sombre et français', () => {
    const prefs = readPrefs()
    expect(prefs.theme).toBe('dark')
    expect(prefs.lang).toBe('fr')
  })

  test('une préférence inconnue retombe sur sa valeur par défaut', () => {
    writeJson(STORAGE_KEYS.prefs, { theme: 'sepia', lang: 'de', enrichKey: 'x' })
    const prefs = readPrefs()
    expect(prefs.theme).toBe('dark')
    expect(prefs.lang).toBe('fr')
    expect(prefs.enrichKey).toBe('gemini')
  })

  test('les préférences partielles sont complétées par les valeurs par défaut', () => {
    writeJson(STORAGE_KEYS.prefs, { theme: 'light', lang: 'en' })
    const prefs = readPrefs()

    expect(prefs.theme).toBe('light')
    expect(prefs.lang).toBe('en')
    expect(prefs.pricing).toEqual(DEFAULT_PREFS.pricing)
    expect(prefs.enrichPrePrompt).toBe(DEFAULT_PREFS.enrichPrePrompt)
  })

  test('le modèle d’enrichissement est vide par défaut et gardé s’il est saisi', () => {
    expect(readPrefs().enrichModel).toBe('')
    writeJson(STORAGE_KEYS.prefs, { enrichModel: 'claude-haiku-5-5' })
    expect(readPrefs().enrichModel).toBe('claude-haiku-5-5')
    writeJson(STORAGE_KEYS.prefs, { enrichModel: 42 })
    expect(readPrefs().enrichModel).toBe('')
  })
})
