/**
 * Textes de la landing. Français seulement pour l'instant ; une version
 * anglaise reprendra le type `LandingDict` (ticket T-0056).
 */
export const landingFr = {
  meta: {
    title: "Obskura — générateur d'images open source",
    description:
      'Un outil open source pour générer des images avec plusieurs modèles, et les comparer côte à côte. Deux modèles en parallèle, chaque écart listé.',
  },
  bar: {
    status: 'POST /api/generate',
    statuses: { pret: 'prêt', envoi: 'envoi…', recu: '200 OK' },
    nav: 'Liens',
    source: 'Code source',
    open: "Ouvrir l'app",
  },
  hero: {
    eyebrow: "Générateur d'images open source",
    title: 'Un prompt. Plusieurs regards.',
    leadStart: 'Un outil open source pour générer des images avec plusieurs modèles, et ',
    leadEm: 'les comparer côte à côte',
    leadEnd: '. Deux modèles en parallèle, chaque écart listé.',
    choose: 'Choisir un prompt',
    bytes: 'octets',
    bodyLabel: 'Corps de la requête envoyée à',
    field: 'Champ',
    fieldHint: "Survoler un champ pour lire ce qu'il fait.",
    cue: 'Défiler pour générer',
  },
  hud: {
    title: 'En route',
    steps: ['Requête', 'Transit', 'Glyphes', 'Pixels', 'Image'],
    ramp: 'rampe  .:-=+*#%@',
    sent: 'envoyé',
    placed: 'en place',
    color: 'couleur',
    cells: 'cellules',
    glyphs: 'glyphes',
    columns: 'colonnes',
    pixels: '1536 × 864 = 1 327 104 pixels',
  },
  after: {
    title: "Une image. Et si un autre modèle l'avait faite ?",
    fiche: { prompt: 'Prompt', model: 'Modèle', format: 'Format', seed: 'Seed', sent: 'Envoyé' },
    compare: 'Comparer avec',
    replay: 'Rejouer',
    seed: 'seed',
  },
  images: {
    mock: 'Image dessinée au canvas pour cette maquette, pas une sortie de modèle.',
    mockPair: 'Deux rendus dessinés au canvas, en attendant de vraies sorties.',
    realOf: 'Sortie de',
  },
  compare: {
    eyebrow: 'Comparer',
    title: 'Un prompt. Deux modèles. Chaque écart listé.',
    body: "Cochez « en parallèle » : le même prompt part vers deux modèles à la fois. Les deux images arrivent en paire, côte à côte, avec la liste de ce qui diffère : réglages, coût, et ce qu'un modèle a ignoré.",
    slider: "Curseur de cette page : l'app les montre côte à côte.",
    sliderLabel: 'Comparer les deux images',
    setting: 'Réglage',
    gap: 'Écart',
    same: 'identique',
    different: 'différent',
    ignored: 'ignoré ici',
  },
  models: {
    eyebrow: 'Modèles',
    title: 'Quatre modèles, un seul outil.',
    body: "Nano Banana 2, GPT Image 2, GPT Image 2.5 Sunburst et Flare, chacun avec son tarif estimé. Changer de modèle adapte la requête : les réglages qu'il ne lit pas sont retirés, et vous le voyez.",
    legend: 'Modèle',
    perImage: '/ image',
    settings: 'Vos réglages',
    ignored: 'Ignorés ici',
    none: 'aucun',
    build: 'construit le corps',
    prune: 'retire ce que le modèle ne lit pas',
  },
  source: {
    eyebrow: 'Open source',
    title: 'Le code est ouvert. Vos clés restent chez vous.',
    body: 'Licence MIT. Lancez-le en local ou hébergez-le : pas de compte, pas de base, vos clés servent seulement à appeler le fournisseur.',
    install: 'Démarrer en local',
    nodes: [
      { label: 'Navigateur', title: 'Votre machine', items: ['clés · réglages · session', 'localStorage'] },
      { label: 'Route', title: '/api/generate', items: ['valide la requête', 'limite le débit', "choisit l'adapter", 'ne garde rien'] },
      { label: 'Fournisseur', title: 'Google · OpenAI', items: ['Nano Banana 2', 'GPT Image 2 · 2.5'] },
    ],
    wires: ['x-api-key', 'corps exact'],
  },
  foot: {
    big: 'Un prompt, plusieurs modèles, côte à côte.',
    source: 'Code source sur GitHub',
    colophon: ['MIT © 2026 Samuel Boulery', 'Unbounded · Space Grotesk · JetBrains Mono', 'Suite avec screenmat'],
  },
}

export type LandingDict = typeof landingFr
