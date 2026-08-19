/**
 * Palette des graphiques de production.
 *
 * Les camemberts et histogrammes tiraient chacun leur propre arc-en-ciel de douze
 * teintes Tailwind — rose, violet, cyan, lime — sans rapport avec la charte, et
 * differentes d'un graphique a l'autre pour une meme compagnie. La rampe ci-dessous
 * reste dans la famille vert / or / ardoise de la plateforme, et les teintes
 * voisines sont assez eloignees pour rester distinguables cote a cote.
 */
export const PALETTE_PRODUCTION = [
  '#0f7a56', // vert charte
  '#d99a00', // or charte
  '#2c6b8f', // ardoise
  '#5aa17f', // vert clair
  '#eec25a', // or clair
  '#10243e', // navy
  '#7fa8bf', // ardoise clair
  '#8c6b1f', // bronze
] as const;

/** Teinte stable pour un rang donne, quel que soit le graphique. */
export const teinteProduction = (index: number) =>
  PALETTE_PRODUCTION[((index % PALETTE_PRODUCTION.length) + PALETTE_PRODUCTION.length) % PALETTE_PRODUCTION.length];
