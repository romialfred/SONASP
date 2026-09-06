import type { UserProfile } from '@/types/auth';

/** Gestion du référentiel minier, distincte des opérations commerciales. */
export function canManageMiningRegistry(user: UserProfile | null): boolean {
  return Boolean(user?.is_active && !user.mining_company_id
    && ['owner', 'admin', 'dgmg'].includes(user.role));
}
