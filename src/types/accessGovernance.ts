export const ACCESS_PERMISSION_CODES = [
  'view',
  'create',
  'edit',
  'delete',
  'submit',
  'validate',
  'approve',
  'reject',
  'export',
  'download',
  'admin',
] as const;

export type AccessPermissionCode = typeof ACCESS_PERMISSION_CODES[number];

export interface ActorCategory {
  code: string;
  name: string;
  description: string | null;
  resource_kind: 'mining_company' | 'organization' | 'artisan' | 'collector' | 'artisanal_site' | 'identity';
  legacy_role: string;
  is_active: boolean;
  sort_order: number;
}

export interface AccessPortal {
  id: string;
  code: string;
  name: string;
  description: string | null;
  institutional_scope: string | null;
  is_active: boolean;
  is_system: boolean;
  role_count: number;
  user_count: number;
  active_group_count: number;
  updated_at: string;
  updated_by_name: string | null;
}

export interface AccessRole {
  id: string;
  portal_id: string;
  portal_code: string;
  portal_name: string;
  code: string;
  name: string;
  description: string | null;
  legacy_role: string;
  is_active: boolean;
  is_system: boolean;
  user_count: number;
  updated_at: string;
  updated_by_name: string | null;
  category_codes: string[];
}

export interface AccessModuleNode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  route: string | null;
  parent_id: string | null;
  group_code: string | null;
  group_name: string | null;
  sort_order: number;
  is_globally_active: boolean;
  is_portal_active: boolean;
  is_portal_visible: boolean;
  permissions: AccessPermissionCode[];
}

export interface RolePermissionCell {
  module_id: string;
  permission_code: AccessPermissionCode;
  allowed: boolean;
}

export interface RoleMatrix {
  role: AccessRole;
  modules: AccessModuleNode[];
  permissions: RolePermissionCell[];
}

export interface AccessResource {
  id: string;
  category_code: string;
  resource_kind: ActorCategory['resource_kind'];
  display_name: string;
  secondary_name: string | null;
  code: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  representative: string | null;
  status: string;
  organization_id: string | null;
  organization_name: string | null;
  details: Record<string, unknown>;
}

export interface UserAccessAssignment {
  user_id: string;
  portal_id: string;
  portal_code: string;
  portal_name: string;
  role_id: string;
  role_code: string;
  role_name: string;
  actor_category_code: string;
  resource_type: string | null;
  resource_id: string | null;
  is_active: boolean;
  restriction_count: number;
}

export interface EffectivePermissionRow {
  module_id: string;
  module_code: string;
  module_name: string;
  parent_id: string | null;
  permission_code: AccessPermissionCode;
  portal_allowed: boolean;
  role_allowed: boolean;
  user_denied: boolean;
  effective: boolean;
}

export interface AccessAuditEvent {
  id: string;
  occurred_at: string;
  actor_id: string | null;
  actor_email: string | null;
  target_user_id: string | null;
  target_label: string | null;
  object_type: string;
  object_id: string | null;
  action: string;
  portal_code: string | null;
  role_code: string | null;
  result: 'success' | 'failure' | 'denied' | 'warning' | string;
  reason: string | null;
  ip_address: string | null;
  correlation_id: string | null;
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
}

export interface AccessAuditFilters {
  query?: string;
  from?: string;
  to?: string;
  actorId?: string;
  portalCode?: string;
  roleCode?: string;
  action?: string;
  result?: string;
  offset?: number;
  limit?: number;
}
