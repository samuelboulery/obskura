import { describe, expect, test } from 'vitest'
import { ADAPTERS, ignoredParams } from '@/lib/adapters/capabilities'
import { buildPayload } from '@/lib/adapters/payload'
import { formatJson, highlightLines } from '@/lib/landing/format'
import { rampIndex, RAMP } from '@/lib/landing/glyphs'
import { LANDING_PROMPTS } from '@/lib/landing/content'
import { landingCases, landingRequest } from '@/lib/landing/requests'
import { frameState, gridK, statusOf, stepOf } from '@/lib/landing/timeline'

describe('corps affichés par la landing', () => {
  const cases = landingCases()

  test.each(LANDING_PROMPTS.flatMap((prompt, i) => ADAPTERS.map((id) => [i, id] as const)))(
    'prompt %i sur %s : le texte affiché est le corps réel',
    (i, id) => {
      const real = buildPayload(landingRequest(LANDING_PROMPTS[i], id))
      const shown = cases[i].payloads[id]
      expect(shown.text).toBe(formatJson(real))
      expect(JSON.parse(shown.text)).toEqual(real)
      expect(shown.bytes).toBe(new TextEncoder().encode(JSON.stringify(real)).length)
    }
  )

  test('la graine verrouillée part chez Nano Banana 2, pas chez GPT Image', () => {
    const nano = JSON.parse(cases[0].payloads['nano-banana-2'].text)
    const gpt = JSON.parse(cases[0].payloads['gpt-image-2.5-sunburst'].text)
    expect(nano.config.seed).toBe(LANDING_PROMPTS[0].seed)
    expect(gpt.seed).toBeUndefined()
    expect(gpt.personGeneration).toBeUndefined()
    expect(gpt.size).toBe('1536x864')
  })

  test('le prompt part tel que saisi pour les images montrées, sans négatif', () => {
    const nano = JSON.parse(cases[1].payloads['nano-banana-2'].text)
    const gpt = JSON.parse(cases[1].payloads['gpt-image-2.5-sunburst'].text)
    expect(nano.contents[0].parts[0].text).toBe(LANDING_PROMPTS[1].prompt)
    expect(gpt.prompt).toBe(LANDING_PROMPTS[1].prompt)
  })

  test('les réglages barrés sont ceux que le modèle ignore', () => {
    const gpt = cases[0].settings.filter((s) => s.ignoredBy.includes('gpt-image-2'))
    expect(gpt.map((s) => s.param)).toEqual(
      cases[0].settings.map((s) => s.param).filter((p) => ignoredParams('gpt-image-2').includes(p))
    )
    expect(gpt.map((s) => s.label)).toContain('seed')
  })

  test("l'écart Sunburst / Nano marque la seed ignorée côté OpenAI", () => {
    const seed = cases[0].diff.find((row) => row.label === 'seed')
    expect(seed).toEqual({ label: 'seed', a: null, b: String(LANDING_PROMPTS[0].seed) })
  })
})

test('la fiche de la scène décrit ce que reçoit GPT Image 2.5 Sunburst', () => {
  expect(landingCases()[0].format).toBe('1536x864 · medium')
})

describe('formatJson', () => {
  test('tableaux simples et petits objets tiennent sur une ligne', () => {
    expect(formatJson({ a: [1, 'x'], b: { c: 1 } })).toBe('{\n  "a": [1, "x"],\n  "b": { "c": 1 }\n}')
  })

  test('highlightLines garde le texte et le retrait', () => {
    const text = formatJson({ seed: 1, parts: [{ text: 'x' }] })
    const lines = highlightLines(text)
    expect(lines.map((l) => ' '.repeat(l.indent) + l.tokens.map((t) => t.text).join(''))).toEqual(
      text.split('\n')
    )
    expect(lines[1].tokens[0]).toMatchObject({ kind: 'k', text: '"seed"', key: 'seed' })
  })
})

describe('timeline', () => {
  test('la grille se subdivise sans revenir en arrière', () => {
    const ks = [0, 0.6, 0.64, 0.69, 0.73].map(gridK)
    expect(ks).toEqual([...ks].sort((a, b) => a - b))
    expect(gridK(0.7)).toBe(4)
  })

  const layout = {
    frame: { x: 100, y: 100, w: 800, h: 450 },
    bleed: { x: 0, y: 0, w: 1440, h: 900 },
    after: { x: 700, y: 200, w: 640, h: 360 },
    cols: 80,
    rows: 45,
  }

  test("la mosaïque n'apparaît pas avant les glyphes posés", () => {
    expect(frameState(0.5, 0, layout).imgAlpha).toBe(0)
    expect(frameState(0.3, 0, layout).glyphAlpha).toBe(1)
  })

  test("à la fin, l'image est pleine et rangée dans son cadre", () => {
    const end = frameState(1, 0, layout)
    expect(end.imgAlpha).toBe(1)
    expect(end.glyphAlpha).toBe(0)
    expect(end.gridN).toEqual([0, 0])
    expect(end.rect).toEqual(layout.after)
  })

  test('étapes et statut suivent la progression', () => {
    expect([0, 0.2, 0.5, 0.6, 0.9].map(stepOf)).toEqual([0, 1, 2, 3, 4])
    expect([0, 0.5, 0.9].map(statusOf)).toEqual(['pret', 'envoi', 'recu'])
  })
})

describe('rampe de luminance', () => {
  test('du noir au blanc, de l’espace à @', () => {
    expect(RAMP[rampIndex(0)]).toBe(' ')
    expect(RAMP[rampIndex(1)]).toBe('@')
    expect(rampIndex(0.5)).toBeGreaterThan(rampIndex(0.2))
  })
})
