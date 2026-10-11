import { ImageResponse } from 'next/og'

export const alt = 'Obskura — atelier local de génération d’images'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PAPER = '#121110'
const INK = '#edebe5'
const SOFT = '#a09c92'
const LINE = '#48453f'

// ponytail: police système par défaut de next/og — pas de Space Grotesk ici,
// ça demanderait d'embarquer le .woff et de le lire à chaque build.
export default function OpengraphImage() {
  const pill = { display: 'flex', padding: '10px 22px', borderRadius: 2, border: `1px solid ${LINE}` }
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          padding: 72,
          color: INK,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg viewBox="0 0 32 32" width={48} height={48}>
            <path d="M7 13V7h6M19 7h6v6M25 19v6h-6M13 25H7v-6" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="square" />
            <circle cx={16} cy={16} r={2.6} fill={INK} />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700 }}>obskura</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ fontSize: 84, fontWeight: 600, lineHeight: 1.05 }}>Un prompt entre. Une image sort.</div>
          <div style={{ fontSize: 34, color: SOFT, lineHeight: 1.35 }}>
            Cinq modèles, vos clés, rien hors du navigateur.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 26, color: SOFT }}>
          <div style={pill}>nano-banana-2 · 2.1</div>
          <div style={pill}>gpt-image-2 · 2.5</div>
          <div style={pill}>sans compte</div>
        </div>
      </div>
    ),
    size,
  )
}
