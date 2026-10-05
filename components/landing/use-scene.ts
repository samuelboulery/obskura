'use client'

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { createEngine, type Engine } from '@/lib/landing/engine'
import { formatInt } from '@/lib/landing/format'
import {
  buildAtlas,
  buildInstances,
  cellColors,
  frameRect,
  measureGlyphs,
  type Atlas,
} from '@/lib/landing/glyphs'
import { IMAGE_H, IMAGE_W } from '@/lib/landing/content'
import { landingFr as t } from '@/lib/i18n/landing-fr'
import {
  clamp,
  frameState,
  gridK,
  smooth,
  statusOf,
  stepOf,
  type SceneLayout,
} from '@/lib/landing/timeline'

const fr = formatInt

export interface SceneInput {
  /** Clé de l'image courante, et son URL. */
  imageKey: string
  imageSrc: string
  bytes: number
  /** Tous les corps possibles : l'atlas couvre chacun de leurs caractères. */
  texts: string[]
  /** Change quand le `<pre>` affiche un texte stable : il faut remesurer. */
  version: number
}

interface Pixels {
  image: HTMLImageElement
  data: Uint8ClampedArray
}

const pixelCache = new Map<string, Promise<Pixels>>()

function loadPixels(src: string): Promise<Pixels> {
  let pending = pixelCache.get(src)
  if (!pending) {
    pending = (async () => {
      const image = new Image()
      image.src = src
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = IMAGE_W
      canvas.height = IMAGE_H
      const g = canvas.getContext('2d', { willReadFrequently: true })
      if (!g) throw new Error('Canvas 2D indisponible pour lire les pixels')
      g.drawImage(image, 0, 0, IMAGE_W, IMAGE_H)
      return { image, data: g.getImageData(0, 0, IMAGE_W, IMAGE_H).data }
    })().catch((error: unknown) => {
      // Un échec (réseau, 404) ne doit pas rester en cache : on retentera.
      pixelCache.delete(src)
      throw error
    })
    pixelCache.set(src, pending)
  }
  return pending
}

interface Live {
  engine: Engine
  atlas: Atlas
  layout: (SceneLayout & { count: number }) | null
  tex: WebGLTexture | null
  p: number
  target: number
  lastP: number
  /** Incrémenté à chaque remesure : une remesure dépassée n'écrit rien. */
  generation: number
  disposed: boolean
}

/**
 * Pilote la scène épinglée : choisit le mode (fixe ou vivant), lit le
 * défilement, remesure le `<pre>` et dessine. Tout le DOM de la transition est
 * mis à jour hors de React, une fois par image.
 */
