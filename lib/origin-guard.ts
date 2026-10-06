/**
 * Garde d'origine pour les routes POST.
 *
 * Sans elle, un site tiers peut émettre une requête *simple* — `Content-Type:
 * text/plain`, donc aucun préflight CORS — vers `/api/generate`. L'attaquant ne
 * lit pas la réponse, mais la requête part et s'exécute : elle consomme la clé
 * de repli du serveur. Le mode « instance de démo partagée » documenté dans le
 * README rend ce scénario concret.
 */

/**
 * `Sec-Fetch-Site` est envoyé par tous les navigateurs modernes et n'est pas
 * falsifiable depuis une page. `none` couvre la saisie directe d'URL et les
 * appels hors navigateur (curl), qui n'ont pas de contexte d'origine.
 */
export function isSameOrigin(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin' || site === 'none'

  // Repli pour les agents sans Fetch Metadata : comparer l'hôte déclaré.
  const origin = req.headers.get('origin')
  if (!origin) return true

  try {
    return new URL(origin).host === new URL(req.url).host
  } catch {
    return false
  }
}

/**
 * Un corps JSON doit s'annoncer comme tel. C'est ce qui retire aux pages
 * tierces la possibilité d'émettre une requête simple : `application/json`
 * déclenche un préflight, que CORS refusera.
 */
export function isJsonRequest(req: Request): boolean {
  return req.headers.get('content-type')?.toLowerCase().includes('application/json') ?? false
}

type BodyRead = { ok: true; value: unknown } | { ok: false; status: 400 | 413 }

/**
 * Lit un corps JSON sans dépasser `maxBytes`. `req.json()` charge tout en
 * mémoire avant qu'aucun plafond ne s'applique : ici, la lecture s'arrête au
 * premier octet de trop, `Content-Length` annoncé ou non.
 */
export async function readJsonCapped(req: Request, maxBytes: number): Promise<BodyRead> {
  if (Number(req.headers.get('content-length') ?? 0) > maxBytes) return { ok: false, status: 413 }

  const reader = req.body?.getReader()
  if (!reader) return { ok: false, status: 400 }

  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      return { ok: false, status: 413 }
    }
    chunks.push(value)
  }

  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  } catch {
    return { ok: false, status: 400 }
  }
}
