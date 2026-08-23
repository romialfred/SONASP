import type { UserProfile } from '@/types/auth';

/**
 * Routes fonctionnelles du portail national ouvertes aux sociétés minières.
 *
 * Cette liste est volontairement restrictive : elle sert de deuxième barrière
 * côté client en plus des rôles déclarés sur les routes et des politiques RLS.
 * Les actions purement SONASP (achat aux mines, planification nationale,
 * approbations, administration) n'y figurent jamais.
 */
const MINE_ROUTE_PREFIXES = [
  '/portail-mine',
  '/production/daily',
  '/production/in-safe',
  '/production/licenses',
  '/performance/budgets',
  '/performance/forecasts',
  '/contrats',
  '/achats/demandes',
  '/achats/reglements',
  '/requisitions',
  '/shipping/preparation',
  '/freight',
  '/freight-customs',
  '/refining',
  '/inventory',
  '/sales',
  '/customers',
  '/payments',
  '/gold-prices',
  '/fx-rates',
  '/stakeholders/freight-companies',
  '/stakeholders/refinery-plants',
  '/documents/assay-certificates',
  '/reports',
  '/profile',
  '/help',
] as const;

const MINE_FORBIDDEN_ROUTES = [
  '/production/achats-mines',
  '/contrats/nouveau',
  '/contrats/pilotage',
  '/achats/plans',
  '/achats/comptes',
  '/achats/reglements/nouveau',
  '/requisitions/nouvelle',
  '/inventory/add',
  '/sales/approve',
] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isMineScopedUser(
  user: Pick<UserProfile, 'is_active' | 'role' | 'mining_company_id'> | null
): boolean {
  return Boolean(
    user?.is_active
      && user.role !== 'owner'
      && (user.role === 'mine' || user.mining_company_id)
  );
}

export function isMineRouteAllowed(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (MINE_FORBIDDEN_ROUTES.some((route) => matchesPrefix(normalized, route))) return false;

  // La fiche d'une production réutilise `/production/:id`, sans ouvrir pour
  // autant la page SONASP `/production/achats-mines`.
  const productionDetail = /^\/production\/[^/]+$/.test(normalized);
  return productionDetail || MINE_ROUTE_PREFIXES.some((route) => matchesPrefix(normalized, route));
}
