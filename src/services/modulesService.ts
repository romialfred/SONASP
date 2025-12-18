/**
 * Modules Service
 * Service pour charger les modules depuis Supabase
 */

import { supabase } from '@/lib/supabase';

export interface Module {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category?: string;
  icon?: string;
  is_active: boolean;
  created_at?: string;
}

export interface ModulePermission {
  module_id: string;
  module_name: string;
  display_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
}

/**
 * Charger tous les modules actifs
 */
export async function loadModules(): Promise<Module[]> {
  try {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('is_active', true)
      .order('display_name');

    if (error) {
      console.error('Error loading modules:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to load modules:', error);
    return [];
  }
}

/**
 * Charger les modules par catégorie
 */
export async function loadModulesByCategory(category: string): Promise<Module[]> {
  try {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('is_active', true)
      .eq('category', category)
      .order('display_name');

    if (error) {
      console.error('Error loading modules by category:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Failed to load modules by category:', error);
    return [];
  }
}

/**
 * Charger les permissions d'un utilisateur
 */
export async function loadUserPermissions(userId: string): Promise<Record<string, ModulePermission>> {
  try {
    const { data, error } = await supabase
      .from('user_permissions')
      .select(`
        *,
        modules:module_id (
          name,
          display_name
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Error loading user permissions:', error);
      return {};
    }

    const permissions: Record<string, ModulePermission> = {};

    data?.forEach((perm: any) => {
      permissions[perm.module_id] = {
        module_id: perm.module_id,
        module_name: perm.modules?.name || '',
        display_name: perm.modules?.display_name || '',
        can_view: perm.can_read || false,
        can_create: perm.can_write || false,
        can_edit: perm.can_write || false,
        can_delete: perm.can_delete || false,
        can_approve: perm.can_approve || false,
      };
    });

    return permissions;
  } catch (error) {
    console.error('Failed to load user permissions:', error);
    return {};
  }
}

/**
 * Sauvegarder les permissions d'un utilisateur
 */
export async function saveUserPermissions(
  userId: string,
  permissions: Record<string, ModulePermission>,
  grantedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Supprimer les anciennes permissions
    await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId);

    // Préparer les nouvelles permissions
    const permsToInsert = Object.values(permissions)
      .filter(perm => perm.can_view || perm.can_create || perm.can_edit || perm.can_delete || perm.can_approve)
      .map(perm => ({
        user_id: userId,
        module_id: perm.module_id,
        can_read: perm.can_view,
        can_write: perm.can_create || perm.can_edit,
        can_delete: perm.can_delete,
        can_approve: perm.can_approve,
        granted_by: grantedBy,
      }));

    if (permsToInsert.length > 0) {
      const { error } = await supabase
        .from('user_permissions')
        .insert(permsToInsert);

      if (error) {
        console.error('Error saving permissions:', error);
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Failed to save permissions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtenir les catégories de modules disponibles
 */
export function getModuleCategories(): Array<{ id: string; label: string; icon: string; color: string }> {
  return [
    { id: 'overview', label: 'Overview', icon: '📊', color: 'blue' },
    { id: 'batches', label: 'Batches', icon: '📦', color: 'green' },
    { id: 'sales', label: 'Sales', icon: '💰', color: 'amber' },
    { id: 'operations', label: 'Operations', icon: '⚙️', color: 'indigo' },
    { id: 'analytics', label: 'Analytics', icon: '📈', color: 'purple' },
    { id: 'system', label: 'System', icon: '🔧', color: 'red' },
  ];
}
