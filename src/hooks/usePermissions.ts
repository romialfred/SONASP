import { useAuth } from '@/contexts/AuthContext';
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isManagement,
  canAccessSite,
} from '@/lib/permissions';

export function usePermissions() {
  const { user } = useAuth();

  return {
    hasPermission: (permission: string) => hasPermission(user, permission),
    hasAnyPermission: (permissions: string[]) => hasAnyPermission(user, permissions),
    hasAllPermissions: (permissions: string[]) => hasAllPermissions(user, permissions),
    isManagement: () => isManagement(user),
    canAccessSite: (siteId: string) => canAccessSite(user, siteId),
    user,
  };
}
