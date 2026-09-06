import { useSyncExternalStore } from 'react';
import { CAPABILITIES } from '../../src/lib/capabilities';
let role = 'owner';
const listeners = new Set<() => void>();
export const qaRole = () => role;
export const setQaRole = (next: string) => { role = next; listeners.forEach(fn => fn()); };
export const useAuth = () => {
  const current = useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, qaRole);
  return { user: { id: 'test-' + current, role: current, full_name: 'Profil local de test', email: 'qa@example.test', is_active: true, mining_company_id: null, capabilities: current === 'collector' ? [CAPABILITIES.COLLECTOR_OPERATE] : Object.values(CAPABILITIES), permissions: [] }, signOut: async () => {}, session: {}, loading: false, initialized: true, profileLoading: false };
};
