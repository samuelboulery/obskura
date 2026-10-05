<div align="center">

# Obskura

**Un atelier local pour la génération d'images.**
Un prompt, plusieurs modèles côte à côte — pas de compte, pas de base de données, aucun serveur qui garde vos clés.

[![CI](https://github.com/samuelboulery/obskura/actions/workflows/ci.yml/badge.svg)](https://github.com/samuelboulery/obskura/actions/workflows/ci.yml)
[![Licence : MIT](https://img.shields.io/badge/License-MIT-f5a623.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](tsconfig.json)

[Démarrage](#démarrage) · [Pourquoi](#pourquoi) · [Modèles](#modèles) · [Fonctionnement](#fonctionnement) · [English](README.md)

<img src="docs/screenshots/01-fiche-image-screenmat.webp" alt="Obskura : bande de session, image sélectionnée sur la scène, composeur de prompt et fiche de l'image" width="900">

<sub>Encadrées avec <a href="https://github.com/samuelboulery/screenmat">screenmat</a>. Session de démonstration : les visuels sont dessinés au canvas par le script de capture, pas des sorties de modèle. Les regénérer avec <code>SCREENMAT=../screenmat node scripts/screenshots.mjs</code>, <code>pnpm dev</code> lancé.</sub>

</div>

---

## Pourquoi

La plupart des interfaces de génération d'images cachent la requête. Vous bougez un curseur, quelque chose se passe, et vous n'apprenez jamais si le modèle a reçu la valeur — ou l'a silencieusement jetée.

Obskura fait l'inverse. **L'inspecteur affiche le corps réel de la requête**, construit par la fonction pure que l'adapter envoie. Et il ne montre que les réglages que le modèle choisi lit : changer de modèle retire les contrôles qu'il ignore, avec une note sur ce qui a été ajouté et retiré. Ce que vous voyez est ce qui quitte votre navigateur.

<div align="center">
<img src="docs/screenshots/11-requete-screenmat.webp" alt="La section Avancé de l'inspecteur montrant le corps exact de la requête" width="900">
</div>

## Fonctionnalités

- **Quatre modèles, un prompt** — `nano-banana-2` (Gemini 3.1 Flash Image), `gpt-image-2`, `gpt-image-2.5-sunburst` et `gpt-image-2.5-flare`. La case *en parallèle* du menu Modèle lance un second modèle sur la même entrée ; les résultats arrivent en paire.
- **Un seul espace, piloté par la sélection** — rien de sélectionné : les réglages. Une image : sa fiche (prompt, réglages, palette, origine, *Reprendre*, *Varier ×4*, *Utiliser comme référence*). Deux : la comparaison et ses écarts. Davantage : l'export en original, PNG ou JPEG, avec un manifeste des réglages.
- **Annuler plutôt que confirmer** — supprimer, garder une image d'une paire ou enrichir un prompt s'annule depuis la ligne d'état ou avec <kbd>⌘Z</kbd>.
- **La clé demandée au bon moment** — générer sans clé affiche une carte sur la scène ; rien ne part, et la génération reprend dès la clé enregistrée.
- **Payloads honnêtes** — chaque adapter expose un `buildPayload()` pur. L'inspecteur affiche cet objet exact, jamais une reconstitution.
- **Capacités par modèle** — un descripteur par modèle (`lib/adapters/capabilities.ts`) pilote l'élagage du payload, la validation des requêtes et l'inspecteur.
- **Presets** — références, poids, suffixe de prompt, négatif et réglages enregistrés ensemble. Export et import en `.json`.
- **Références de sujet et de style** — déposer des images sur la scène (moitié gauche sujet, moitié droite style), les doser quand le modèle lit un poids, garder l'identité, reprendre la palette.
- **Enrichissement de prompt** — réécrit sur place par un modèle de texte, avec *votre* clé, et annulable. Aucune clé serveur n'est utilisée pour ça.
- **Papier et encre** — sombre d'abord, clair ensuite, en français et en anglais ; le chrome ne porte aucune couleur, les images gardent toutes les leurs.
- **Estimation de coût locale** — un tarif par image éditable ; l'app n'interroge aucune grille tarifaire.
- **Au clavier** — <kbd>⌘↵</kbd> génère, <kbd>⌘K</kbd> ouvre toutes les actions, <kbd>?</kbd> liste les raccourcis.

## En images

| | |
|---|---|
| <img src="docs/screenshots/02-comparaison-screenmat.webp" alt="Deux images du même prompt côte à côte, avec la liste des écarts" width="440"> | <img src="docs/screenshots/07-en-parallele-screenmat.webp" alt="Nano Banana 2 et GPT Image 2.5 Sunburst qui génèrent en parallèle" width="440"> |
| **Comparer** — deux images côte à côte, chaque écart listé. | **En parallèle** — deux modèles, un prompt, la progression face à leur durée habituelle. |
| <img src="docs/screenshots/04-menu-modele-screenmat.webp" alt="Le menu Modèle, avec l'état des clés, le prix par image et la case en parallèle" width="440"> | <img src="docs/screenshots/03-export-screenmat.webp" alt="Quatre images sélectionnées en grille, avec les options d'export" width="440"> |
| **Menu Modèle** — clé présente ou non, prix par image, *en parallèle*. | **Export** — original, PNG ou JPEG, avec un manifeste des réglages. |
| <img src="docs/screenshots/08-cle-demandee-screenmat.webp" alt="La scène demande une clé Google au premier Générer" width="440"> | <img src="docs/screenshots/05-palette-screenmat.webp" alt="La palette ⌘K filtrée sur gpt" width="440"> |
| **Premier contact** — la clé se demande sur la scène ; rien ne part. | **⌘K** — toutes les actions, modèles, presets et préférences. |
| <img src="docs/screenshots/06-historique-screenmat.webp" alt="Le tiroir Historique avec recherche et filtre par modèle" width="440"> | <img src="docs/screenshots/09-light-en-screenmat.webp" alt="Le thème clair, en anglais" width="440"> |
| **Historique** — recherche, filtre par modèle, prompt modifié en différence. | **Thème clair, anglais** — papier et encre dans les deux sens. |

<div align="center">
<img src="docs/screenshots/10-mobile-screenmat.webp" alt="Obskura sur téléphone : la bande devient une ligne au-dessus de la scène" width="440">
<br><sub>Sous 640 px, la bande passe en ligne et l'inspecteur s'ouvre en feuille.</sub>
</div>

## Démarrage

```bash
git clone https://github.com/samuelboulery/obskura.git
cd obskura
pnpm install
pnpm dev
```

Ouvrir <http://localhost:3000/app>, écrire un prompt, <kbd>⌘↵</kbd> : la scène demande la clé nécessaire la première fois.

> **pnpm exclusivement.** `npm`, `yarn` et `bun` ne sont pas supportés — le lockfile et le champ `packageManager` épinglent pnpm.

### Obtenir les clés

| Modèle | Clé chez |
|---|---|
| `nano-banana-2` | [Google AI Studio](https://aistudio.google.com/apikey) |
| `gpt-image-2` · `gpt-image-2.5-*` | [Plateforme OpenAI](https://platform.openai.com/api-keys) |

Les clés sont saisies par vous, gardées dans `localStorage`, et transmises en en-tête `x-api-key` aux routes API de l'app. Elles ne sont jamais bundlées, jamais journalisées, jamais persistées côté serveur.

### Repli serveur optionnel

Pour une instance de démo partagée, des clés de repli peuvent être fournies — copier `.env.local.example` vers `.env.local` :

```bash
GEMINI_API_KEY=...   # repli optionnel pour nano-banana-2
OPENAI_API_KEY=...   # repli optionnel pour gpt-image-2
```

En développement (`pnpm dev`), le repli fonctionne tel quel. En production, il reste **fermé** sauf avec `ALLOW_SERVER_KEY=1` : les routes API n'ont pas d'authentification, n'importe qui pourrait dépenser la clé avec `curl`. Ne l'ouvrir qu'avec un plafond de dépense posé chez le fournisseur.

L'enrichissement de prompt n'a délibérément **aucun** repli serveur : il consomme toujours la clé texte de l'utilisateur, ou reste inactif.

## Modèles

| Capacité | `nano-banana-2` | `gpt-image-2` · `gpt-image-2.5-*` |
|---|:---:|:---:|
| Format | ✅ | ✅ `size` |
| Résolution | ✅ `imageConfig.imageSize` | ✅ qualité dérivée (1K→low, 2K→medium, 4K→high ; 6K→xhigh, 8K→max en 2.5) |
| Variantes par envoi | ✅ `candidateCount` | ✅ `n` |
| Graine | ✅ | — |
| Type de fichier / transparence / compression | — | ✅ |
| `personGeneration` | ✅ | — |
| Modération | — | ✅ |
| Références image | ✅ `inlineData` | ✅ |

Aucune des deux API n'expose de champ dédié au négatif : il est donc **fusionné en fin de prompt** après déduplication avec le négatif du preset. Le bloc Requête de l'inspecteur montre le résultat.

## Fonctionnement

```
app/
  page.tsx                 shell : barre · bande · scène + composeur · inspecteur
  api/generate/route.ts    proxy image — valide, limite le débit, choisit l'adapter
  api/enrich/route.ts      réécriture de prompt avec la clé de l'utilisateur
components/atelier/
  TopBar · Strip · Composer · ui (primitives) · commands · use-shortcuts
  stage/      Stage · KeyCard
  inspector/  Settings · Image · Failure · Pair · Multi · ModelMenu · …
  overlays/   Dialog · PresetsMenu · HistoryDialog · KeysDialog · CommandPalette · ShortcutsDialog
lib/
  adapters/  capabilities · nano-banana-2 · gpt-image (fabrique) · shared · payload · validate
  atelier/   use-atelier (état) · reducer · session-view · undo · storage · recipes · export · diff · cost
  i18n/      fr (référence) · en — dictionnaires typés, sans bibliothèque
```

Ajouter un modèle, c'est un fichier dans `lib/adapters/` implémentant `GenerateImageAdapter`, plus une entrée dans `MODELS` (`capabilities.ts`). L'inspecteur, l'élagage du payload et la validation suivent tout seuls.

**Les règles que le code s'impose :**

- Aucun appel API ne part d'un composant React — tout passe par `app/api/`.
- Aucun secret dans une variable `NEXT_PUBLIC_*`, jamais.
- TypeScript strict, pas de `any`, aucune mutation d'état.
- Les raccourcis assumés portent un commentaire `ponytail:` qui nomme leur plafond.

### Vie privée et stockage

Rien n'est stocké hors de votre navigateur. `localStorage` contient :

| Clé | Contenu |
|---|---|
| `gemini_api_key` · `openai_api_key` · `text_api_key` | vos clés |
| `imgc.recipes` | presets enregistrés |
| `imgc.session` | session courante, plafonnée, images en base64 |
| `imgc.params` | réglages courants |
| `imgc.prefs` | thème, langue, tarifs, clé et consigne d'enrichissement |

Les routes API appliquent une limite de débit naïve en mémoire (10 requêtes/minute par IP). Elle se réinitialise au redémarrage et ne survit pas à plusieurs instances — suffisant pour un déploiement auto-hébergé, pas pour un service public. Derrière une plateforme qui pose elle-même l'IP du client, nommer cet en-tête dans `TRUSTED_IP_HEADER` — sur Netlify, `x-nf-client-connection-ip`. Sans lui ni `TRUSTED_PROXY_COUNT`, tous les visiteurs partagent un seul quota.

## Scripts

```bash
pnpm dev         # serveur de dev sur :3000
pnpm build       # build de production
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest — logique pure (adapters, reducer, storage, recettes…)
pnpm test:e2e    # Playwright — parcours critique
```

## Contribuer

Issues et pull requests bienvenues. Avant d'ouvrir une PR, lance `pnpm lint && pnpm typecheck && pnpm test`.

Les textes d'interface et les commentaires sont en français ; les identifiants et le README principal sont en anglais. Le nouveau code suit la même répartition.

## Licence

[MIT](LICENSE) © Samuel Boulery
