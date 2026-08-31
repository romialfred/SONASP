import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { isMineScopedUser } from '@/lib/mineAccess';

export interface MineWorkspaceCompany {
  id: string;
  name: string;
  code: string | null;
  abbreviation: string | null;
}

const mineCache = new Map<string, MineWorkspaceCompany>();
const mineRequests = new Map<string, Promise<MineWorkspaceCompany | null>>();

async function chargerMine(companyId: string): Promise<MineWorkspaceCompany | null> {
  const cached = mineCache.get(companyId);
  if (cached) return cached;

  const pending = mineRequests.get(companyId);
  if (pending) return pending;

  const request = (async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name, code, abbreviation')
        .eq('id', companyId)
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) return null;
      const company = data as MineWorkspaceCompany;
      mineCache.set(companyId, company);
      return company;
    } finally {
      mineRequests.delete(companyId);
    }
  })();

  mineRequests.set(companyId, request);
  return request;
}

/**
 * Contexte léger de la mine authentifiée.
 *
 * L'identifiant vient exclusivement du profil autoritatif. Les écrans peuvent
 * afficher la raison sociale, mais ne proposent jamais de remplacer cet ID dans
 * un filtre ou un formulaire destiné à une société minière connectée.
 */
export function useMineWorkspace() {
  const { user } = useAuth();
  const isMine = isMineScopedUser(user);
  const companyId = isMine ? user?.mining_company_id || null : null;
  const [company, setCompany] = useState<MineWorkspaceCompany | null>(() =>
    companyId ? mineCache.get(companyId) || null : null
  );
  const [loading, setLoading] = useState(Boolean(companyId && !company));

  useEffect(() => {
    let active = true;
    if (!companyId) {
      setCompany(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const cached = mineCache.get(companyId);
    if (cached) {
      setCompany(cached);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    void chargerMine(companyId).then((result) => {
      if (!active) return;
      setCompany(result);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [companyId]);

  return useMemo(
    () => ({
      isMine,
      companyId,
      company,
      companyName: company?.name || (isMine ? 'Votre société minière' : null),
      companyCode: company?.code || company?.abbreviation || null,
      loading,
    }),
    [company, companyId, isMine, loading]
  );
}
