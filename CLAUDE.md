# Obskura

Interface multi-API pour la génération d'images, marque **Obskura** (suite avec screenmat). Le prompt (positif, négatif, références de sujet et de style) part vers `gemini-3.1-flash-image-preview` (« Nano Banana 2 »), `gpt-image-2`, `gpt-image-2.5-sunburst` ou `gpt-image-2.5-flare`. Un seul espace de travail : la **sélection** décide de l'inspecteur et de la scène (rien → réglages ; une image → sa fiche ; deux → comparaison ; davantage → export). Un second modèle peut tourner « en parallèle ».

**Aucune base de données, aucun compte.** Tout ce qui persiste — clés, réglages, session, presets — vit dans `localStorage`. Les presets s'exportent en `.json`.

## Architecture

```
app/
  layout.tsx                  ← Space Grotesk · JetBrains Mono · Unbounded (next/font), script anti-flash thème/langue
  globals.css                 ← jetons papier/encre (@theme inline, sombre par défaut, [data-theme='light'])
  page.tsx                    ← shell : TopBar · Strip · Stage + Composer · inspecteur · surcouches
  api/generate/route.ts       ← proxy image, renvoie un tableau d'images
  api/enrich/route.ts         ← enrichissement de prompt, clé de l'utilisateur
components/atelier/
  TopBar · Strip · Composer · Mark · ui (Button, IconButton, Kbd, Segmented, Toggle, Section, Field, KeyValue, Shot)
  commands.ts                 ← actions de la palette ⌘K
  use-shortcuts.ts            ← raccourcis clavier (un seul écouteur)
  stage/      Stage (accueil, attente, échec, image, paire, grille, dépôt) · KeyCard
  inspector/  SettingsInspector · ImageInspector · FailureInspector · PairInspector · MultiInspector
              ModelMenu · RatioTiles · ReferencesSection · AdvancedSection
  overlays/   Dialog (<dialog> natif) · PresetsMenu · HistoryDialog · KeysDialog · CommandPalette · ShortcutsDialog
lib/
  types.ts                    ← GenerationParams, Recipe, GalleryItem, FailedRun, GenerationRequest…
  adapters/
    capabilities.ts           ← MODELS : un descripteur par modèle (nom, clé, résolutions, réglages lus)
    nano-banana-2.ts          ← buildNanoBanana2Payload + generate
    gpt-image.ts              ← fabrique commune aux trois modèles GPT
    shared.ts · payload.ts · validate.ts · errors.ts
  atelier/
    use-atelier.ts            ← état complet (hook) : session, échecs, génération, annulation
    reducer.ts                ← état d'interface : modèle(s), sélection, surcouche, carte de clé
    session-view.ts undo.ts error-kind.ts storage.ts params.ts recipes.ts export.ts diff.ts cost.ts
    palette.ts image-file.ts thumbnail.ts session-store.ts use-now.ts
  i18n/                       ← fr.ts (référence, `Dict`) · en.ts · useT()
```

**Tech stack :** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 (config CSS-first) · Phosphor Icons (variantes `XxxIcon`, import `/dist/ssr`) · Vitest + Playwright.

## Key Commands

```bash
pnpm dev              # serveur de dev sur localhost:3000
pnpm build            # build de production
pnpm lint             # ESLint
pnpm exec tsc --noEmit# vérification TypeScript
pnpm test             # Vitest (logique pure)
pnpm test:e2e         # Playwright (parcours critique)
```

`pnpm` exclusivement — pas de `npm`, `yarn` ni `bun`.

## Code Conventions

- Un adapter par API dans `lib/adapters/`, implémentant `GenerateImageAdapter`.
- **Chaque adapter expose un `buildPayload` pur** : `generate()` l'envoie, le bloc Requête de l'inspecteur l'affiche. Le panneau JSON montre le corps réel, jamais une reconstitution. Pur au sens strict — aucun `Math.random()`, aucune horloge : la graine est tirée par l'appelant (`drawSeed()`) et voyage dans `GenerationRequest.drawnSeed`. Vérifié par `tests/adapters/capabilities.test.ts`.
- Les capacités par modèle vivent uniquement dans `lib/adapters/capabilities.ts` (`MODELS`) : elles pilotent l'élagage du payload, la validation et l'inspecteur (un réglage non lu n'est pas rendu). L'élagage passe par `pruneUnsupported()`, que chaque `buildPayload` appelle ; retirer une entrée de `SUPPORTED` fait disparaître le champ du corps **et** échouer le test de contrat.
- Les clés API ne transitent jamais côté client au sens « bundle » : elles sont saisies par l'utilisateur, gardées dans `localStorage` et envoyées en en-tête `x-api-key` vers `app/api/`.
- Composants React en PascalCase, types partagés dans `lib/types.ts`.
- **Aucun texte d'interface en dur** : tout passe par `lib/i18n/` (`fr.ts` fait référence, `en.ts` doit avoir les mêmes clés). Ton : infinitif sur les commandes, « vous » dans les phrases.
- **Jetons seulement** : `bg-stage`, `bg-panel`, `bg-solid`, `bg-raised`, `bg-sunken`, `border-hairline(-strong)`, `text-ink`, `text-ink-soft`, `text-dim`, `text-danger`. Une seule action en encre pleine à l'écran : Générer.
- Une action destructive est **annulable** (`Notice` avec `undo`) plutôt que confirmée ; seule « Nouvelle session » demande confirmation.
- TypeScript strict, pas de `any`. Immutabilité : aucune mutation d'objet d'état.
- Les raccourcis assumés portent un commentaire `ponytail:` qui nomme leur plafond.

## Constraints

- Jamais de clé dans une variable `NEXT_PUBLIC_*`.
- Pas de clé serveur par défaut pour `/api/enrich` : l'enrichissement consomme la clé de l'utilisateur.
- Ne pas installer de dépendance sans demander.
- Tout appel externe passe par `app/api/`.
- Aucun effet coloré sur les images : le fond ambiant porte les couleurs, pas les visuels.

## Environment Variables

| Variable | Requis | Description |
|---|---|---|
| `GEMINI_API_KEY` | optionnel | Repli serveur pour nano-banana-2 si l'utilisateur n'a pas saisi de clé |
| `OPENAI_API_KEY` | optionnel | Repli serveur pour gpt-image-2 |
| `TRUSTED_PROXY_COUNT` | optionnel | Nombre de proxys de confiance devant l'app (défaut `0`). Tant qu'il vaut `0`, `X-Forwarded-For` est ignoré : un client peut le forger et se donner un quota neuf à chaque requête. |

## Notes API

**nano-banana-2** (`gemini-3.1-flash-image-preview`) — supporte format, résolution (`imageConfig.imageSize`), variantes (`candidateCount`), graine, `personGeneration` et les références en `inlineData`. Ignore type de fichier, fond transparent, compression, modération.

**gpt-image-2 / 2.5** — supporte format (`size`), qualité (dérivée de la résolution : 1K `low`, 2K `medium`, 4K `high` ; 6K `xhigh` et 8K `max` en 2.5 seulement), variantes (`n`), type de fichier, fond, compression et modération. Ignore graine et `personGeneration`.

Le négatif n'a de champ dédié chez aucun des deux : il est fusionné en fin de prompt après déduplication avec le négatif du preset.

## Stockage local

`gemini_api_key` · `openai_api_key` · `text_api_key` · `imgc.recipes` · `imgc.session` (plafonnée, images en base64) · `imgc.params` · `imgc.prefs` (thème, langue, tarifs, clé et consigne d'enrichissement).
