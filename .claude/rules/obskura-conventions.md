# Obskura — Always-On Rules

Ces règles s'appliquent à chaque session Claude sur ce projet. Sans exception.

## Ce que Claude ne doit JAMAIS faire

- Exposer une clé API côté client (pas de variable `NEXT_PUBLIC_` pour des secrets)
- Appeler directement une API externe depuis un composant React — toujours passer par `/app/api/`
- Installer une dépendance npm sans demande explicite de l'utilisateur
- Muter un objet de state — toujours créer de nouvelles copies (spread, Object.assign, etc.)

## Organisation des fichiers

- `lib/adapters/` — un fichier par API image (ex: `nano-banana-2.ts`, `gpt-image.ts`)
- `lib/types.ts` — tous les types partagés (PromptParams, GenerationResult, AdapterConfig)
- `components/` — composants React en PascalCase, un composant par fichier
- `app/api/generate/` — route handler Next.js, proxy vers les adapters
- `app/page.tsx` — landing (`/`) ; `app/app/page.tsx` — l'app (`/app`) : TopBar, Strip, Stage + Composer, inspecteur, surcouches

## Interface commune des adapters

Chaque adapter doit respecter cette interface :

```typescript
interface GenerateImageAdapter {
  generate(params: PromptParams): Promise<GenerationResult>
}
```

## Style de code

- TypeScript strict — pas de `any`
- Immutabilité : spread operators, jamais de mutation directe
- Erreurs gérées explicitement — pas de `catch` silencieux
- Fonctions petites (<50 lignes), fichiers focalisés (<400 lignes)
