import type { UserProfile } from '@/types/auth';
import { CAPABILITIES, hasCapability } from '@/lib/capabilities';

const COMPTOIR_ROUTE_PREFIXES = [
  '/portail-comptoir',
  '/artisan-minier/liste',
  '/artisan-minier/ventes-or',
  '/artisan-minier/paiements',
  '/artisan-minier/rapports',
  '/profile',
  '/help',
] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Un comptoir utilise le rôle de compte partenaire historique `customer`, mais
 * son habilitation autoritative vient du serveur. Le test du rôle empêche les
 * agents SONASP disposant d'une capacité de supervision d'être basculés dans ce
 * portail opérationnel.
 */
export function isComptoirScopedUser(user: UserProfile | null | undefined): boolean {
  return Boolean(
    user?.is_active
      && user.role === 'customer'
      && hasCapability(user, CAPABILITIES.COMPTOIR_MANAGE),
  );
}

export function isComptoirRouteAllowed(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  // Consultation d'une fiche d'orpailleur assigné ; les variantes d'édition et
  // d'infraction restent volontairement exclues.
  if (/^\/artisan-minier\/[0-9a-f-]{36}$/i.test(normalized)) return true;
  return COMPTOIR_ROUTE_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix));
}
