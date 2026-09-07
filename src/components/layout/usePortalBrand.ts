import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { comptoirService } from '@/services/comptoirService';
import type { UserProfile } from '@/types/auth';
import type { AccountType } from '@/lib/routeAccessRegistry';
import { PORTAL_THEMES } from './portalThemes';

export interface PortalBrand { name: string; shortName: string; logo: string | null; source: string }
export const NATIONAL_ARMS_LOGO = '/institutional/armoiries-burkina-faso.png';
export function institutionLogo(type?: string | null) {
  if (type === 'sonasp') return '/sonasp_logo.png';
  if (type && ['owner', 'admin', 'dgi', 'dgmg'].includes(type)) return NATIONAL_ARMS_LOGO;
  return null;
}

/** Only the authoritative session can select an organization. No URL/local-storage input. */
export function usePortalBrand(user: UserProfile | null, accountType: AccountType, mineName?: string | null) {
  const userId = user?.id;
  const profileOrganizationId = user?.organization_id;
  const key = [user?.id, user?.organization_id, user?.mining_company_id, accountType].join(':');
  const [result, setResult] = useState<{ key: string; brand: PortalBrand } | null>(null);
  const fallback: PortalBrand = {
    name: accountType === 'mine' ? mineName || 'Société minière' : PORTAL_THEMES[accountType].label,
    shortName: accountType === 'mine' ? mineName || 'Société minière' : PORTAL_THEMES[accountType].label,
    logo: ['sonasp', 'direction'].includes(accountType) ? institutionLogo('sonasp') : institutionLogo(accountType),
    source: 'Identité du portail ; organisation non résolue',
  };
  useEffect(() => {
    let current = true;
    // The administrator represents the platform, even if their profile has an organization.
    if (!userId || ['owner', 'admin', 'unknown', 'mine'].includes(accountType)) return;
    async function load() {
      try {
        let organizationId = profileOrganizationId;
        if (!organizationId && ['comptoir', 'collector'].includes(accountType)) {
          const { data, error } = await supabase.rpc('snp_current_organization_id');
          if (error) return;
          organizationId = data;
        }
        if (!organizationId) return;
        const { data, error } = await supabase.from('snp_organizations')
          .select('id, name, code, organization_type').eq('id', organizationId).maybeSingle();
        if (error || !data || !current) return;
        const brand: PortalBrand = { name: data.name, shortName: data.code || data.name, logo: institutionLogo(data.organization_type), source: 'Organisation autorisée de la session' };
        if (data.organization_type === 'comptoir') {
          try {
            const dossier = await comptoirService.get(data.id);
            const document = dossier.documents.filter(item => item.kind === 'logo').sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0];
            if (document) {
              brand.logo = await comptoirService.url(document);
              brand.source = 'Logo privé du dossier comptoir, URL signée';
            }
          } catch { /* Keep the authorized organization and the national arms fallback. */ }
        }
        if (current) setResult({ key, brand });
      } catch { /* An inaccessible logo never broadens access or blocks navigation. */ }
    }
    void load();
    return () => { current = false; };
  }, [key, accountType, userId, profileOrganizationId]);
  return result?.key === key ? result.brand : fallback;
}
