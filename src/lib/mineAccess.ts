import type { UserProfile } from '@/types/auth';
import { accountTypeFor, canAccountTypeAccessPath } from '@/lib/routeAccessRegistry';

export function isMineScopedUser(
  user: Pick<UserProfile, 'is_active' | 'role' | 'mining_company_id' | 'capabilities'> | null
): boolean {
  return accountTypeFor(user) === 'mine';
}

export function isMineTenantProfile(
  user: Pick<UserProfile, 'is_active' | 'role' | 'mining_company_id'> | null,
): boolean {
  return Boolean(
    user?.is_active
      && user.role !== 'owner'
      && (user.role === 'mine' || user.mining_company_id),
  );
}

export function isMineRouteAllowed(pathname: string): boolean {
  return canAccountTypeAccessPath('mine', pathname);
}
