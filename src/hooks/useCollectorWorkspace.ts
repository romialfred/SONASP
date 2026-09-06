import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isCollectorScopedUser } from '@/lib/collectorAccess';
import { supabase } from '@/lib/supabase';
import { collectorService } from '@/services/collectorService';

export interface CollectorWorkspace {
  collectorId: string;
  collectorName: string;
  collectorCardNumber: string | null;
  organizationId: string;
  organizationName: string;
  organizationCode: string;
  assignedArtisanIds: string[];
}

export function useCollectorWorkspace() {
  const { user } = useAuth();
  const isCollector = isCollectorScopedUser(user);
  const [workspace, setWorkspace] = useState<CollectorWorkspace | null>(null);
  const [loading, setLoading] = useState(isCollector);

  useEffect(() => {
    if (!isCollector) {
      setWorkspace(null);
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: collectorId, error: collectorError }, { data: organizationId, error: organizationError }] = await Promise.all([
          supabase.rpc('snp_current_collector_id'),
          supabase.rpc('snp_current_organization_id'),
        ]);
        if (collectorError) throw collectorError;
        if (organizationError) throw organizationError;
        if (!collectorId || !organizationId) throw new Error('Aucun périmètre Collecteur actif.');
        const nowIso = new Date().toISOString();

        const [{ data: collector, error: profileError }, { data: organization, error: scopeError }, { data: assignments, error: assignmentsError }] = await Promise.all([
          supabase.from('snp_artisans_miniers')
            .select('id, nom, prenoms, raison_sociale, numero_carte')
            .eq('id', collectorId)
            .single(),
          supabase.from('snp_organizations')
            .select('id, code, name, organization_type')
            .eq('id', organizationId)
            .in('organization_type', ['comptoir', 'sonasp'])
            .single(),
          supabase.from('snp_collector_artisan_assignments')
            .select('artisan_id')
            .eq('collector_id', collectorId)
            .lte('valid_from', nowIso)
            .or(`valid_until.is.null,valid_until.gt.${nowIso}`),
        ]);
        if (profileError) throw profileError;
        if (scopeError) throw scopeError;
        if (assignmentsError) throw assignmentsError;
        const siteAndHistoryArtisans = await collectorService.workspaceArtisanIds();

        if (active) {
          setWorkspace({
            collectorId,
            collectorName: collector.raison_sociale
              || [collector.nom, collector.prenoms].filter(Boolean).join(' ')
              || 'Collecteur d’or',
            collectorCardNumber: collector.numero_carte || null,
            organizationId,
            organizationName: organization.name,
            organizationCode: organization.code,
            assignedArtisanIds: [...new Set([...(assignments || []).map((row) => row.artisan_id), ...siteAndHistoryArtisans])],
          });
        }
      } catch (error) {
        console.warn('[Collecteur] Périmètre indisponible:', error);
        if (active) setWorkspace(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [isCollector, user?.id]);

  return { isCollector, workspace, loading };
}