export function useScene(trackRef: RefObject<HTMLElement | null>, input: SceneInput): void {
  const live = useRef<Live | null>(null)
  const inputRef = useRef(input)
  useLayoutEffect(() => {
    inputRef.current = input
  })

  // Mise en route : une seule fois.
  useEffect(() => {
    const track = trackRef.current
    const root = track?.closest<HTMLElement>('.landing')
    const canvas = track?.querySelector<HTMLCanvasElement>('canvas.engine')
    const pre = track?.querySelector<HTMLElement>('pre.json')
    if (!track || !root || !canvas || !pre) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let engine: Engine | null = null
    try {
      engine = createEngine(canvas)
    } catch (error) {
      console.error('Moteur de glyphes indisponible, séquence fixe', error)
    }
    if (!engine) return

    const els = collect(root, track)
    const state: Live = {
      engine,
      atlas: buildAtlas(inputRef.current.texts),
      layout: null,
      tex: null,
      p: 0,
      target: 0,
      lastP: -1,
      generation: 0,
      disposed: false,
    }
    let disposed = false
    let raf = 0

    const readScroll = () => {
      const span = track.offsetHeight - innerHeight
      const y = scrollY - track.offsetTop
      state.target = span > 0 ? clamp(y / span) : 0
    }

    const loop = (time: number) => {
      raf = requestAnimationFrame(loop)
      if (!state.layout) return
      state.p += (state.target - state.p) * 0.16
      if (Math.abs(state.target - state.p) < 1e-4) state.p = state.target
      const visible = scrollY < track.offsetTop + track.offsetHeight
      if (!visible) return
      apply(els, state, inputRef.current.bytes)
      engine.draw({ ...frameState(state.p, time / 1000, state.layout), tex: state.tex })
    }

    ;(async () => {
      const family = getComputedStyle(pre).fontFamily
      const fonts = Promise.all([
        document.fonts.load(`400 46px ${family}`),
        document.fonts.load(`800 46px ${family}`),
      ])
      await Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).catch((error) =>
        console.warn('JetBrains Mono non chargée, atlas en fonte de repli', error)
      )
      if (disposed) return
      engine.setAtlas(state.atlas.chars, state.atlas.poolSize, family)
      live.current = state
      root.dataset.mode = 'live'
      addEventListener('scroll', readScroll, { passive: true })
      readScroll()
      raf = requestAnimationFrame(loop)
      await rebuild(state, track, pre, inputRef.current)
    })().catch((error) => {
      console.error('Démarrage de la scène impossible, séquence fixe', error)
      root.dataset.mode = 'static'
    })

    let resizeTimer = 0
    let lastW = innerWidth
    let lastH = innerHeight
    const onResize = () => {
      // ponytail: la barre d'URL mobile ne change que la hauteur ; au-delà de 120 px on remesure.
      if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 120) return
      lastW = innerWidth
      lastH = innerHeight
      clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        readScroll()
        rebuild(state, track, pre, inputRef.current).catch((error) =>
          console.error('Remesure de la scène impossible', error)
        )
      }, 150)
    }
    addEventListener('resize', onResize)

    return () => {
      disposed = true
      state.disposed = true
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      removeEventListener('scroll', readScroll)
      removeEventListener('resize', onResize)
      live.current = null
    }
  }, [trackRef])

  // Nouvelle requête ou `<pre>` reposé : remesurer.
  useEffect(() => {
    const state = live.current
    const track = trackRef.current
    const pre = track?.querySelector<HTMLElement>('pre.json')
    if (!state || !track || !pre) return
    rebuild(state, track, pre, inputRef.current).catch((error) =>
      console.error('Image de la scène illisible', error)
    )
  }, [trackRef, input.version, input.imageKey])
}

async function rebuild(state: Live, track: HTMLElement, pre: HTMLElement, input: SceneInput) {
  const generation = ++state.generation
  const { image, data } = await loadPixels(input.imageSrc)
  if (state.disposed || generation !== state.generation) return
  const sticky = track.querySelector<HTMLElement>('.sticky')!
  const origin = sticky.getBoundingClientRect()
  const W = origin.width
  const H = origin.height
  const frame = frameRect(W, H)
  const cols = W < 900 ? 44 : 80
  const rows = Math.round((cols * 9) / 16)
  const cell = frame.w / cols
  frame.h = rows * cell
  // Le `<pre>` doit être visible pour être mesuré : on remesure toujours au repos.
  const glyphs = measureGlyphs(pre, origin)
  if (!glyphs.length) return
  const instances = buildInstances(glyphs, cellColors(data, cols, rows), frame, cols, rows, state.atlas, input.bytes)
  const fontPx = parseFloat(getComputedStyle(pre).fontSize)
  state.engine.setGlyphs(instances, cols * rows, { srcQuad: (fontPx * 64) / 46, cell })
  state.tex = state.engine.image(input.imageKey, image)
  const img = track.querySelector<HTMLElement>('.after-frame img')!.getBoundingClientRect()
  state.layout = {
    frame,
    bleed: { x: 0, y: 0, w: W, h: H },
    after: { x: img.left - origin.left, y: img.top - origin.top, w: img.width, h: img.height },
    cols,
    rows,
    count: cols * rows,
  }
  const figs = track.querySelectorAll<HTMLElement>('.pipeline .fig')
  figs[1].textContent = `${fr(cols * rows)} ${t.hud.glyphs}`
  figs[3].textContent = `${cols} → ${cols * 2} → ${cols * 4} ${t.hud.columns}`
  state.lastP = -1
}

