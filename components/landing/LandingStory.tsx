'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { landingFr as t } from '@/lib/i18n/landing-fr'
import type { LandingCase } from '@/lib/landing/requests'
import CompareSection from './CompareSection'
import ModelsSection from './ModelsSection'
import SendScene from './SendScene'

interface LandingStoryProps {
  cases: LandingCase[]
  repo: string
  /** Sections sans état, rendues côté serveur, à la suite. */
  children: ReactNode
}

/** Le prompt choisi en haut suit dans la comparaison et dans la démo d'élagage. */
export default function LandingStory({ cases, repo, children }: LandingStoryProps) {
  const [req, setReq] = useState(0)

  // Apparitions au défilement, seulement en mode vivant (voir landing.css).
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('shown')
          io.unobserve(entry.target)
        }),
      { rootMargin: '0px 0px -12% 0px' }
    )
    document.querySelectorAll('.landing [data-reveal]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <>
      <header className="bar">
        <a className="wordmark" href="#avant">
          Obskura
        </a>
        <p className="status meta" data-state="pret">
          <i />
          <span>
            {t.bar.status} · <span data-status>{t.bar.statuses.pret}</span>
          </span>
        </p>
        <nav aria-label={t.bar.nav}>
          <a className="txt" href={repo}>
            {t.bar.source}
          </a>
          {/* Chargement complet : le script de préférences pose le thème avant la première peinture. */}
          <a className="btn-ink" href="/app">
            {t.bar.open}
          </a>
        </nav>
      </header>
      <main>
        <SendScene cases={cases} req={req} onSelect={setReq} />
        <CompareSection current={cases[req]} />
        <ModelsSection current={cases[req]} />
        {children}
      </main>
    </>
  )
}
