'use client'

import { useCallback, useRef, useState } from 'react'
import { MODELS, supports } from '@/lib/adapters/capabilities'
import { landingFr as t } from '@/lib/i18n/landing-fr'
import {
  FIELD_NOTES,
  IMAGE_H,
  IMAGE_W,
  IMAGES_ARE_REAL,
  imageSrc,
  COMPARE_MODEL,
  SCENE_MODEL,
} from '@/lib/landing/content'
import { formatInt } from '@/lib/landing/format'
import type { LandingCase } from '@/lib/landing/requests'
import JsonView from './JsonView'
import { useCount } from './use-count'
import { useScene } from './use-scene'

interface SendSceneProps {
  cases: LandingCase[]
  req: number
  onSelect: (req: number) => void
}

const fr = formatInt

/** La scène épinglée : avant (prompt et corps), pendant, après. */
export default function SendScene({ cases, req, onSelect }: SendSceneProps) {
  const current = cases[req]
  const payload = current.payloads[SCENE_MODEL]
  const trackRef = useRef<HTMLElement>(null)
  const [note, setNote] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const bytesRef = useCount<HTMLElement>(payload.bytes)
  const src = imageSrc(current.slug, SCENE_MODEL)
  const settled = useCallback(() => setVersion((v) => v + 1), [])

  useScene(trackRef, {
    imageKey: current.slug,
    imageSrc: src,
    bytes: payload.bytes,
    texts: cases.map((c) => c.payloads[SCENE_MODEL].text),
    version,
  })

  /** Rejoue la transition ; la molette ou un toucher rendent la main. */
  const replay = () => {
    const track = trackRef.current
    if (!track) return
    const from = track.offsetTop
    if (track.closest<HTMLElement>('.landing')?.dataset.mode !== 'live') {
      scrollTo({ top: from, behavior: 'instant' })
      return
    }
    const to = from + track.offsetHeight - innerHeight
    const t0 = performance.now()
    let raf = 0
    const stop = () => {
      cancelAnimationFrame(raf)
      removeEventListener('wheel', stop)
      removeEventListener('touchstart', stop)
    }
    addEventListener('wheel', stop, { passive: true })
    addEventListener('touchstart', stop, { passive: true })
    scrollTo({ top: from, behavior: 'instant' })
    const step = (now: number) => {
      const q = Math.min(1, (now - t0) / 9000)
      scrollTo({ top: from + (to - from) * q, behavior: 'instant' })
      if (q < 1) raf = requestAnimationFrame(step)
      else stop()
    }
    raf = requestAnimationFrame(step)
  }

  const name = MODELS[SCENE_MODEL].name
  // GPT Image ignore la seed : on ne l'affiche que si le modèle de la scène la reçoit.
  const seeded = supports(SCENE_MODEL, 'seed')
  const meta = [current.format, seeded && `${t.after.seed} ${current.seed}`, `${fr(payload.bytes)} ${t.hero.bytes}`]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="track" id="avant" aria-labelledby="hero-title" ref={trackRef}>
      <div className="sticky">
        <div className="dots" aria-hidden="true" />
        <canvas className="engine" aria-hidden="true" />

        <div className="hero">
          <div className="grid hero-grid">
            <div className="hero-copy">
              <p className="lbl">{t.hero.eyebrow}</p>
              <h1 id="hero-title">{t.hero.title}</h1>
              <p className="lead">
                {t.hero.leadStart}
                <em>{t.hero.leadEm}</em>
                {t.hero.leadEnd}
              </p>
              <fieldset className="requests">
                <legend className="lbl">{t.hero.choose}</legend>
                {cases.map((c, i) => (
                  <label className="req" key={c.slug}>
                    <input
                      type="radio"
                      name="req"
                      value={i}
                      checked={i === req}
                      onChange={() => onSelect(i)}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element -- vignette décorative, taille fixe */}
                    <img src={imageSrc(c.slug, SCENE_MODEL)} width={128} height={72} alt="" />
                    <span className="t">{c.prompt}</span>
                    <span className="k">{seeded ? c.seed : String(i + 1).padStart(2, '0')}</span>
                  </label>
                ))}
              </fieldset>
            </div>
            <div className="inspector">
              <div className="insp-head mono">
                <span className="method">POST</span>
                <span className="model-id">{payload.upstream}</span>
                <span className="sp" />
                <span>
                  <b ref={bytesRef}>{fr(payload.bytes)}</b> {t.hero.bytes}
                </span>
              </div>
              <div className="insp-body">
                <JsonView
                  text={payload.text}
                  notes={FIELD_NOTES}
                  onNote={setNote}
                  onSettled={settled}
                  ariaLabel={`${t.hero.bodyLabel} ${name}`}
                />
              </div>
              <p className="insp-note" aria-live="polite">
                <span className="lbl">{t.hero.field}</span>
                <span>{note ? FIELD_NOTES[note] : t.hero.fieldHint}</span>
              </p>
            </div>
          </div>
          <div className="grid hero-foot">
            <p className="cue lbl">
              <i aria-hidden="true" />
              {t.hero.cue}
            </p>
            <p className="foot-meta meta">{meta}</p>
          </div>
        </div>

        <div className="hud" aria-hidden="true">
          <p className="lbl" style={{ marginBottom: 14 }}>
            {t.hud.title}
          </p>
          <ol className="pipeline">
            {t.hud.steps.map((name, i) => (
              <li key={name}>
                <span className="mark" />
                <span className="name">{name}</span>
                <span className="fig">
                  {i === 0 ? `${fr(payload.bytes)} ${t.hero.bytes}` : i === 2 ? t.hud.ramp : i === 4 ? `${IMAGE_W} × ${IMAGE_H}` : ''}
                </span>
              </li>
            ))}
          </ol>
          <div className="hud-progress">
            <i />
          </div>
          <p className="hud-count meta" />
        </div>

        <div className="after">
          <div className="grid after-grid">
            <div className="after-copy">
              <p className="lbl">{name} · 200</p>
              <h2>{t.after.title}</h2>
              <dl className="fiche">
                <dt>{t.after.fiche.prompt}</dt>
                <dd className="prompt">{current.prompt}</dd>
                <dt>{t.after.fiche.model}</dt>
                <dd>{name}</dd>
                <dt>{t.after.fiche.format}</dt>
                <dd>{current.format}</dd>
                {seeded && (
                  <>
                    <dt>{t.after.fiche.seed}</dt>
                    <dd>{current.seed}</dd>
                  </>
                )}
                <dt>{t.after.fiche.sent}</dt>
                <dd>
                  {fr(payload.bytes)} {t.hero.bytes}
                </dd>
              </dl>
              <div className="after-actions">
                <a className="txt link" href="#comparaison">
                  {t.after.compare} {MODELS[COMPARE_MODEL].name}
                </a>
                <button className="link" type="button" onClick={replay}>
                  {t.after.replay}
                </button>
              </div>
            </div>
            <figure className="after-frame">
              {/* eslint-disable-next-line @next/next/no-img-element -- dimensions fixes, servie telle quelle au moteur */}
              <img src={src} alt={current.prompt} width={IMAGE_W} height={IMAGE_H} />
              <figcaption className="meta">
                <span>
                  {seeded ? `${current.slug} · ${t.after.seed} ${current.seed}` : current.slug}
                </span>
                <span>
                  {IMAGES_ARE_REAL ? `${t.images.realOf} ${name}` : t.images.mock}
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  )
}
