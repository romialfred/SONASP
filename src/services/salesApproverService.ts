import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types/auth';

/**
 * Service des approbateurs de ventes.
 *
 * Un approbateur est un utilisateur de la plateforme habilité à approuver les ventes
 * (or artisanal & ventes à l'international) avant génération de la facture et émission
 * du paiement. Le droit est porté par la colonne `user_profiles.is_sales_approver`.
 *
 * La direction (rôles Propriétaire / Direction) approuve d'office ; ce service gère le
 * droit explicite accordé aux autres utilisateurs.
 */

export interface SalesApproverUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  is_sales_approver: boolean;
}

export const salesApproverService = {
  /** Liste l'ensemble des utilisateurs avec leur habilitation d'approbation. */
  async list(): Promise<SalesApproverUser[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, role, is_active, is_sales_approver')
      .order('full_name', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return (data ?? []) as SalesApproverUser[];
  },

  /** Accorde ou retire le droit d'approbation à un utilisateur. */
  async setApprover(userId: string, value: boolean): Promise<void> {
    const { error } = await supabase.rpc('snp_definir_approbateur_ventes', {
      p_user_id: userId,
      p_active: value,
    });

    if (error) throw error;
  },
};
