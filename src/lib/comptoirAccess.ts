import type { UserProfile } from '@/types/auth';
import { accountTypeFor, canAccountTypeAccessPath } from '@/lib/routeAccessRegistry';

/**
 * Un comptoir utilise le rôle de compte partenaire historique `customer`, mais
 * son habilitation autoritative vient du serveur. Le test du rôle empêche les
 * agents SONASP disposant d'une capacité de supervision d'être basculés dans ce
 * portail opérationnel.
 */
export function isComptoirScopedUser(user: UserProfile | null | undefined): boolean {
  return accountTypeFor(user) === 'comptoir';
}

export function isComptoirRouteAllowed(pathname: string): boolean {
  return canAccountTypeAccessPath('comptoir', pathname);
}