type Els = ReturnType<typeof collect>

function collect(root: HTMLElement, track: HTMLElement) {
  const q = <E extends HTMLElement>(scope: ParentNode, s: string) => scope.querySelector<E>(s)!
  return {
    copy: q(track, '.hero-copy'),
    foot: q(track, '.hero-foot'),
    hero: q(track, '.hero'),
    insp: q(track, '.inspector'),
    head: q(track, '.insp-head'),
    note: q(track, '.insp-note'),
    pre: q(track, 'pre.json'),
    hud: q(track, '.hud'),
    bar: q(track, '.hud-progress i'),
    count: q(track, '.hud-count'),
    steps: [...track.querySelectorAll<HTMLElement>('.pipeline li')],
    after: q(track, '.after'),
    afterCopy: q(track, '.after-copy'),
    cap: q(track, '.after-frame figcaption'),
    status: q(root, '.status'),
    statusText: q(root, '.status [data-status]'),
  }
}

/** Synchronise le DOM avec la progression : copie, inspecteur, HUD, après, barre. */
function apply(els: Els, state: Live, bytes: number) {
  const { p, layout } = state
  if (!layout || Math.abs(p - state.lastP) < 1e-5) return
  state.lastP = p
  const out = smooth(0, 0.05, p)
  const fade = 1 - smooth(0, 0.04, p)
  // Ce qui est invisible sort aussi de l'ordre de tabulation.
  els.copy.inert = p > 0.01
  els.foot.inert = p > 0.01
  els.after.inert = p <= 0.95
  els.copy.style.opacity = String(1 - out)
  els.copy.style.transform = `translateY(${-18 * out}px)`
  els.foot.style.opacity = String(1 - out)
  els.head.style.opacity = String(fade)
  els.note.style.opacity = String(fade)
  els.insp.style.borderColor = `rgb(46 44 40 / ${fade})`
  els.insp.style.background = `rgb(26 25 23 / ${0.55 * fade})`
  els.pre.style.visibility = p > 0.002 ? 'hidden' : 'visible'
  els.hero.style.pointerEvents = p > 0.01 ? 'none' : ''
  els.hud.style.opacity = String(smooth(0.04, 0.1, p) * (1 - smooth(0.74, 0.79, p)))
  els.bar.style.transform = `scaleX(${smooth(0, 0.76, p)})`
  const step = stepOf(p)
  els.steps.forEach((li, i) => {
    li.classList.toggle('on', i === step)
    li.classList.toggle('done', i < step)
  })
  const { count: n, cols, rows } = layout
  els.count.textContent =
    p < 0.12
      ? `${t.hud.sent} ${fr(Math.round(bytes * smooth(0, 0.12, p)))} / ${fr(bytes)} ${t.hero.bytes}`
      : p < 0.4
        ? `${t.hud.placed} ${fr(Math.round(n * smooth(0.14, 0.4, p)))} / ${fr(n)}`
        : p < 0.55
          ? `${t.hud.color} ${Math.round(100 * smooth(0.32, 0.47, p))} %`
          : p < 0.735
            ? `${fr(cols * gridK(p))} × ${fr(rows * gridK(p))} ${t.hud.cells}`
            : t.hud.pixels
  const a = smooth(0.9, 0.97, p)
  els.afterCopy.style.opacity = String(a)
  els.afterCopy.style.transform = `translateY(${16 * (1 - a)}px)`
  els.cap.style.opacity = String(a)
  els.after.style.pointerEvents = p > 0.95 ? 'auto' : 'none'
  const status = statusOf(p)
  if (els.status.dataset.state !== status) {
    els.status.dataset.state = status
    els.statusText.textContent = t.bar.statuses[status]
  }
}
