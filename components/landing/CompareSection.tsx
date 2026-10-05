'use client'

import { useState, type CSSProperties } from 'react'
import { MODELS } from '@/lib/adapters/capabilities'
import { landingFr as t } from '@/lib/i18n/landing-fr'
import {
  COMPARE_MODEL,
  IMAGE_H,
  IMAGE_W,
  IMAGES_ARE_REAL,
  imageSrc,
  SCENE_MODEL,
} from '@/lib/landing/content'
import type { LandingCase } from '@/lib/landing/requests'

/** Paire Nano Banana 2 / GPT Image 2.5 Sunburst, curseur au clavier, liste des écarts. */
export default function CompareSection({ current }: { current: LandingCase }) {
  const [x, setX] = useState(50)
  const a = MODELS[SCENE_MODEL].name
  const b = MODELS[COMPARE_MODEL].name

  return (
    <section className="section" id="comparaison" aria-labelledby="comparaison-t">
      <div className="grid">
        <div className="sec-head">
          <p className="lbl" data-reveal>
            {t.compare.eyebrow}
          </p>
          <h2 id="comparaison-t" data-reveal>
            {t.compare.title}
          </h2>
        </div>
        <div className="sec-head" style={{ gridColumn: '7 / span 6', alignSelf: 'end' }}>
          <p data-reveal>{t.compare.body}</p>
        </div>
        <div className="compare-wrap" data-reveal>
          <div className="compare" style={{ '--x': `${x}%` } as CSSProperties}>
            {/* eslint-disable-next-line @next/next/no-img-element -- deux couches superposées, taille du cadre */}
            <img className="a" src={imageSrc(current.slug, SCENE_MODEL)} width={IMAGE_W} height={IMAGE_H} alt={`${a} : ${current.prompt}`} />
            {/* eslint-disable-next-line @next/next/no-img-element -- idem */}
            <img className="b" src={imageSrc(current.slug, COMPARE_MODEL)} width={IMAGE_W} height={IMAGE_H} alt={`${b} : ${current.prompt}`} />
            <input
              type="range"
              min={0}
              max={100}
              value={x}
              onChange={(e) => setX(Number(e.target.value))}
              aria-label={`${t.compare.sliderLabel} : ${a} et ${b}`}
            />
            <span className="divider" aria-hidden="true" />
            <span className="tag a meta">{a}</span>
            <span className="tag b meta">{b}</span>
          </div>
          <p className="compare-cap meta">
            <span>{current.prompt}</span>
            <span>
              {IMAGES_ARE_REAL ? '' : `${t.images.mockPair} `}
              {t.compare.slider}
            </span>
          </p>
        </div>
        <div className="diff" data-reveal>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.compare.setting}</th>
                <th scope="col">
                  <span className="sr">{t.compare.gap}</span>
                </th>
                <th scope="col">{a}</th>
                <th scope="col">{b}</th>
              </tr>
            </thead>
            <tbody>
              {current.diff.map((row) => {
                const same = row.a === row.b
                return (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className={same ? 'eq' : 'ne'} aria-label={same ? t.compare.same : t.compare.different}>
                      {same ? '=' : '≠'}
                    </td>
                    {[row.a, row.b].map((value, i) =>
                      value === null ? (
                        <td key={i} className="off">
                          {t.compare.ignored}
                        </td>
                      ) : (
                        <td key={i}>{value}</td>
                      )
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
