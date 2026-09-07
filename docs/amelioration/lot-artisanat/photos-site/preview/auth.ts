import { CAPABILITIES } from '@/lib/capabilities';
export const organization = { id: 'qa-org', organization_type: 'dgmg', code: 'DGMG', name: 'DGMG — contexte fictif de présentation' };
const user = { id: 'qa-agent', full_name: 'Agent QA local', email: 'qa@example.test', role: 'dgmg', is_active: true,
  organization_id: organization.id, organization_type: 'dgmg', capabilities: Object.values(CAPABILITIES), module_codes: null, permissions: [], access_role_name: 'DGMG simulée' };
export const useAuth = () => ({ user, session: { user }, initialized: true, loading: false, profileLoading: false, permissionsLoading: false, profileError: null,
  signOut: async () => { throw new Error('Aucune session réelle dans cet aperçu.'); }, refreshProfile: async () => undefined });
