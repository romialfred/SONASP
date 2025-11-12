/**
 * Utility functions to filter mining companies
 */

interface MiningCompany {
  id: string;
  name: string;
  [key: string]: any;
}

/**
 * Filtre pour exclure "Mansa Resources S.A." (société mère)
 * des listes de sociétés minières opérationnelles
 */
export function filterOperationalMiningCompanies<T extends MiningCompany>(
  companies: T[]
): T[] {
  return companies.filter(
    company => company.name !== 'Mansa Resources S.A.'
  );
}

/**
 * Vérifie si une société est la société mère (Mansa Resources S.A.)
 */
export function isParentCompany(companyName: string): boolean {
  return companyName === 'Mansa Resources S.A.';
}
