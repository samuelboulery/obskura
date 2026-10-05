/**
 * Limiteur de débit en mémoire.
 *
 * ponytail: mono-instance et non partagé — le compteur vit dans le processus,
 * repart à zéro au redémarrage et ne voit pas ses voisins derrière un
 * répartiteur de charge. Suffisant pour un déploiement auto-hébergé unique,
 * insuffisant pour un service public : il faudrait alors un store partagé.
 */

const requests = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60_000 // 1 minute
const MAX_REQUESTS = 10

/** Au-delà, on purge les entrées expirées : la Map ne doit pas croître sans fin. */
const MAX_ENTRIES = 10_000

/**
 * Nombre de proxys de confiance devant l'application (0 = accès direct).
 *
 * `X-Forwarded-For` est une liste que *le client* peut préfixer : lire son
 * premier segment revient à laisser l'appelant choisir sa propre identité, donc
 * contourner la limite avec une valeur différente à chaque requête. On compte
 * depuis la fin, où écrit le proxy le plus proche, et on ignore l'en-tête
 * lorsqu'aucun proxy n'est déclaré.
 */
const TRUSTED_PROXIES = Number(process.env.TRUSTED_PROXY_COUNT ?? 0)

export function clientKey(req: Request): string {
  // En-tête posé par la plateforme et écrasé à chaque requête — sur Netlify,
  // `x-nf-client-connection-ip`. À ne déclarer que si la plateforme le garantit :
  // ailleurs, le client l'écrit lui-même.
  const ipHeader = process.env.TRUSTED_IP_HEADER
  const ip = ipHeader ? req.headers.get(ipHeader)?.trim() : undefined
  if (ip) return ip

  if (!Number.isInteger(TRUSTED_PROXIES) || TRUSTED_PROXIES <= 0) return 'local'

  const chain = (req.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (chain.length === 0) return 'local'

  // Le dernier segment est ajouté par notre proxy ; remonter d'autant de sauts
  // qu'il y a d'intermédiaires de confiance.
  return chain[Math.max(0, chain.length - TRUSTED_PROXIES)] ?? 'local'
}

/** Supprime les fenêtres expirées — appelé seulement quand la Map grossit. */
function evictExpired(now: number) {
  for (const [key, entry] of requests) {
    if (now > entry.resetAt) requests.delete(key)
  }
}

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now()

  if (requests.size > MAX_ENTRIES) evictExpired(now)

  const entry = requests.get(ip)

  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfter: 0 }
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { allowed: true, retryAfter: 0 }
}

/** Réservé aux tests : repart d'un compteur vierge. */
export function resetRateLimit() {
  requests.clear()
}
