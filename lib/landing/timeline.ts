/**
 * La transition est une fonction pure de la progression `p` (0 à 1) du
 * défilement : ce fichier fixe les temps, le moteur ne fait que dessiner.
 *
 * 0–0,12 envoi · 0,12–0,4 transit · 0,4–0,55 glyphes · 0,55–0,76 pixels ·
 * 0,76–0,88 fond perdu · 0,88–1 l'image se range près de sa fiche.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface SceneLayout {
  frame: Rect
  bleed: Rect
  after: Rect
  cols: number
  rows: number
}

export interface FrameState {
  p: number
  t: number
  rect: Rect
  imgAlpha: number
  gridN: [number, number]
  gap: number
  gapPx: number
  glyphAlpha: number
}

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))

export function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function lerpRect(a: Rect, b: Rect, t: number): Rect {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) }
}

/** Subdivision de la mosaïque : 1, puis 2, puis 4 fois plus de colonnes. */
export function gridK(p: number): 1 | 2 | 4 {
  return p < 0.635 ? 1 : p < 0.685 ? 2 : 4
}

/** Étape allumée du pipeline : Requête, Transit, Glyphes, Pixels, Image. */
export function stepOf(p: number): number {
  return p < 0.12 ? 0 : p < 0.4 ? 1 : p < 0.55 ? 2 : p < 0.76 ? 3 : 4
}

export type SceneStatus = 'pret' | 'envoi' | 'recu'

export function statusOf(p: number): SceneStatus {
  return p < 0.002 ? 'pret' : p < 0.76 ? 'envoi' : 'recu'
}

export function frameState(p: number, t: number, layout: SceneLayout): FrameState {
  const { frame, bleed, after, cols, rows } = layout
  const mosaic = smooth(0.575, 0.6, p)
  let rect = frame
  if (p >= 0.76 && p < 0.84) rect = lerpRect(frame, bleed, easeIO(clamp((p - 0.76) / 0.08)))
  else if (p >= 0.84 && p < 0.88) rect = bleed
  else if (p >= 0.88) rect = lerpRect(bleed, after, easeIO(clamp((p - 0.88) / 0.09)))
  const k = p < 0.735 ? gridK(p) : 0
  return {
    p,
    t,
    rect,
    imgAlpha: mosaic,
    gridN: k ? [cols * k, rows * k] : [0, 0],
    gap: k === 1 ? 1 : 0,
    gapPx: 1,
    glyphAlpha: p > 0.002 ? 1 - mosaic : 0,
  }
}
