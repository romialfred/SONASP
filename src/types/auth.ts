import type { Session } from '@supabase/supabase-js';

export type UserRole = 'owner' | 'factory' | 'airport' | 'refinery' | 'customer' | 'mine' | 'manager' | 'management' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  /** Société minière représentée. `null` pour un compte interne SONASP ou un client acheteur. */
  mining_company_id: string | null;
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
