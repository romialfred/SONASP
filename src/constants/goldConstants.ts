/**
 * Constantes canoniques — Or & calculs financiers SONASP
 * =======================================================
 * SOURCE DE VÉRITÉ UNIQUE. Ne jamais redéfinir ces valeurs ailleurs
 * (ni en littéral, ni dans un autre module). Toute la plateforme doit
 * importer depuis ce fichier.
 *
 * Audit SONASP — corrige F1/F2/F3/F4, Q2/Q3/Q4, C-11 :
 *  - une seule constante de conversion once troy (valeur exacte),
 *  - un seul taux de royalties (aligné sur business_rules.gold_royalty_percentage),
 *  - suppression de l'once avoirdupois (28,3495 g) pour l'or.
 */

/**
 * Grammes par once troy — valeur EXACTE (définition internationale).
 * 1 troy ounce = 31,1034768 g.
 * (L'ancienne valeur arrondie 31,1035 est bannie ; la règle DB
 * `business_rules.grams_to_ounces` doit être mise à jour en conséquence.)
 */
export const TROY_OZ_GRAMS = 31.1034768;

/** Alias historiques — pointent tous vers la valeur canonique. */
export const GRAMS_PER_TROY_OZ = TROY_OZ_GRAMS;
export const GRAMS_PER_OZ_TROY = TROY_OZ_GRAMS;

/** Onces troy par kilogramme (1000 / 31,1034768). */
export const TROY_OZ_PER_KG = 1000 / TROY_OZ_GRAMS;

/**
 * Taux de royalties « net smelted » appliqué aux ventes d'or.
 * Valeur par défaut alignée sur `business_rules.gold_royalty_percentage` (3,0 %).
 * À terme, lire dynamiquement la règle métier ; cette constante reste le repli.
 */
export const GOLD_ROYALTY_RATE = 0.03;

/**
 * Convertit des grammes en onces troy (source de vérité unique).
 */
export function gramsToTroyOz(grams: number): number {
  return grams / TROY_OZ_GRAMS;
}

/**
 * Convertit des onces troy en grammes (source de vérité unique).
 */
export function troyOzToGrams(troyOz: number): number {
  return troyOz * TROY_OZ_GRAMS;
}
