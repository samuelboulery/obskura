/**
 * Traduction d'une erreur amont en message affichable.
 *
 * Les adapters lèvent en français (« Aucune clé API configurée… ») tandis que
 * les SDK amont lèvent en anglais : les deux formulations doivent être
 * reconnues, sans quoi la cause réelle est écrasée par un message générique.
 *
 * Le message brut n'est jamais renvoyé au client — il peut contenir des
 * fragments de requête, d'URL ou de clé.
 */

const MISSING_KEY =
  /aucune cl[ée]|cl[ée]s?\s*api|api.?key|api key|authentication|unauthorized|permission denied|invalid.{0,12}credential/i

const QUOTA = /quota|rate.?limit|resource.?exhausted|billing|too many requests|429/i

const NO_IMAGE = /no image|aucune image/i

const SAFETY = /safety|blocked|content.?policy|moderation|refus/i

export type UpstreamFailure =
  | 'missing-key'
  | 'quota'
  | 'no-image'
  | 'safety'
  | 'unknown'

export function classifyUpstreamError(message: string): UpstreamFailure {
  // La clé d'abord : « invalid api key » contient aussi « invalid ».
  if (MISSING_KEY.test(message)) return 'missing-key'
  if (QUOTA.test(message)) return 'quota'
  if (NO_IMAGE.test(message)) return 'no-image'
  if (SAFETY.test(message)) return 'safety'
  return 'unknown'
}

const MESSAGES: Record<UpstreamFailure, string> = {
  'missing-key': 'Clé API invalide ou manquante',
  quota: 'Quota API dépassé',
  'no-image': 'Aucune image retournée par le modèle',
  safety: 'Demande refusée par la modération du modèle',
  unknown: 'Erreur lors de la génération',
}

/** Message destiné au client, expurgé de tout détail interne. */
export function toClientMessage(message: string): string {
  return MESSAGES[classifyUpstreamError(message)]
}

const KEY_PATTERNS = /AIza[\w-]{10,}|sk-[\w-]{10,}|([?&]key=)[^&\s"']+/g

/**
 * Message destiné aux logs serveur : motifs de clé connus masqués, ainsi que
 * les clés passées en argument, quelle que soit leur forme.
 */
export function redactSecrets(message: string, ...keys: (string | undefined)[]): string {
  let out = message
  // Sous 8 caractères, le remplacement masquerait des mots ordinaires.
  for (const key of keys) if (key && key.length >= 8) out = out.replaceAll(key, '***')
  return out.replace(KEY_PATTERNS, (_, query?: string) => (query ? `${query}***` : '***'))
}
