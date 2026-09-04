import { supabase } from '@/lib/supabase';
import { messageErreurUtilisateur } from '@/lib/presentError';
import {
  OPERATIONAL_CAPABILITY_OPTIONS,
  type OperationalCapabilityCode,
  type OperationalCapabilityMap,
} from '@/lib/capabilities';

const codes = OPERATIONAL_CAPABILITY_OPTIONS.map(({ code }) => code);

export const userCapabilitiesService = {
  async load(userId: string): Promise<{
    overrides: Partial<OperationalCapabilityMap>;
    error: string | null;
  }> {
    const overrides: Partial<OperationalCapabilityMap> = {};
    const { data, error } = await (supabase as any)
      .from('snp_user_capabilities')
      .select('capability_code, allowed')
      .eq('user_id', userId)
      .in('capability_code', codes);

    if (error) return { overrides, error: messageErreurUtilisateur(error, 'Impossible de charger les capacités.') };
    (data ?? []).forEach((row: any) => {
      const code = row.capability_code as OperationalCapabilityCode;
      if (codes.includes(code)) overrides[code] = row.allowed === true;
    });
    return { overrides, error: null };
  },

  async save(
    userId: string,
    previous: OperationalCapabilityMap,
    next: OperationalCapabilityMap,
  ): Promise<{ success: boolean; error?: string }> {
    for (const { code, label } of OPERATIONAL_CAPABILITY_OPTIONS) {
      if (previous[code] === next[code]) continue;
      const { error } = await (supabase as any).rpc('snp_definir_capacite_utilisateur', {
        p_user_id: userId,
        p_capability_code: code,
        p_allowed: next[code],
        p_reason: `${next[code] ? 'Attribution' : 'Retrait'} depuis l’administration : ${label}`,
        p_valid_until: null,
      });
      if (error) return { success: false, error: messageErreurUtilisateur(error, 'La mise à jour d’une capacité a échoué.') };
    }
    return { success: true };
  },
};
