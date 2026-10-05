'use client'

import { useEffect, useRef } from 'react'
import { formatInt } from '@/lib/landing/format'
import { easeIO } from '@/lib/landing/timeline'

const fr = formatInt

/** Compteur qui défile vers sa nouvelle valeur ; direct en mouvement réduit. */
export function useCount<T extends HTMLElement>(value: number, duration = 560) {
  const ref = useRef<T>(null)
  const prev = useRef(value)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = prev.current
    prev.current = value
    if (from === value || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = fr(value)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const q = Math.min(1, (now - t0) / duration)
      el.textContent = fr(Math.round(from + (value - from) * easeIO(q)))
      if (q < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return ref
}
