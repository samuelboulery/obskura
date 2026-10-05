---
name: obskura-da
description: Direction artistique d'Obskura — jetons papier/encre, typographie, primitives, ton des libellés, règles de sélection. À charger avant de toucher un composant sous components/atelier/ ou app/globals.css.
---

# Obskura — direction artistique

Obskura et screenmat forment une suite : même papier, même encre, deux outils.
La couleur appartient aux images ; le chrome n'en porte aucune.

## Jetons (app/globals.css)

Sombre par défaut, `data-theme="light"` sur `<html>` bascule en clair. Ne jamais
écrire une couleur en dur dans un composant : passer par les classes.

| Rôle | Classe |
|---|---|
| Fond de scène (trame de points) | `stage-dots` / `bg-stage` |
| Panneaux | `bg-solid` (opaque), `bg-panel` (translucide) |
| Survol, case active | `bg-raised` |
| Champ, creux | `bg-sunken` |
| Filets | `border-hairline`, `border-hairline-strong` |
| Texte | `text-ink`, `text-ink-soft`, `text-dim` |
| Danger (texte seulement) | `text-danger` |
| Voile de surcouche | `bg-scrim` |

Tailles : `text-10` à `text-32` ; rayon `rounded-xs` (2 px) ; filets 1 px ;
aucune ombre de chrome ; durées `duration-140 ease-standard`.
Utilitaires : `.lbl` (titre de section mono capitales), `.meta` (valeur mono
11 px), `.hatch` (attente seulement, jamais sur une image), `.ring-image`
(sélection d'une image : un anneau autour, jamais un voile dessus).

## Typographie

Space Grotesk pour ce qu'on lit, JetBrains Mono pour ce que la machine produit
(valeurs envoyées à l'API : `4:3`, `2K`, `png`), Unbounded 800 pour les grands
titres seulement (`font-display`). Plancher : 10 px en mono.

## Primitives (components/atelier/ui.tsx)

`Button` (primary · secondary · ghost · danger), `IconButton`, `Kbd`,
`Segmented`, `Toggle`, `Section`, `Field`, `KeyValue`, `Shot`. Hauteurs : 32
(boutons, champs), 26 (cases de sélecteur), 28 (pastilles). Icônes Phosphor
Regular 16 px, variantes `XxxIcon` importées de `@phosphor-icons/react/dist/ssr`.

**Une seule action en encre pleine à l'écran : Générer.** Tout le reste est
secondaire, fantôme ou texte.

## Mots

- Infinitif sur les commandes (« Coller une clé »), « vous » dans les phrases.
- Un seul mot par notion : preset (pas recette), variante, référence, à éviter.
- Raccourcis écrits en capsules (`<Kbd keys={['mod', 'E']} />`), jamais en glyphe dans un libellé.
- Aucun texte en dur : `lib/i18n/fr.ts` fait référence, `en.ts` suit (`Dict`).

## Comportement

- La sélection décide : rien → réglages ; une image → sa fiche ; deux →
  comparaison ; davantage → export.
- Un réglage que le modèle ne lit pas n'est pas rendu (`MODELS` dans
  `lib/adapters/capabilities.ts`).
- Détruire s'annule (`Notice.undo`, ⌘Z) plutôt que se confirmer ; seule
  « Nouvelle session » est confirmée.
- Échap défait une couche à la fois, jamais une génération.
