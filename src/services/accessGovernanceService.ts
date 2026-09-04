import { supabase } from '@/lib/supabase';
import type {
  AccessAuditEvent,
  AccessAuditActor,
  AccessAuditFilters,
  AccessModuleNode,
  AccessPortal,
  AccessResource,
  AccessRole,
  ActorCategory,
  EffectivePermissionRow,
  RoleMatrix,
  RolePermissionCell,
  UserAccessAssignment,
} from '@/types/accessGovernance';

export interface PortalConfiguration {
  portal: AccessPortal | null;
  groups: Array<{
    code: string;
    name: string;
    sort_order: number;
    is_active: boolean;
    is_visible: boolean;
  }>;
  modules: AccessModuleNode[];
}

export interface SavePortalInput {
  id?: string | null;
  code: string;
  name: string;
  description?: string | null;
  institutionalScope?: string | null;
  isActive: boolean;
  groups: Array<{ code: string; is_active: boolean; is_visible: boolean }>;
  modules: Array<{ module_id: string; is_active: boolean; is_visible: boolean }>;
  reason: string;
}

export interface SaveRoleInput {
  id?: string | null;
  portalId: string;
  code: string;
  name: string;
  description?: string | null;
  legacyRole: string;
  isActive: boolean;
  categoryCodes: string[];
  permissions: RolePermissionCell[];
  reason: string;
}

export interface SaveUserAccessInput {
  userId: string;
  portalId: string;
  roleId: string;
  actorCategoryCode: string;
  resourceType?: string | null;
  resourceId?: string | null;
  restrictions: Array<{
    module_id: string;
    permission_code: string;
    denied: boolean;
    reason: string;
  }>;
  reason: string;
}

export interface UpdateUserAccessInput extends SaveUserAccessInput {
  fullName: string;
  phone?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  isActive: boolean;
  responsibilities: Record<string, boolean>;
}

interface RpcError {
  message?: string;
  details?: string;
  hint?: string;
}

