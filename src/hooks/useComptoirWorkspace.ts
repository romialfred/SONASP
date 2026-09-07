import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { isComptoirScopedUser } from '@/lib/comptoirAccess';

export interface ComptoirWorkspace {
  id: string;
  code: string;
  name: string;
}
export function useComptoirWorkspace() {
  const { user } = useAuth();
  const isComptoir = isComptoirScopedUser(user);
  const contextKey = [user?.id, user?.organization_id, isComptoir].join(":");
  const [loadedContext, setLoadedContext] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<ComptoirWorkspace | null>(null);
  const [loading, setLoading] = useState(isComptoir);

  useEffect(() => {
    if (!isComptoir) {
      setWorkspace(null);
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      setWorkspace(null);
      try {
        const client = supabase as any;
        const { data: organizationId, error: idError } = await client.rpc('snp_current_organization_id');
        if (idError) throw idError;
        if (!organizationId) throw new Error('Aucun comptoir n’est rattaché à ce compte.');

        const { data, error } = await client
          .from('snp_organizations')
          .select('id, code, name, organization_type')
          .eq('id', organizationId)
          .eq('organization_type', 'comptoir')
          .single();
        if (error) throw error;
        if (active) setWorkspace({ id: data.id, code: data.code, name: data.name });
      } catch (error) {
        console.warn('[Comptoir] Périmètre indisponible:', error);
        if (active) setWorkspace(null);
      } finally {
        if (active) { setLoadedContext(contextKey); setLoading(false); }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [isComptoir, contextKey]);

  return {
    isComptoir,
    workspace: loadedContext === contextKey ? workspace : null,
    loading: loading || (isComptoir && loadedContext !== contextKey),
    displayName: (loadedContext === contextKey ? workspace?.code || workspace?.name : null) || 'Comptoir d’or',
  };
}
