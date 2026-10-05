'use client'

import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { highlightLines } from '@/lib/landing/format'
import { rng } from '@/lib/landing/glyphs'

const POOL = '{}[]":,._-=+*#%@abcdefghijklmnopqrstuvwxyz0123456789'

interface JsonViewProps {
  text: string
  /** Champs annotés : rendus focalisables, ils déclenchent `onNote`. */
  notes?: Record<string, string>
  onNote?: (key: string | null) => void
  /** Appelé quand le texte affiché est stable (fin du brouillage). */
  onSettled?: () => void
  ariaLabel?: string
}

/**
 * Le corps JSON en vrai `<pre>`, sélectionnable. Quand le texte change, chaque
 * caractère passe par un glyphe tiré au hasard avant de se poser.
 */
const JsonView = forwardRef<HTMLPreElement, JsonViewProps>(function JsonView(
  { text, notes, onNote, onSettled, ariaLabel },
  ref
) {
  const [scramble, setScramble] = useState<string | null>(null)
  const shown = useRef(text)
  const settled = useRef(onSettled)
  useLayoutEffect(() => {
    settled.current = onSettled
  })

  useEffect(() => {
    const from = shown.current
    shown.current = text
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (from === text || reduced) {
      settled.current?.()
      return
    }
    const stop = morph(from, text, 560, setScramble, () => {
      setScramble(null)
      settled.current?.()
    })
    return stop
  }, [text])

  return (
    <pre className="json" ref={ref} aria-label={ariaLabel} onMouseLeave={() => onNote?.(null)}>
      {scramble === null
        ? highlightLines(text).map((line, i) => (
            <span key={i} className="ln" style={{ '--i': line.indent } as CSSProperties}>
              {line.tokens.map((token, j) =>
                token.kind === 'k' && token.key && notes?.[token.key] ? (
                  <span
                    key={j}
                    className="k"
                    data-note={token.key}
                    tabIndex={0}
                    onMouseEnter={() => onNote?.(token.key ?? null)}
                    onFocus={() => onNote?.(token.key ?? null)}
                    onBlur={() => onNote?.(null)}
                  >
                    {token.text}
                  </span>
                ) : (
                  <span key={j} className={token.kind === 't' ? undefined : token.kind}>
                    {token.text}
                  </span>
                )
              )}
            </span>
          ))
        : scramble.split('\n').map((line, i) => {
            const indent = line.length - line.trimStart().length
            return (
              <span key={i} className="ln" style={{ '--i': indent } as CSSProperties}>
                {line.slice(indent)}
              </span>
            )
          })}
    </pre>
  )
})

export default JsonView

/** Brouillage ligne à ligne ; renvoie de quoi l'interrompre. */
function morph(
  from: string,
  to: string,
  duration: number,
  frame: (text: string) => void,
  done: () => void
): () => void {
  const a = from.split('\n')
  const b = to.split('\n')
  const n = Math.max(a.length, b.length)
  const random = rng(from.length * 31 + to.length)
  const thresholds = Array.from({ length: n }, (_, l) => {
    const len = Math.max((a[l] ?? '').length, (b[l] ?? '').length)
    return Array.from({ length: len }, (_, i) => (l / n) * 0.3 + (i / Math.max(1, len)) * 0.3 + random() * 0.25)
  })
  const t0 = performance.now()
  let raf = 0
  const step = (now: number) => {
    const q = Math.min(1, (now - t0) / duration)
    const rows = thresholds.map((ts, l) => {
      const before = a[l] ?? ''
      const after = b[l] ?? ''
      let s = ''
      for (let i = 0; i < ts.length; i++) {
        const ca = before[i] ?? ' '
        const cb = after[i] ?? ' '
        if (ca === cb || q > ts[i] + 0.12) s += cb
        else if (q > ts[i]) s += cb === ' ' ? ' ' : POOL[(Math.random() * POOL.length) | 0]
        else s += ca
      }
      return s.replace(/\s+$/, '')
    })
    frame(rows.join('\n'))
    if (q < 1) raf = requestAnimationFrame(step)
    else done()
  }
  raf = requestAnimationFrame(step)
  return () => cancelAnimationFrame(raf)
}