function governanceError(error: RpcError | null | undefined, fallback: string): Error {
  const detail = [error?.message, error?.details, error?.hint].filter(Boolean).join(' — ');
  return new Error(detail || fallback);
}

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw governanceError(error, 'Le service de gouvernance des accès est indisponible.');
  return data as T;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export const accessGovernanceService = {
  async listActorCategories(): Promise<ActorCategory[]> {
    return asArray<ActorCategory>(await rpc('snp_access_actor_categories'));
  },

  async listPortals(includeInactive = true): Promise<AccessPortal[]> {
    return asArray<AccessPortal>(await rpc('snp_access_portals_list', {
      p_include_inactive: includeInactive,
    }));
  },

  async getPortalConfiguration(portalId?: string): Promise<PortalConfiguration> {
    const result = await rpc<PortalConfiguration>('snp_access_portal_configuration', {
      p_portal_id: portalId || null,
    });
    return {
      portal: result.portal,
      groups: asArray(result.groups),
      modules: asArray(result.modules),
    };
  },

  async savePortal(input: SavePortalInput): Promise<AccessPortal> {
    return rpc<AccessPortal>('snp_access_portal_save', {
      p_portal_id: input.id || null,
      p_code: input.code,
      p_name: input.name,
      p_description: input.description || null,
      p_institutional_scope: input.institutionalScope || null,
      p_is_active: input.isActive,
      p_groups: input.groups,
      p_modules: input.modules,
      p_reason: input.reason,
    });
  },

  async archivePortal(portalId: string, reason: string): Promise<void> {
    await rpc('snp_access_portal_archive', {
      p_portal_id: portalId,
      p_reason: reason,
    });
  },

  async listRoles(portalId?: string, includeInactive = true): Promise<AccessRole[]> {
    return asArray<AccessRole>(await rpc('snp_access_roles_list', {
      p_portal_id: portalId || null,
      p_include_inactive: includeInactive,
    }));
  },

  async getRoleMatrix(roleId: string): Promise<RoleMatrix> {
    const result = await rpc<RoleMatrix>('snp_access_role_matrix', { p_role_id: roleId });
    return {
      role: result.role,
      modules: asArray(result.modules),
      permissions: asArray(result.permissions),
    };
  },

  async saveRole(input: SaveRoleInput): Promise<AccessRole> {
    return rpc<AccessRole>('snp_access_role_save', {
      p_role_id: input.id || null,
      p_portal_id: input.portalId,
      p_code: input.code,
      p_name: input.name,
      p_description: input.description || null,
      p_legacy_role: input.legacyRole,
      p_is_active: input.isActive,
      p_category_codes: input.categoryCodes,
      p_permissions: input.permissions,
      p_reason: input.reason,
    });
  },

  async searchResources(categoryCode: string, query = '', offset = 0, limit = 20): Promise<AccessResource[]> {
    return asArray<AccessResource>(await rpc('snp_access_resources_search', {
      p_category_code: categoryCode,
      p_query: query,
      p_offset: offset,
      p_limit: Math.min(Math.max(limit, 1), 50),
    }));
  },

  async listCompatiblePortals(categoryCode: string): Promise<AccessPortal[]> {
    return asArray<AccessPortal>(await rpc('snp_access_compatible_portals', {
      p_category_code: categoryCode,
    }));
  },

  async listCompatibleRoles(portalId: string, categoryCode: string): Promise<AccessRole[]> {
    return asArray<AccessRole>(await rpc('snp_access_compatible_roles', {
      p_portal_id: portalId,
      p_category_code: categoryCode,
    }));
  },

  async getUserAssignment(userId: string): Promise<UserAccessAssignment | null> {
    return rpc<UserAccessAssignment | null>('snp_access_user_assignment', { p_user_id: userId });
  },

  async getEffectiveMatrix(roleId: string, userId?: string): Promise<EffectivePermissionRow[]> {
    return asArray<EffectivePermissionRow>(await rpc('snp_access_effective_matrix', {
      p_role_id: roleId,
      p_user_id: userId || null,
    }));
  },

  async saveUserAccess(input: SaveUserAccessInput): Promise<UserAccessAssignment> {
    return rpc<UserAccessAssignment>('snp_access_user_assignment_save', {
      p_user_id: input.userId,
      p_portal_id: input.portalId,
      p_role_id: input.roleId,
      p_actor_category_code: input.actorCategoryCode,
      p_resource_type: input.resourceType || null,
      p_resource_id: input.resourceId || null,
      p_restrictions: input.restrictions,
      p_reason: input.reason,
    });
  },

  async updateUserAccess(input: UpdateUserAccessInput): Promise<UserAccessAssignment> {
    return rpc<UserAccessAssignment>('snp_access_user_account_update', {
      p_user_id: input.userId,
      p_full_name: input.fullName,
      p_phone: input.phone || null,
      p_job_title: input.jobTitle || null,
      p_department: input.department || null,
      p_is_active: input.isActive,
      p_portal_id: input.portalId,
      p_role_id: input.roleId,
      p_actor_category_code: input.actorCategoryCode,
      p_resource_type: input.resourceType || null,
      p_resource_id: input.resourceId || null,
      p_responsibilities: input.responsibilities,
      p_restrictions: input.restrictions,
      p_reason: input.reason,
    });
  },

  async listAuditEvents(filters: AccessAuditFilters): Promise<AccessAuditEvent[]> {
    return asArray<AccessAuditEvent>(await rpc('snp_access_audit_feed', {
      p_filters: filters,
    }));
  },

  async listAuditActors(): Promise<AccessAuditActor[]> {
    return asArray<AccessAuditActor>(await rpc('snp_access_audit_actors'));
  },

  async exportAuditEvents(filters: AccessAuditFilters): Promise<AccessAuditEvent[]> {
    return asArray<AccessAuditEvent>(await rpc('snp_access_audit_export', {
      p_filters: filters,
    }));
  },
};
