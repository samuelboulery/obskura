/** Entier à la française : espace fine pour les milliers. */
export function formatInt(n: number): string {
  return n.toLocaleString('fr-FR')
}

/**
 * Mise en forme lisible d'un corps JSON : un tableau de valeurs simples ou un
 * petit objet plat tiennent sur une ligne. `JSON.parse` du résultat redonne
 * l'objet d'origine.
 */
export function formatJson(value: unknown, indent = ''): string {
  const pad = `${indent}  `
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    if (value.every(isScalar)) return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`
    return `[\n${value.map((v) => pad + formatJson(v, pad)).join(',\n')}\n${indent}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    const flat = entries.every(([, v]) => isScalar(v))
    if (flat && (entries.length === 1 || JSON.stringify(value).length <= 56)) {
      return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`
    }
    return `{\n${entries.map(([k, v]) => `${pad}${JSON.stringify(k)}: ${formatJson(v, pad)}`).join(',\n')}\n${indent}}`
  }
  return JSON.stringify(value)
}

function isScalar(value: unknown): boolean {
  return value === null || typeof value !== 'object'
}

export type TokenKind = 'k' | 's' | 'n' | 'p' | 't'

export interface Token {
  kind: TokenKind
  text: string
  /** Nom du champ, pour une clé : sert à retrouver son annotation. */
  key?: string
}

export interface Line {
  indent: number
  tokens: Token[]
}

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null)\b|([{}[\],])/g

/** Découpe en lignes à retrait suspendu, chaque ligne en jetons typés. */
export function highlightLines(text: string): Line[] {
  return text.split('\n').map((raw) => {
    const indent = raw.length - raw.trimStart().length
    const line = raw.slice(indent)
    const tokens: Token[] = []
    let last = 0
    for (const m of line.matchAll(TOKEN)) {
      const at = m.index ?? 0
      if (at > last) tokens.push({ kind: 't', text: line.slice(last, at) })
      last = at + m[0].length
      if (m[1] && m[2]) {
        tokens.push({ kind: 'k', text: m[1], key: JSON.parse(m[1]) as string })
        tokens.push({ kind: 'p', text: m[2] })
      } else if (m[1]) tokens.push({ kind: 's', text: m[1] })
      else if (m[3] || m[4]) tokens.push({ kind: 'n', text: m[3] || m[4] })
      else tokens.push({ kind: 'p', text: m[5] })
    }
    if (last < line.length) tokens.push({ kind: 't', text: line.slice(last) })
    return { indent, tokens }
  })
}
