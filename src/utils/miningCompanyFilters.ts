/**
 * Sélection des sociétés qui produisent réellement de l'or.
 *
 * Le filtre écartait la société nommée exactement « Mansa Resources S.A. » —
 * société mère d'un autre exploitant, absente de ce référentiel. Il ne retirait
 * donc rien : la SOPAMIB (société de participation) et la SONASP elle-même
 * figuraient parmi les mines dans tous les sélecteurs, et se voyaient attribuer
 * des budgets de production nuls.
 *
 * Le tri se fait désormais sur `company_type`, qui porte l'information :
 * `production_mine` produit, `parent_company` et `institution` ne produisent pas.
 */

export const TYPE_MINE_PRODUCTRICE = 'production_mine';

interface MiningCompany {
  id: string;
  name: string;
  company_type?: string | null;
  [key: string]: unknown;
}

/**
 * Ne conserve que les mines productrices.
 *
 * Une société dont le type n'est pas renseigné est conservée : un référentiel
 * incomplet ne doit pas faire disparaître une mine des écrans de saisie.
 */
export function filterOperationalMiningCompanies<T extends MiningCompany>(companies: T[]): T[] {
  return companies.filter(
    (company) => !company.company_type || company.company_type === TYPE_MINE_PRODUCTRICE
  );
}

/** Vrai pour une société qui n'extrait pas : société mère ou institution. */
export function isParentCompany(company: { company_type?: string | null }): boolean {
  return !!company.company_type && company.company_type !== TYPE_MINE_PRODUCTRICE;
}
