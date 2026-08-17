import { useState, useEffect } from 'react';
import type React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface FieldPermission {
  can_view: boolean;
  can_edit: boolean;
}

interface ModulePermissions {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  field_permissions: Record<string, FieldPermission>;
}

interface UseFieldPermissionsReturn {
  canViewField: (moduleName: string, fieldName: string) => boolean;
  canEditField: (moduleName: string, fieldName: string) => boolean;
  canAccessModule: (moduleName: string, accessType: 'read' | 'write' | 'delete') => boolean;
  permissions: Record<string, ModulePermissions>;
  loading: boolean;
  isManagement: boolean;
}

export function useFieldPermissions(): UseFieldPermissionsReturn {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, ModulePermissions>>({});
  const [loading, setLoading] = useState(true);

  const isManagement = user?.role === 'management' || user?.role === 'owner';

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    loadPermissions();
  }, [user?.id, isManagement]);

  const loadPermissions = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Management users have access to everything
      if (isManagement) {
        setPermissions({});
        setLoading(false);
        return;
      }

      const { data: userPermissions, error } = await supabase
        .from('user_permissions')
        .select(`
          *,
          modules:module_id (
            id,
            name,
            display_name
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading permissions:', error);
        setLoading(false);
        return;
      }

      if (userPermissions && userPermissions.length > 0) {
        const permsMap: Record<string, ModulePermissions> = {};

        userPermissions.forEach((perm: any) => {
          const moduleName = perm.modules?.name;
          if (moduleName) {
            permsMap[moduleName] = {
              can_read: perm.can_read || false,
              can_write: perm.can_write || false,
              can_delete: perm.can_delete || false,
              field_permissions: perm.field_permissions || {},
            };
          }
        });

        setPermissions(permsMap);
      }
    } catch (error) {
      console.error('Error in loadPermissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const canViewField = (moduleName: string, fieldName: string): boolean => {
    // Management role has access to everything
    if (isManagement) return true;

    const modulePerms = permissions[moduleName];
    if (!modulePerms) return false;

    const fieldPerm = modulePerms.field_permissions[fieldName];
    if (!fieldPerm) {
      // If no specific field permission, default to module read permission
      return modulePerms.can_read;
    }

    return fieldPerm.can_view;
  };

  const canEditField = (moduleName: string, fieldName: string): boolean => {
    // Management role has access to everything
    if (isManagement) return true;

    const modulePerms = permissions[moduleName];
    if (!modulePerms) return false;

    const fieldPerm = modulePerms.field_permissions[fieldName];
    if (!fieldPerm) {
      // If no specific field permission, default to module write permission
      return modulePerms.can_write;
    }

    return fieldPerm.can_edit;
  };

  const canAccessModule = (
    moduleName: string,
    accessType: 'read' | 'write' | 'delete'
  ): boolean => {
    // Management role has access to everything
    if (isManagement) return true;

    const modulePerms = permissions[moduleName];
    if (!modulePerms) return false;

    switch (accessType) {
      case 'read':
        return modulePerms.can_read;
      case 'write':
        return modulePerms.can_write;
      case 'delete':
        return modulePerms.can_delete;
      default:
        return false;
    }
  };

  return {
    canViewField,
    canEditField,
    canAccessModule,
    permissions,
    loading,
    isManagement,
  };
}

// Helper component to conditionally render based on field permission
export function ProtectedField({
  moduleName,
  fieldName,
  accessType = 'view',
  children,
  fallback = null,
}: {
  moduleName: string;
  fieldName: string;
  accessType?: 'view' | 'edit';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { canViewField, canEditField, loading } = useFieldPermissions();

  if (loading) return null;

  const hasAccess =
    accessType === 'view'
      ? canViewField(moduleName, fieldName)
      : canEditField(moduleName, fieldName);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Helper function to mask sensitive data
export function maskSensitiveData(value: string | number, moduleName: string, fieldName: string): string {
  const { canViewField } = useFieldPermissions();

  if (canViewField(moduleName, fieldName)) {
    return String(value);
  }

  // Mask the data
  if (typeof value === 'number') {
    return '***.**';
  }

  return '***';
}
