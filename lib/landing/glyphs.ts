import { IMAGE_H, IMAGE_W } from './content'
import type { Rect } from './timeline'

/** Rampe de luminance, du noir au blanc. Dessinée en 800 pour porter la couleur. */
export const RAMP = ' .:-=+*#%@'

export function rampIndex(luminance: number): number {
  return Math.min(RAMP.length - 1, Math.floor(Math.pow(luminance, 0.6) * RAMP.length))
}

/** mulberry32 : même graine, même tirage — la transition est identique à chaque passage. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Cadre de l'image pendant la transition : à droite du HUD, ou pleine largeur en étroit. */
export function frameRect(W: number, H: number): Rect {
  const narrow = W < 900
  const left = narrow ? 16 : Math.max(W * 0.3, 300)
  const right = narrow ? 16 : Math.max(16, W * 0.04)
  const top = 64 + (narrow ? 24 : 40)
  const bottom = narrow ? 110 : 48
  const maxH = H - top - bottom
  let fw = W - left - right
  let fh = (fw * 9) / 16
  if (fh > maxH) {
    fh = maxH
    fw = (fh * 16) / 9
  }
  return { x: left + (W - left - right - fw) / 2, y: top + (maxH - fh) / 2, w: fw, h: fh }
}

export type CellColor = [r: number, g: number, b: number, luminance: number]

/** Couleur moyenne et luminance de chaque cellule, sur 16 échantillons. */
export function cellColors(pixels: Uint8ClampedArray, cols: number, rows: number): CellColor[] {
  const out: CellColor[] = []
  const bw = IMAGE_W / cols
  const bh = IMAGE_H / rows
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const x = Math.min(IMAGE_W - 1, (cx * bw + ((sx + 0.5) * bw) / 4) | 0)
          const y = Math.min(IMAGE_H - 1, (cy * bh + ((sy + 0.5) * bh) / 4) | 0)
          const o = (y * IMAGE_W + x) * 4
          r += pixels[o]
          g += pixels[o + 1]
          b += pixels[o + 2]
        }
      }
      r /= 16 * 255
      g /= 16 * 255
      b /= 16 * 255
      out.push([r, g, b, 0.299 * r + 0.587 * g + 0.114 * b])
    }
  }
  return out
}

export interface SourceGlyph {
  ch: string
  x: number
  y: number
  /** Position de la ligne dans le bloc, de 0 (haut) à 1 (bas). */
  line: number
  color: [number, number, number]
}

/** Chaque caractère visible du `<pre>`, à sa place exacte, avec sa couleur calculée. */
export function measureGlyphs(pre: HTMLElement, origin: DOMRect): SourceGlyph[] {
  const found: (Omit<SourceGlyph, 'line'> & { top: number })[] = []
  const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  const colors = new Map<Element, [number, number, number]>()
  let node: Node | null
  while ((node = walker.nextNode())) {
    const parent = node.parentElement
    if (!parent) continue
    if (!colors.has(parent)) {
      const [r, g, b] = (getComputedStyle(parent).color.match(/[\d.]+/g) ?? ['237', '235', '229']).map(Number)
      colors.set(parent, [r / 255, g / 255, b / 255])
    }
    const text = (node as Text).data
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ' || text[i] === '\n') continue
      range.setStart(node, i)
      range.setEnd(node, i + 1)
      const r = range.getClientRects()[0]
      if (!r) continue
      found.push({
        ch: text[i],
        x: r.left - origin.left + r.width / 2,
        y: r.top - origin.top + r.height / 2,
        top: Math.round(r.top),
        color: colors.get(parent)!,
      })
    }
  }
  const tops = [...new Set(found.map((g) => g.top))].sort((a, b) => a - b)
  const last = Math.max(1, tops.length - 1)
  return found.map(({ top, ...g }) => ({ ...g, line: tops.indexOf(top) / last }))
}

export interface Atlas {
  /** `[caractère, graisse]` dans l'ordre de l'atlas : le pool, puis la rampe. */
  chars: [string, number][]
  poolSize: number
  charIndex: Map<string, number>
}

export function buildAtlas(texts: string[]): Atlas {
  const pool = [...new Set(texts.join('').replace(/\s/g, ''))]
  return {
    chars: [...pool.map((c): [string, number] => [c, 400]), ...[...RAMP].map((c): [string, number] => [c, 800])],
    poolSize: pool.length,
    charIndex: new Map(pool.map((c, i) => [c, i])),
  }
}

/**
 * Seize flottants par instance : départ, arrivée, caractère source, caractère
 * de rampe, aléa, doublon, couleur d'encre, ligne, couleur de l'image, distance
 * au centre. Les glyphes manquants pour remplir la grille sont des doublons.
 */
export function buildInstances(
  glyphs: SourceGlyph[],
  colors: CellColor[],
  frame: Rect,
  cols: number,
  rows: number,
  atlas: Atlas,
  seed: number
): Float32Array {
  const n = cols * rows
  const random = rng(seed)
  const perm = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  const cell = frame.w / cols
  const cx0 = frame.x + frame.w / 2
  const cy0 = frame.y + frame.h / 2
  const maxD = Math.hypot(frame.w / 2, frame.h / 2)
  const data = new Float32Array(n * 16)
  for (let k = 0; k < n; k++) {
    const g = glyphs[k % glyphs.length]
    const c = perm[k]
    const tx = frame.x + ((c % cols) + 0.5) * cell
    const ty = frame.y + (Math.floor(c / cols) + 0.5) * cell
    const [r, gg, b, lum] = colors[c]
    data.set(
      [
        g.x, g.y, tx, ty,
        atlas.charIndex.get(g.ch) ?? 0, atlas.poolSize + rampIndex(lum), random(), k >= glyphs.length ? 1 : 0,
        g.color[0], g.color[1], g.color[2], g.line,
        r, gg, b, Math.hypot(tx - cx0, ty - cy0) / maxD,
      ],
      k * 16
    )
  }
  return data
}
