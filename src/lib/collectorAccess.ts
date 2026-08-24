import type { UserProfile } from '@/types/auth';
import { accountTypeFor, canAccountTypeAccessPath } from '@/lib/routeAccessRegistry';

/** Le rôle partenaire historique est précisé par la capacité serveur. */
export function isCollectorScopedUser(user: UserProfile | null | undefined): boolean {
  return accountTypeFor(user) === 'collector';
}

export function isCollectorRouteAllowed(pathname: string): boolean {
  return canAccountTypeAccessPath('collector', pathname);
}
