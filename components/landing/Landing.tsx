import { landingFr as t } from '@/lib/i18n/landing-fr'
import { landingCases } from '@/lib/landing/requests'
import LandingStory from './LandingStory'

const REPO = 'https://github.com/samuelboulery/obskura'
const INSTALL = `git clone ${REPO}.git
cd obskura
pnpm install
pnpm dev`

/**
 * Rendu serveur : tout le texte, les corps JSON et les images existent sans JS.
 * `data-mode="static"` est la séquence fixe ; la scène passe en `live` quand
 * WebGL2 répond et que le mouvement n'est pas réduit.
 */
export default function Landing() {
  return (
    <div className="landing" data-mode="static">
      <LandingStory cases={landingCases()} repo={REPO}>
        <section className="section" id="local" aria-labelledby="local-t">
          <div className="grid">
            <div className="sec-head" style={{ gridColumn: '1 / span 6' }}>
              <p className="lbl" data-reveal>
                {t.source.eyebrow}
              </p>
              <h2 id="local-t" data-reveal>
                {t.source.title}
              </h2>
            </div>
            <div className="sec-head" style={{ gridColumn: '8 / span 5', alignSelf: 'end' }}>
              <p data-reveal>{t.source.body}</p>
              <pre className="install" data-reveal aria-label={t.source.install}>
                {INSTALL}
              </pre>
            </div>
            <div className="flow" data-reveal>
              {t.source.nodes.map((node, i) => (
                <FlowStep key={node.label} node={node} wire={t.source.wires[i]} />
              ))}
            </div>
          </div>
        </section>
      </LandingStory>

      <footer className="grid foot">
        <p className="big">{t.foot.big}</p>
        <div className="acts">
          <a className="txt link" href={REPO}>
            {t.foot.source}
          </a>
          {/* Chargement complet : le script de préférences pose le thème avant la première peinture. */}
          <a className="btn-ink" href="/app">
            {t.bar.open}
          </a>
        </div>
        <div className="colophon meta">
          {t.foot.colophon.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </footer>
    </div>
  )
}

interface FlowStepProps {
  node: { label: string; title: string; items: string[] }
  /** Libellé du fil qui part vers le nœud suivant ; absent pour le dernier. */
  wire?: string
}

function FlowStep({ node, wire }: FlowStepProps) {
  return (
    <>
      <div className="node">
        <span className="lbl">{node.label}</span>
        <b>{node.title}</b>
        <ul>
          {node.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      {wire && (
        <div className="wire">
          <span aria-hidden="true">{'{…}'}</span>
          <p className="lbl">{wire}</p>
        </div>
      )}
    </>
  )
}
