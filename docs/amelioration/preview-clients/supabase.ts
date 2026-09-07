import { organization } from './auth';
const denied = () => { throw new Error('Aperçu de présentation : aucune persistance disponible. Enregistrement interdit.'); };
function from(table: string) {
  let single = false;
  const chain: any = new Proxy({}, { get(_target, key) {
    if (key === 'then') {
      const data = table === 'snp_organizations' ? (single ? organization : [organization]) : (single ? null : []);
      const promise = Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : 0 });
      return promise.then.bind(promise);
    }
    if (['insert', 'update', 'upsert', 'delete'].includes(String(key))) return denied;
    return () => { if (key === 'single' || key === 'maybeSingle') single = true; return chain; };
  } });
  return chain;
}
export const supabase = {
  from, rpc: denied, functions: { invoke: denied }, storage: { from: () => ({ upload: denied, remove: denied, createSignedUrl: async () => ({ data: null, error: { message: 'Aucun document réel dans cet aperçu.' } }) }) },
  auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }) },
};
