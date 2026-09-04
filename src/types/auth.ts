import type { Session } from '@supabase/supabase-js';

export type UserRole =
  | 'owner'
  | 'admin'
  | 'management'
  | 'manager'
  | 'dgmg'
  | 'dgi'
  | 'mine'
  | 'comptoir'
  | 'collector'
  | 'factory'
  | 'airport'
  | 'refinery'
  | 'customer';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  /** Société minière représentée. `null` pour un compte interne SONASP ou un client acheteur. */
  mining_company_id: string | null;
  /** Organisation principale issue du rattachement RBAC/ABAC autoritatif. */
  organization_id?: string | null;
  organization_type?: string | null;
  /** Responsabilités métier effectives, distinctes des permissions CRUD. */
  responsibilities?: string[];
  /** Domaines de modules effectivement ouverts par le resolver de permissions. */
  module_domains?: string[];
  /** Codes canoniques des modules actifs effectivement attribués au compte. */
  module_codes?: string[];
  access_portal_id?: string | null;
  access_portal_code?: string | null;
  access_portal_name?: string | null;
  access_role_id?: string | null;
  access_role_code?: string | null;
  access_role_name?: string | null;
  actor_category_code?: string | null;
  site_ids: string[];
  is_active: boolean;
  /** Capacités effectives calculées côté serveur pour cette session et son AAL. */
  capabilities?: string[];
  /** Habilité à approuver les ventes (or artisanal & international) avant facturation/paiement. */
  is_sales_approver: boolean;
  two_factor_enabled: boolean;
  language: string | null;
  email_notifications: boolean;
  batch_notifications: boolean;
  approval_notifications: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  profileLoading: boolean;
  profileError: string | null;
}
