import { CAPABILITIES } from '../../../src/lib/capabilities';
export const organization = { id: 'ea000000-0000-4000-8000-000000000001', organization_type: 'sonasp', code: 'SONASP', name: 'SONASP — contexte fictif de présentation' };
const user = {
  id: 'ea000000-0000-4000-8000-000000000002', full_name: 'Agent de présentation', email: 'presentation@example.test',
  role: 'management', account_type: 'sonasp', is_active: true, mining_company_id: null,
  organization_id: organization.id, organization_type: 'sonasp', capabilities: Object.values(CAPABILITIES),
  module_codes: null, permissions: [], access_role_name: 'Compte fictif',
};
export const useAuth = () => ({ user, session: { user }, initialized: true, loading: false, profileLoading: false, permissionsLoading: false, profileError: null,
  signOut: async () => { throw new Error('Aucune session réelle dans cet aperçu.'); }, refreshProfile: async () => undefined });
