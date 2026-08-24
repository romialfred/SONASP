import type { UserProfile } from '@/types/auth';
import { CAPABILITIES, hasCapability } from '@/lib/capabilities';

const COLLECTOR_EXACT_ROUTES = new Set([
  '/portail-collecteur',
  '/portail-collecteur/stock',
  '/portail-collecteur/documents',
  '/artisan-minier/liste',
  '/artisan-minier/ventes-or',
  '/artisan-minier/paiements/historique',
  '/artisan-minier/rapports/taxes',
  '/profile',
  '/help',
]);

/** Le rôle partenaire historique est précisé par la capacité serveur. */
export function isCollectorScopedUser(user: UserProfile | null | undefined): boolean {
  return Boolean(
    user?.is_active
      && user.role === 'customer'
      && hasCapability(user, CAPABILITIES.COLLECTOR_OPERATE),
  );
}

export function isCollectorRouteAllowed(pathname: string): boolean {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (COLLECTOR_EXACT_ROUTES.has(normalized)) return true;
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
  if (new RegExp(`^/artisan-minier/${uuid}$`, 'i').test(normalized)) return true;
  return new RegExp(`^/artisan-minier/ventes-or/${uuid}$`, 'i').test(normalized);
}
