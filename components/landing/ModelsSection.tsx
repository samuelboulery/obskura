'use client'

import { useState } from 'react'
import { ADAPTERS, MODELS } from '@/lib/adapters/capabilities'
import { DEFAULT_PRICING, formatEur } from '@/lib/atelier/cost'
import { landingFr as t } from '@/lib/i18n/landing-fr'
import { formatInt } from '@/lib/landing/format'
import { SCENE_MODEL } from '@/lib/landing/content'
import type { LandingCase } from '@/lib/landing/requests'
import type { AdapterId } from '@/lib/types'
import JsonView from './JsonView'
import { useCount } from './use-count'

/** Changer de modèle barre les réglages qu'il ignore et réécrit le corps. */
export default function ModelsSection({ current }: { current: LandingCase }) {
  const [model, setModel] = useState<AdapterId>(SCENE_MODEL)
  const payload = current.payloads[model]
  const ignored = current.settings.filter((s) => s.ignoredBy.includes(model))
  const bytesRef = useCount<HTMLElement>(payload.bytes, 600)

  return (
    <section className="section" id="elagage" aria-labelledby="elagage-t">
      <div className="grid">
        <div className="sec-head">
          <p className="lbl" data-reveal>
            {t.models.eyebrow}
          </p>
          <h2 id="elagage-t" data-reveal>
            {t.models.title}
          </h2>
          <p data-reveal>{t.models.body}</p>
          <fieldset className="models" data-reveal>
            <legend className="sr">{t.models.legend}</legend>
            {ADAPTERS.map((id) => (
              <label className="model" key={id}>
                <input type="radio" name="model" value={id} checked={id === model} onChange={() => setModel(id)} />
                <span className="mark" aria-hidden="true" />
                <span className="nm">
                  <b>{MODELS[id].name}</b>
                  <span>
                    {MODELS[id].provider} · {current.payloads[id].upstream}
                  </span>
                </span>
                <span className="pr">
                  {formatEur(DEFAULT_PRICING[id])} {t.models.perImage}
                </span>
              </label>
            ))}
          </fieldset>
        </div>
        <div className="prune">
          <div data-reveal>
            <p className="lbl" style={{ marginBottom: 12 }}>
              {t.models.settings}
            </p>
            <div className="settings">
              {current.settings.map((s) => (
                <span className={`chip${s.ignoredBy.includes(model) ? ' ignored' : ''}`} key={s.param}>
                  <small>{s.label}</small>
                  {s.value}
                </span>
              ))}
            </div>
          </div>
          <div className="inspector" data-reveal>
            <div className="insp-head mono">
              <span className="method">POST</span>
              <span>{payload.upstream}</span>
              <span className="sp" />
              <span>
                <b ref={bytesRef}>{formatInt(payload.bytes)}</b> {t.hero.bytes}
              </span>
            </div>
            <div className="insp-body">
              <JsonView text={payload.text} />
            </div>
            <div className="insp-note">
              <span className="lbl">{t.models.ignored}</span>
              <span className="ignored-list meta" aria-live="polite">
                {ignored.length ? ignored.map((s) => s.label).join(' · ') : t.models.none}
              </span>
            </div>
          </div>
          <p className="meta" data-reveal>
            <span className="fn">buildPayload()</span> {t.models.build} · <span className="fn">pruneUnsupported()</span>{' '}
            {t.models.prune}
          </p>
        </div>
      </div>
    </section>
  )
}
