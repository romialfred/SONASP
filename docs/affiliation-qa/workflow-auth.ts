import { useSyncExternalStore } from 'react';
import { CAPABILITIES } from '../../src/lib/capabilities';

export const QA_ACTORS = {
  maker: 'a1000000-0000-4000-8000-000000000001',
  checker: 'a1000000-0000-4000-8000-000000000002',
  outsider: 'a1000000-0000-4000-8000-000000000003',
} as const;
let actor: keyof typeof QA_ACTORS = 'maker';
const listeners = new Set<() => void>();
export const qaActor = () => actor;
export const setQaActor = (next: keyof typeof QA_ACTORS) => {
  actor = next;
  listeners.forEach((listener) => listener());
};
export const useAuth = () => {
  const current = useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, qaActor);
  return {
    user: { id: QA_ACTORS[current], role: 'owner', full_name: current === 'maker' ? 'Agent de saisie · Test' : current === 'checker' ? 'Agent de contrôle · Test' : 'Agent hors périmètre · Test', email: 'qa@example.test', is_active: true, mining_company_id: null, capabilities: Object.values(CAPABILITIES), permissions: [] },
    signOut: async () => {}, session: {}, loading: false, initialized: true, profileLoading: false,
  };
};
